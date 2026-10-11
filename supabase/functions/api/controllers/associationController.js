/**
 * @module controllers/associationController
 * HTTP adapter for the association report list (Hono API on Supabase Edge: routes -> Controllers ->
 * Services -> Repositories; Presenters shape responses). Parses and validates query parameters; the
 * Service owns authorization (ADR-019).
 */
import { presentError } from "../presenters/error.js";
import { presentAssociationReports } from "../presenters/associationPresenter.js";
import { listAssociationReports } from "../services/associationService.js";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 5000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Parses `limit` (default 100, 1 to 5000).
 * @param {string | undefined} value - Raw query value.
 * @returns {number | null} The limit, or null when invalid.
 */
export function parseAssociationLimit(value) {
  if (value === undefined || value === "") return DEFAULT_LIMIT;
  if (!/^\d+$/.test(value)) return null;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= MAX_LIMIT
    ? limit
    : null;
}

/**
 * Parses an RFC 3339 timestamp that carries an explicit timezone.
 * @param {string | undefined} value - Raw value.
 * @returns {string | null | undefined} ISO string, null when absent, or undefined when invalid.
 */
export function parseAssociationTimestamp(value) {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Decodes a base64url `<accepted_at>|<uuid>` keyset cursor.
 * @param {string | undefined} value - Raw cursor.
 * @returns {{acceptedAt: string, id: string} | null | undefined} Cursor, null when absent, or undefined when malformed.
 */
export function parseAssociationCursor(value) {
  if (value === undefined || value === "") return null;
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const decoded = atob(base64);
    const separator = decoded.lastIndexOf("|");
    if (separator <= 0) return undefined;
    const acceptedAt = parseAssociationTimestamp(decoded.slice(0, separator));
    const id = decoded.slice(separator + 1);
    if (!acceptedAt || !UUID_PATTERN.test(id)) return undefined;
    return { acceptedAt, id: id.toLowerCase() };
  } catch {
    return undefined;
  }
}

/**
 * Validates the association list query.
 * @param {{from?: string, to?: string, limit?: string, cursor?: string}} query - Raw query values.
 * @returns {{ok: true, from: string | null, to: string | null, limit: number, cursor: {acceptedAt: string, id: string} | null}
 *   | {ok: false, message: string}}
 */
export function parseAssociationQuery(query) {
  const limit = parseAssociationLimit(query.limit);
  const from = parseAssociationTimestamp(query.from);
  const to = parseAssociationTimestamp(query.to);
  const cursor = parseAssociationCursor(query.cursor);

  if (limit === null) {
    return { ok: false, message: "limit must be an integer from 1 to 5000." };
  }
  if (from === undefined) {
    return {
      ok: false,
      message: "from must be an RFC 3339 timestamp with a timezone.",
    };
  }
  if (to === undefined) {
    return {
      ok: false,
      message: "to must be an RFC 3339 timestamp with a timezone.",
    };
  }
  if (cursor === undefined) {
    return { ok: false, message: "cursor is malformed." };
  }
  if (from && to && from > to) {
    return { ok: false, message: "from must be before or equal to to." };
  }

  return { ok: true, from, to, limit, cursor };
}

/**
 * `GET /association/reports`: lists accepted reports for the association role.
 * Responds 200, 400 `invalid_request`, 403 `forbidden`, or 503 `database_unavailable` for any other failure.
 * @param {import('hono').Context} c - Hono request context.
 * @returns {Promise<Response>}
 */
export async function getAssociationReports(c) {
  const parsed = parseAssociationQuery({
    from: c.req.query("from"),
    to: c.req.query("to"),
    limit: c.req.query("limit"),
    cursor: c.req.query("cursor"),
  });
  if (!parsed.ok) {
    return presentError(c, 400, "invalid_request", parsed.message);
  }

  try {
    const page = await listAssociationReports({
      actor: c.get("auth"),
      from: parsed.from,
      to: parsed.to,
      limit: parsed.limit,
      cursor: parsed.cursor,
    });
    return presentAssociationReports(c, page);
  } catch (error) {
    if (error?.code === "forbidden") {
      return presentError(
        c,
        403,
        "forbidden",
        "This route allows only the association role.",
      );
    }
    return presentError(
      c,
      503,
      "database_unavailable",
      "Postgres is not reachable.",
    );
  }
}
