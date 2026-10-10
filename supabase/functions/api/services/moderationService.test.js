// RF19 / HU-19 backend: moderation queue listing and its context.
//
// moderationService.js has no dependency injection: it obtains its connection
// from infrastructure/db.js. These tests therefore exercise the real Route,
// Controller, Repository and Presenter around listQueue with in-memory fakes and
// no database. With APP_BACKEND_DATABASE_URL unset, reaching the Service is
// observable as a fail-closed 503 from the Controller.
import { Hono } from "hono";

import {
  approveReport,
  deleteReport as deleteReportHandler,
  getModerationQueue,
  hideReport,
  restoreReport,
} from "../controllers/moderationController.js";
import { presentModerationQueue } from "../presenters/moderation.js";
import { listModerationQueue } from "../repositories/moderationRepository.js";
import { moderationRoutes } from "../routes/moderation.js";
import { approve, deleteReport, hide, listQueue, restore } from "./moderationService.js";

const DB_ENV = [
  "APP_BACKEND_DATABASE_URL",
  "SUPABASE_URL",
  "JWT_SECRET",
];
// Same shape as the auth object built by requireAuth in middleware/auth.js.
const administrator = {
  type: "authenticated",
  userId: "00000000-0000-4000-8000-000000000001",
  role: "administrator",
  profile: { id: "00000000-0000-4000-8000-000000000001", role: "administrator", active: true },
};
const association = {
  ...administrator,
  role: "association",
  profile: { ...administrator.profile, role: "association" },
};
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Runs a test body without database or JWT configuration and restores it after.
async function withoutBackendEnv(body) {
  const saved = DB_ENV.map((key) => [key, Deno.env.get(key)]);
  for (const key of DB_ENV) Deno.env.delete(key);
  try {
    return await body();
  } finally {
    for (const [key, value] of saved) {
      if (value !== undefined) Deno.env.set(key, value);
    }
  }
}

// Minimal Hono-like context for calling the Controller and Presenter directly.
function fakeContext(query = {}, auth = administrator) {
  const headers = {};
  return {
    headers,
    req: { query: (key) => query[key] },
    get: (key) => (key === "auth" ? auth : key === "requestId" ? "req-rf19" : undefined),
    header: (key, value) => {
      headers[key] = value;
    },
    json: (body, status) => ({ body, status }),
  };
}

// Tagged-template fake: records SQL text and parameters; tx(array) is the
// postgres.js list helper and returns a marker.
function fakeTx(rows = []) {
  const calls = [];
  const tx = (strings, ...values) => {
    if (Array.isArray(strings) && !("raw" in strings)) {
      return { list: strings };
    }
    calls.push({ text: strings.join("?"), values });
    return Promise.resolve(rows);
  };
  return { tx, calls };
}

function queueRow(n, overrides = {}) {
  return {
    id: uuid(n),
    incident_type: "ataque_humano",
    sighting_type: "solitario",
    details: { descripcion: `Synthetic report ${n}` },
    color_predominante: "negro",
    tamano: "grande",
    tiene_collar: false,
    gps_accuracy_meters: "12.5",
    mock_location_suspected: false,
    honeypot_suspected: false,
    status: "pending_review",
    status_reason: "low_trust",
    previous_status: null,
    trust_tier: "low",
    trust_score: "0.30",
    photo_validation_score: null,
    exif_consistency_score: null,
    gps_trust_score: "0.9",
    fingerprint_trust_score: "0.5",
    photo_expected: false,
    client_created_at: "2026-09-30T11:00:00.000Z",
    synced_at: `2026-09-30T12:0${n}:00.000Z`,
    accepted_at: null,
    published_at: null,
    public_until: null,
    hidden_at: null,
    deleted_at: null,
    flag_reviewed_at: null,
    longitude: "-107.6355",
    latitude: "27.7522",
    photo_state: null,
    flags: "[]",
    pending_duplicate_candidates: [],
    active_group_id: null,
    active_member_role: null,
    ...overrides,
  };
}

Deno.test("RF19 moderation queue route rejects missing or malformed bearer tokens before database access", async () => {
  await withoutBackendEnv(async () => {
    const app = new Hono();
    app.route("/", moderationRoutes);
    for (const path of ["/admin/moderation-queue", "/api/admin/moderation-queue"]) {
      const missing = await app.request(path);
      const missingBody = await missing.json();
      assert(
        missing.status === 401 && missingBody.error.code === "authentication_required",
        `${path} must require a bearer token`,
      );
      for (const header of ["Basic abc", "Bearer not-a-jwt"]) {
        const invalid = await app.request(path, { headers: { Authorization: header } });
        const invalidBody = await invalid.json();
        assert(
          invalid.status === 401 && invalidBody.error.code === "invalid_token",
          `${path} must reject "${header}" without reaching the profile lookup`,
        );
      }
    }
  });
});

