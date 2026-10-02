import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import JailMonkey from 'jail-monkey';

import { createReportDraftQueueController } from './reportDraftQueueController.js';
import { createReportPhotoUploadClient } from './useReportPhotoUpload.js';
import { createReportDraftDao } from '../dao/reportDraftDao.js';
import { createLocalReportDraft } from '../models/reportDraft.js';
import {
  getReportPhotoStatus,
  submitReport,
  uploadReportPhotoFile,
  uploadReportPhoto,
} from '../services/reportApi.js';

async function readMockDetector(mockDetector = JailMonkey) {
  try {
    const result = mockDetector?.canMockLocation?.();
    return Boolean(result instanceof Promise ? await result : result);
  } catch {
    return false;
  }
}

export async function getCurrentLocationSnapshot({
  location = Location,
  mockDetector = JailMonkey,
} = {}) {
  const permission = await location.requestForegroundPermissionsAsync();
  if (!permission?.granted) {
    throw Object.assign(new Error('Location permission denied'), {
      code: 'location_permission_denied',
      status: 400,
    });
  }
  const reading = await location.getCurrentPositionAsync({
    accuracy: location.Accuracy?.High,
    mayShowUserSettingsDialog: true,
  });
  const mockDetectorSuspected = await readMockDetector(mockDetector);
  const coords = reading.coords ?? {};

  return {
    longitude: coords.longitude,
    latitude: coords.latitude,
    accuracy_meters: coords.accuracy ?? 99999.99,
    mock_suspected: Boolean(reading.mocked) || mockDetectorSuspected,
    mocked_by_provider: Boolean(reading.mocked),
    mock_detector_suspected: mockDetectorSuspected,
    captured_at: new Date(reading.timestamp ?? Date.now()).toISOString(),
  };
}

function createDefaultController(repository, dependencies = {}) {
  const photoUploadClient = dependencies.photoUploadClient ?? createReportPhotoUploadClient({
    preparePhoto: dependencies.preparePhoto,
    uploadPreparedFile: dependencies.uploadPreparedFile ??
      ((input) => uploadReportPhotoFile({ ...input, fileSystem: FileSystem })),
    uploadPhoto: dependencies.uploadReportPhoto ?? uploadReportPhoto,
    getPhotoStatus: dependencies.getPhotoStatus ?? getReportPhotoStatus,
    deletePreparedPhoto: dependencies.deletePreparedPhoto,
    wait: dependencies.photoPollWait,
    pollIntervalMs: dependencies.photoPollIntervalMs,
    maxPollAttempts: dependencies.photoPollMaxAttempts,
  });

  return createReportDraftQueueController({
    repository,
    createDraftRecord: createLocalReportDraft,
    createId: dependencies.createId ?? (() => Crypto.randomUUID()),
    getLocationSnapshot: dependencies.getLocationSnapshot ?? (() => getCurrentLocationSnapshot()),
    submitReport: dependencies.submitReport ?? submitReport,
    uploadPhoto: dependencies.uploadPhoto ?? photoUploadClient.uploadPhoto,
    getPhotoStatus: dependencies.getPhotoStatus ?? getReportPhotoStatus,
    pollPhotoStatus: dependencies.pollPhotoStatus ?? photoUploadClient.pollPhotoStatus,
    deleteLocalPhoto: dependencies.deleteLocalPhoto ?? ((uri) =>
      FileSystem.deleteAsync(uri, { idempotent: true })),
    deletePreparedPhoto: dependencies.deletePreparedPhoto ?? photoUploadClient.deletePreparedPhoto,
    now: dependencies.now,
  });
}

export function useReportDraftQueue({
  repositoryFactory = createReportDraftDao,
  dependencies = {},
} = {}) {
  const controllerRef = useRef(null);
  const repositoryRef = useRef(null);
  const dependenciesRef = useRef(dependencies);
  const inFlightRef = useRef(0);
  const [state, setState] = useState({
    ready: false,
    loading: true,
    drafts: [],
    error: null,
  });

  const reload = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) return [];
    const drafts = await repository.list();
    setState((current) => ({ ...current, drafts, error: null }));
    return drafts;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repository = await repositoryFactory();
        if (cancelled) return;
        repositoryRef.current = repository;
        controllerRef.current = createDefaultController(repository, dependenciesRef.current);
        const drafts = await repository.list();
        if (!cancelled) {
          setState({ ready: true, loading: false, drafts, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ ready: false, loading: false, drafts: [], error });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repositoryFactory]);

  const createDraft = useCallback(async (input) => {
    const controller = controllerRef.current;
    if (!controller) throw new Error('report_draft_queue_not_ready');
    const draft = await controller.createDraft(input);
    await reload();
    return draft;
  }, [reload]);

  const queueDraft = useCallback(async (id, options) => {
    const controller = controllerRef.current;
    if (!controller) throw new Error('report_draft_queue_not_ready');
    const draft = await controller.queueDraft(id, options);
    await reload();
    return draft;
  }, [reload]);

  const syncDraft = useCallback(async (id) => {
    const controller = controllerRef.current;
    if (!controller) throw new Error('report_draft_queue_not_ready');
    inFlightRef.current += 1;
    try {
      const draft = await controller.syncDraft(id);
      await reload();
      return draft;
    } finally {
      inFlightRef.current -= 1;
    }
  }, [reload]);

  const syncDueDrafts = useCallback(async () => {
    const controller = controllerRef.current;
    if (!controller) throw new Error('report_draft_queue_not_ready');
    inFlightRef.current += 1;
    try {
      const drafts = await controller.syncDueDrafts();
      await reload();
      return drafts;
    } finally {
      inFlightRef.current -= 1;
    }
  }, [reload]);

  const isSyncBusy = useCallback(() => inFlightRef.current > 0, []);

  return {
    ...state,
    createDraft,
    queueDraft,
    syncDraft,
    syncDueDrafts,
    isSyncBusy,
    reload,
  };
}
