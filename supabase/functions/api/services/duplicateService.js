import {
  assertAvailableReports,
  assertConnectedCandidates,
  DuplicateError,
  validateDuplicateId,
  validateDuplicateResolution,
  validateDuplicateReversal,
} from "../domain/duplicateGroup.js";
import { getConfig } from "../infrastructure/config.js";
import { getSql } from "../infrastructure/db.js";
import * as repository from "../repositories/duplicateRepository.js";

function assertAdministrator(actor) {
  if (actor?.type !== "authenticated" || !actor.userId) {
    throw new DuplicateError(
      "authentication_required",
      "A valid Administrator session is required.",
    );
  }
  if (
    actor.role !== "administrator" || actor.profile?.active !== true ||
    actor.profile.id !== actor.userId || actor.profile.role !== actor.role
  ) {
    throw new DuplicateError(
      "forbidden",
      "An active matching Administrator profile is required.",
    );
  }
}

export function createDuplicateService(dependencies = {}) {
  const deps = { getConfig, getSql, repository, ...dependencies };
  const repo = deps.repository;
  async function inTransaction(actor, operation) {
    const expected = deps.getConfig().expectedEnvironment;
    if (!["staging", "production"].includes(expected)) {
      throw new DuplicateError(
        "preflight_mismatch",
        "Deployment environment is not configured.",
      );
    }
    try {
      return await deps.getSql().begin(async (tx) => {
        await tx`SELECT set_config('app.user_id', ${actor.userId}, true)`;
        await tx`SELECT set_config('app.role', ${actor.role}, true)`;
        const profile = await repo.readDuplicateActor(tx, actor.userId);
        if (
          !profile?.active || profile.id !== actor.userId ||
          profile.role !== "administrator"
        ) {
          throw new DuplicateError(
            "forbidden",
            "The Administrator profile is no longer active.",
          );
        }
        if (await repo.readDuplicateEnvironment(tx) !== expected) {
          throw new DuplicateError(
            "preflight_mismatch",
            "Deployment environment does not match.",
          );
        }
        return operation(tx);
      });
    } catch (error) {
      if (error instanceof DuplicateError) throw error;
      if (error?.code === "42501") {
        throw new DuplicateError(
          "forbidden",
          "The duplicate operation is not permitted.",
        );
      }
      if (["23505", "23503", "40001", "40P01"].includes(error?.code)) {
        throw new DuplicateError(
          "duplicate_group_conflict",
          "Duplicate state changed; reload and retry the request.",
        );
      }
      if (error?.code === "23514") {
        throw new DuplicateError(
          "invalid_request",
          "Duplicate resolution violates a storage constraint.",
        );
      }
      if (
        [
          "CONNECTION_CLOSED",
          "CONNECTION_ENDED",
          "CONNECT_TIMEOUT",
          "ECONNREFUSED",
          "ECONNRESET",
          "ENOTFOUND",
          "EAI_AGAIN",
          "57P01",
          "57P02",
          "57P03",
        ].includes(error?.code) || error?.code?.startsWith("08")
      ) {
        throw new DuplicateError(
          "dependency_unavailable",
          "Duplicate storage is unavailable.",
        );
      }
      throw error;
    }
  }
  return {
    async list({ actor }) {
      assertAdministrator(actor);
      return inTransaction(actor, (tx) => repo.listActiveDuplicateGroups(tx));
    },
    async resolve({ actor, input }) {
      assertAdministrator(actor);
      const values = validateDuplicateResolution(input);
      return inTransaction(actor, async (tx) => {
        await repo.lockDuplicateResolution(tx);
        const reports = await repo.lockDuplicateReports(tx, values.report_ids);
        const memberships = await repo.readActiveMemberships(
          tx,
          values.report_ids,
        );
        assertAvailableReports(values.report_ids, reports, memberships);
        const candidates = await repo.lockInternalCandidates(
          tx,
          values.report_ids,
          "pending",
        );
        assertConnectedCandidates(values.report_ids, candidates);
        const id = await repo.insertDuplicateGroup(tx, {
          actorId: actor.userId,
          values,
        });
        const confirmed = await repo.confirmDuplicateCandidates(tx, {
          ids: candidates.map((c) => c.id),
          actorId: actor.userId,
        });
        if (confirmed.length !== candidates.length) {
          throw new DuplicateError(
            "duplicate_group_conflict",
            "Candidate review changed during resolution.",
          );
        }
        const group = await repo.readDuplicateGroup(tx, id);
        if (!group || group.status !== "active") {
          throw new Error("Resolved group was not readable as active.");
        }
        await repo.insertDuplicateAudit(tx, {
          actorId: actor.userId,
          action: "duplicate_resolved",
          previous: { group: null, candidates },
          current: {
            group,
            candidate_ids: candidates.map((c) => c.id),
            candidate_status: "confirmed",
          },
          note: values.note,
        });
        return group;
      });
    },
    async reverse({ actor, groupId, input }) {
      assertAdministrator(actor);
      validateDuplicateId(groupId);
      const values = validateDuplicateReversal(input);
      return inTransaction(actor, async (tx) => {
        await repo.lockDuplicateResolution(tx);
        const locked = await repo.lockDuplicateGroup(tx, groupId);
        if (!locked) {
          throw new DuplicateError(
            "not_found",
            "Duplicate group was not found.",
          );
        }
        if (locked.status !== "active") {
          throw new DuplicateError(
            "duplicate_group_conflict",
            "Only an active duplicate group can be reversed.",
          );
        }
        const previous = await repo.readDuplicateGroup(tx, groupId);
        // Retention may already have removed a noncanonical member. Lock only
        // surviving members; reversal must still release the remaining group.
        const ids = previous.report_ids;
        await repo.lockDuplicateReports(tx, ids);
        const candidates = await repo.lockInternalCandidates(
          tx,
          ids,
          "confirmed",
        );
        await repo.reverseDuplicateGroup(tx, {
          id: groupId,
          actorId: actor.userId,
          candidateIds: candidates.map((c) => c.id),
        });
        const group = await repo.readDuplicateGroup(tx, groupId);
        if (!group || group.status !== "reversed") {
          throw new Error("Reversed group was not readable.");
        }
        await repo.insertDuplicateAudit(tx, {
          actorId: actor.userId,
          action: "duplicate_reversed",
          previous: { group: previous, candidates },
          current: {
            group,
            candidate_ids: candidates.map((c) => c.id),
            candidate_status: "pending",
          },
          note: values.note,
        });
        return group;
      });
    },
  };
}
export const duplicateService = createDuplicateService();