Deno.test("RF19 moderation queue controller accepts limits 1, 500 and the default, and rejects 0, 501 and non-integers", async () => {
  await withoutBackendEnv(async () => {
    for (const limit of ["0", "501", "-1", "1.5", "abc"]) {
      const response = await getModerationQueue(fakeContext({ limit }));
      assert(
        response.status === 400 && response.body.error.code === "invalid_request",
        `limit=${limit} must be rejected before the Service`,
      );
      assert(
        response.body.error.message === "limit must be an integer from 1 to 500.",
        "the validation message must state the documented bounds",
      );
    }
    // Accepted limits reach listQueue; without a database it fails closed.
    for (const limit of ["1", "250", "500", undefined, ""]) {
      const response = await getModerationQueue(fakeContext({ limit }));
      assert(
        response.status === 503 && response.body.error.code === "database_unavailable",
        `limit=${limit} must pass validation and reach the Service`,
      );
    }
  });
});

Deno.test("RF19 moderation queue controller rejects malformed cursors and accepts a keyset cursor", async () => {
  await withoutBackendEnv(async () => {
    for (const cursor of ["%%%", btoa("no-separator"), btoa("2026-09-30T12:00:00.000Z|not-a-uuid")]) {
      const response = await getModerationQueue(fakeContext({ cursor }));
      assert(
        response.status === 400 && response.body.error.message === "cursor is malformed.",
        `cursor ${cursor} must be rejected before the Service`,
      );
    }
    const valid = btoa(`2026-09-30T12:00:00.000Z|${uuid(9)}`).replaceAll("=", "");
    const response = await getModerationQueue(fakeContext({ cursor: valid, limit: "20" }));
    assert(response.status === 503, "a well-formed cursor must reach the Service");
  });
});

Deno.test("RF19 moderation service fails closed when no database connection is configured", async () => {
  await withoutBackendEnv(() => {
    let message = "";
    try {
      listQueue({ actor: administrator, limit: 20, cursor: null });
    } catch (error) {
      message = error.message;
    }
    assert(
      message === "APP_BACKEND_DATABASE_URL is not set",
      "listQueue must not return data without a configured backend connection",
    );
  });
});

Deno.test("RF19 moderation repository lists only pending_review and hidden reports newest first with one look-ahead row", async () => {
  const { tx, calls } = fakeTx();
  await listModerationQueue(tx, { limit: 20, cursor: null });
  assert(calls.length === 1, "first page must run one query");
  const [{ text, values }] = calls;
  const list = values.find((value) => value?.list);
  assert(
    JSON.stringify(list?.list) === JSON.stringify(["pending_review", "hidden"]),
    "queue must contain only pending_review and hidden reports",
  );
  assert(text.includes("ORDER BY r.synced_at DESC, r.id DESC"), "newest synced first, id tiebreak");
  assert(values.includes(21), "limit + 1 look-ahead row decides next_cursor");
  assert(!text.includes("(r.synced_at, r.id) <"), "first page has no keyset predicate");
  for (const context of ["AS flags", "AS pending_duplicate_candidates", "AS photo_state", "gps_accuracy_meters", "trust_score", "ST_X(r.location"]) {
    assert(text.includes(context), `moderation context must include ${context}`);
  }
});

Deno.test("RF19 moderation repository applies the keyset cursor after the queue filter", async () => {
  const { tx, calls } = fakeTx();
  const cursor = { syncedAt: "2026-09-30T12:00:00.000Z", id: uuid(9) };
  await listModerationQueue(tx, { limit: 500, cursor });
  const [{ text, values }] = calls;
  assert(text.includes("(r.synced_at, r.id) < ("), "keyset predicate must follow the sort order");
  assert(values.includes(cursor.syncedAt) && values.includes(cursor.id), "cursor values are parameters");
  assert(values.includes(501), "maximum page keeps one look-ahead row");
});

