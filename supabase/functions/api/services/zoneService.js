/**
 * @module services/zoneService
 * Administrator use cases for geofence zone sets: creating a draft and activating it. Per ADR-019 this
 * Service owns authorization and re-checks the stored profile and environment inside each transaction.
 */
import {
  assertActivatableZoneSet,
  assertAtMostOneActiveZone,
  validateZoneSetActivation,
  validateZoneSetCreation,
  ZoneSetError,
} from "../domain/zoneSet.js";
import { getConfig } from "../infrastructure/config.js";
import { getSql } from "../infrastructure/db.js";
import * as repository from "../repositories/zoneRepository.js";

/**
 * Requires an authenticated, active Administrator whose profile matches the token subject and role.
 * @throws {ZoneSetError} `authentication_required` or `forbidden`.
 */
function assertAdministrator(actor) {
  if (actor?.type !== "authenticated" || !actor.userId) {
    throw new ZoneSetError(
      "authentication_required",
      "A valid administrator session is required.",
    );
  }
  if (
    actor.role !== "administrator" || actor.profile?.active !== true ||
    actor.profile.id !== actor.userId || actor.profile.role !== actor.role
  ) {
    throw new ZoneSetError(
      "forbidden",
      "An active matching Administrator profile is required.",
    );
  }
}

/**
 * Creates the zone set Service.
 * @param {object} [dependencies] - Overrides for `getConfig`, `getSql`, and `repository` (tests).
 * @returns {{
 *   create: (options: {actor: import('../middleware/auth.js').AuthenticatedAuth, input: unknown}) => Promise<import('../repositories/zoneRepository.js').ZoneSetRow>,
 *   activate: (options: {actor: import('../middleware/auth.js').AuthenticatedAuth, zoneSetId: string, input: unknown}) => Promise<import('../repositories/zoneRepository.js').ZoneSetRow>
 * }}
 *   `create` stores a validated draft; `activate` makes a draft the single active zone set. Both
 *   write an audit entry.
 * @throws {ZoneSetError} `authentication_required`, `forbidden`, `invalid_request`, `not_found`,
 *   `zone_set_conflict` (also for unique violations and serialization failures), `preflight_mismatch`,
 *   or `dependency_unavailable` (connection failures, SQLSTATE class 08 and 57P01-57P03). Unknown errors propagate unchanged.
 */
export function createZoneService(dependencies = {}) {
  const deps = { getConfig, getSql, repository, ...dependencies };

  /** Runs `operation(tx, environment)` after the in-transaction actor and environment preflight, mapping storage errors. */
  async function inTransaction(actor, operation) {
    const expectedEnvironment = deps.getConfig().expectedEnvironment;
    if (!["staging", "production"].includes(expectedEnvironment)) {
      throw new ZoneSetError(
        "preflight_mismatch",
        "Deployment environment is not configured.",
      );
    }
    try {
      return await deps.getSql().begin(async (tx) => {
        await tx`SELECT set_config('app.user_id', ${actor.userId}, true)`;
        await tx`SELECT set_config('app.role', ${actor.role}, true)`;
        const profile = await deps.repository.readZoneActor(tx, actor.userId);
        if (!profile?.active || profile.role !== "administrator") {
          throw new ZoneSetError(
            "forbidden",
            "The Administrator profile is no longer active.",
          );
        }
        const environment = await deps.repository.readZoneEnvironment(tx);
        if (environment !== expectedEnvironment) {
          throw new ZoneSetError(
            "preflight_mismatch",
            "Deployment environment does not match.",
          );
        }
        return operation(tx, environment);
      });
    } catch (error) {
      if (error instanceof ZoneSetError) throw error;
      if (error?.code === "42501") {
        throw new ZoneSetError(
          "forbidden",
          "The zone operation is not permitted.",
        );
      }
      if (["23505", "40001", "40P01"].includes(error?.code)) {
        throw new ZoneSetError(
          "zone_set_conflict",
          "Zone set changed concurrently; retry the request.",
        );
      }
      if (error?.code === "23514") {
        throw new ZoneSetError(
          "invalid_request",
          "Zone set violates a storage constraint.",
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
        ].includes(error?.code) ||
        error?.code?.startsWith("08")
      ) {
        throw new ZoneSetError(
          "dependency_unavailable",
          "Zone storage is unavailable.",
        );
      }
      throw error;
    }
  }

  return {
    async create({ actor, input }) {
      assertAdministrator(actor);
      const values = await validateZoneSetCreation(input);
      return inTransaction(actor, async (tx, environment) => {
        await deps.repository.lockZoneEnvironment(tx, environment);
        const id = await deps.repository.insertZoneSet(tx, {
          environment,
          actorId: actor.userId,
          values,
        });
        const current = await deps.repository.readZoneSet(tx, {
          environment,
          id,
        });
        if (!current || current.status !== "draft") {
          throw new Error("Created zone set was not readable as draft.");
        }
        await deps.repository.insertZoneAudit(tx, {
          actorId: actor.userId,
          action: "zone_set_created",
          previous: null,
          current,
          note: null,
        });
        return current;
      });
    },
    async activate({ actor, zoneSetId, input }) {
      assertAdministrator(actor);
      const values = validateZoneSetActivation(input);
      return inTransaction(actor, async (tx, environment) => {
        await deps.repository.lockZoneEnvironment(tx, environment);
        const target = await deps.repository.readZoneSet(tx, {
          environment,
          id: zoneSetId,
          forUpdate: true,
        });
        if (!target) {
          throw new ZoneSetError(
            "not_found",
            "Zone set was not found in this environment.",
          );
        }
        await assertActivatableZoneSet(target);
        const active = await deps.repository.readActiveZoneSets(
          tx,
          environment,
        );
        assertAtMostOneActiveZone(active);
        await deps.repository.activateZoneSet(tx, {
          environment,
          id: zoneSetId,
          associationApprovalReference: values.association_approval_reference,
        });
        const current = await deps.repository.readZoneSet(tx, {
          environment,
          id: zoneSetId,
        });
        if (!current || current.status !== "active") {
          throw new Error("Activated zone set was not readable as active.");
        }
        await deps.repository.insertZoneAudit(tx, {
          actorId: actor.userId,
          action: "zone_set_activated",
          previous: {
            active_zone_set: active[0] ?? null,
            target_zone_set: target,
          },
          current,
          note: values.note,
        });
        return current;
      });
    },
  };
}

/** Production zone set Service instance. */
export const zoneService = createZoneService();