Deno.test("RF19 moderation queue presenter trims the look-ahead row, encodes next_cursor and exposes context", () => {
  const rows = [
    queueRow(3, { flags: JSON.stringify([{ id: uuid(30), reason: "foto_falsa" }]) }),
    queueRow(2, { status: "hidden", incident_type: "avistamiento_simple" }),
    queueRow(1),
  ];
  const c = fakeContext();
  const response = presentModerationQueue(c, rows, 2);
  const { items, next_cursor: nextCursor } = response.body.data;
  assert(response.status === 200 && items.length === 2, "page must hold exactly limit items");
  assert(c.headers["X-Request-Id"] === "req-rf19", "request id header must be set");
  const expectedCursor = btoa(`2026-09-30T12:02:00.000Z|${uuid(2)}`)
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  assert(nextCursor === expectedCursor, "cursor points at the last returned row");
  assert(items[0].flags.length === 1 && items[0].location.latitude === 27.7522, "flags and exact location are exposed");
  assert(items[0].trust.score === 0.3 && items[0].location.accuracy_meters === 12.5, "numeric context is normalized");
  assert(
    JSON.stringify(items[0].allowed_commands) === JSON.stringify(["approve", "hide", "delete"]),
    "pending_review allows approve, hide and delete",
  );
  assert(
    JSON.stringify(items[1].allowed_commands) === JSON.stringify(["approve", "delete", "restore"]),
    "hidden allows approve, delete and restore",
  );

  const last = presentModerationQueue(fakeContext(), rows.slice(0, 2), 2);
  assert(last.body.data.items.length === 2 && last.body.data.next_cursor === null, "last page has no cursor");
  const empty = presentModerationQueue(fakeContext(), [], 1);
  assert(empty.body.data.items.length === 0 && empty.body.data.next_cursor === null, "empty queue is valid");
});

// INC-1 (docs/testing/INCIDENTS.md): ADR-019 in docs/architecture/DECISIONS.md
// makes Services own authorization, so the moderation Service rejects any actor
// that is not an active matching Administrator before it opens a connection,
// independently of the route middleware requireAuth('administrator').
const commands = { approve, hide, restore, deleteReport };
const rejectedActors = [
  ["anonymous", null, "authentication_required"],
  ["association", association, "forbidden"],
  ["inactive administrator", { ...administrator, profile: { ...administrator.profile, active: false } }, "forbidden"],
  ["mismatched profile", { ...administrator, profile: { ...administrator.profile, id: uuid(2) } }, "forbidden"],
  ["role without profile", { ...administrator, profile: undefined }, "forbidden"],
];

function rejectionCode(run) {
  try {
    run();
  } catch (error) {
    return error.code ?? null;
  }
  return "not rejected";
}

Deno.test("RF19 INC-1: moderation service rejects non-administrator actors before database access", async () => {
  await withoutBackendEnv(() => {
    for (const [label, actor, expected] of rejectedActors) {
      const code = rejectionCode(() => listQueue({ actor, limit: 20, cursor: null }));
      assert(code === expected, `listQueue with ${label} must be rejected with ${expected}, received ${code}`);
      for (const [name, command] of Object.entries(commands)) {
        const commandCode = rejectionCode(() => command({ actor, reportId: uuid(1), note: "Synthetic note" }));
        assert(
          commandCode === expected,
          `${name} with ${label} must be rejected with ${expected}, received ${commandCode}`,
        );
      }
    }
  });
});

Deno.test("RF19 INC-1: moderation controllers map Service authorization failures to 401 and 403", async () => {
  await withoutBackendEnv(async () => {
    const queue = await getModerationQueue(fakeContext({ limit: "20" }, association));
    assert(queue.status === 403 && queue.body.error.code === "forbidden", "queue must answer 403 forbidden");
    const anonymous = await getModerationQueue(fakeContext({ limit: "20" }, null));
    assert(
      anonymous.status === 401 && anonymous.body.error.code === "authentication_required",
      "queue without actor must answer 401 authentication_required",
    );
    const handlers = {
      approve: approveReport,
      hide: hideReport,
      restore: restoreReport,
      delete: deleteReportHandler,
    };
    const expectations = [
      [association, 403, "forbidden"],
      [null, 401, "authentication_required"],
    ];
    for (const [name, handler] of Object.entries(handlers)) {
      for (const [actor, status, code] of expectations) {
        const context = {
          ...fakeContext({}, actor),
          req: { param: () => uuid(1), text: () => Promise.resolve(JSON.stringify({ note: "Synthetic note" })) },
        };
        const response = await handler(context);
        assert(
          response.status === status && response.body.error.code === code,
          `${name} must answer ${status} ${code}, received ${response.status} ${response.body?.error?.code}`,
        );
      }
    }
  });
});
