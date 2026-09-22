import { Hono } from "hono";
import { canonicalZoneGeometry, sha256Hex } from "../domain/zone-set.js";
import { requestId } from "../middleware/request-id.js";
import { createZoneRoutes } from "../routes/zone-sets.js";
import { app as actualApp } from "../app.js";
import { createZoneService } from "../services/zone-service.js";

const zoneSetId = "00000000-0000-4000-8000-000000000001";
const geometry = {
  type: "Polygon",
  coordinates: [[[-107.64, 27.73], [-107.63, 27.73], [-107.63, 27.74], [
    -107.64,
    27.73,
  ]]],
};
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function creationInput() {
  return {
    name: "Creel candidate",
    source_uri: "https://example.test/creel.geojson",
    source_version: "v1",
    source_sha256: await sha256Hex(canonicalZoneGeometry(geometry)),
    geometry,
  };
}

function state(status = "draft") {
  return {
    id: zoneSetId,
    environment: "staging",
    version: 2,
    name: "Creel candidate",
    source_uri: "https://example.test/creel.geojson",
    source_version: "v1",
    source_sha256: "a".repeat(64),
    source_geojson: JSON.parse(canonicalZoneGeometry(geometry)),
    status,
    association_approval_reference: status === "active"
      ? "AHC-2026-09-21"
      : null,
    approved_at: status === "active" ? "2026-09-21T00:00:00+00:00" : null,
    activated_at: status === "active" ? "2026-09-21T00:00:00+00:00" : null,
    retired_at: null,
    created_by: zoneSetId,
    created_at: "2026-09-21T00:00:00+00:00",
    private_field: "hidden",
  };
}

function harness({ failure = null } = {}) {
  let calls = 0;
  const service = {
    create({ input }) {
      calls++;
      assert(
        input.geometry.type === "Polygon" && !("canonical_geometry" in input),
        "Boundary must preserve the external input for service validation",
      );
      if (failure) throw failure;
      return state();
    },
    activate({ zoneSetId: id, input }) {
      calls++;
      assert(
        id === zoneSetId && input.association_approval_reference,
        "Activation input must pass through",
      );
      if (failure) throw failure;
      return state("active");
    },
  };
  const authorize = async (c, next) => {
    c.set("auth", { type: "authenticated" });
    await next();
  };
  const app = new Hono();
  app.use("*", requestId);
  app.route("/", createZoneRoutes({ service, authorize }));
  return { app, calls: () => calls };
}

Deno.test("FAB-2 HTTP integration: real service creates and activates with optional note omitted", async () => {
  const actor = {
    type: "authenticated",
    userId: zoneSetId,
    role: "administrator",
    profile: { id: zoneSetId, role: "administrator", active: true },
  };
  let row;
  const audits = [];
  const service = createZoneService({
    getConfig: () => ({ expectedEnvironment: "staging" }),
    getSql: () => ({ begin: (operation) => operation(() => {}) }),
    repository: {
      readZoneActor: () => actor.profile,
      readZoneEnvironment: () => "staging",
      lockZoneEnvironment: () => {},
      insertZoneSet: (_tx, { values }) => {
        row = {
          ...state(),
          source_geojson: values.geometry,
          source_sha256: values.source_sha256,
        };
        return zoneSetId;
      },
      readZoneSet: () => row,
      readActiveZoneSets: () => [],
      activateZoneSet: (_tx, { associationApprovalReference }) => {
        row = {
          ...row,
          status: "active",
          association_approval_reference: associationApprovalReference,
        };
      },
      insertZoneAudit: (_tx, audit) => audits.push(audit),
    },
  });
  const app = new Hono().basePath("/api");
  app.route(
    "/",
    createZoneRoutes({
      service,
      authorize: async (c, next) => {
        c.set("auth", actor);
        await next();
      },
    }),
  );
  const created = await app.request("/api/admin/zone-sets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await creationInput()),
  });
  assert(
    created.status === 201,
    `Creation must succeed: ${await created.text()}`,
  );
  const activated = await app.request(
    `/api/admin/zone-sets/${zoneSetId}/activate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ association_approval_reference: "AHC-TEST-1" }),
    },
  );
  assert(
    activated.status === 200,
    `Activation without note must succeed: ${await activated.text()}`,
  );
  assert(
    audits.length === 2 && audits[1].note === null && row.status === "active",
    "Both commands must reach persistence and audit",
  );
});

Deno.test("FAB-2 HTTP: creation and activation expose only typed zone-set data", async () => {
  const { app, calls } = harness();
  const created = await app.request("/admin/zone-sets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await creationInput()),
  });
  const activated = await app.request(
    `/admin/zone-sets/${zoneSetId}/activate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        association_approval_reference: "AHC-2026-09-21",
        note: "Checked.",
      }),
    },
  );
  assert(
    created.status === 201 && activated.status === 200 && calls() === 2,
    "Expected command statuses",
  );
  let activatedBody;
  for (const response of [created, activated]) {
    const body = await response.json();
    assert(response.headers.has("X-Request-Id"), "Request id must survive");
    assert(
      body.data.zone_set.created_at.endsWith("Z") &&
        !("private_field" in body.data.zone_set),
      "Presenter must allowlist",
    );
    if (response === activated) activatedBody = body;
  }
  assert(
    activatedBody.data.zone_set.status === "active",
    "Activation result must be active",
  );
});

Deno.test("FAB-2 HTTP: malformed input, query, identifiers and methods do not invoke service", async () => {
  const { app, calls } = harness();
  for (
    const body of [
      "",
      "{",
      "{}",
      JSON.stringify({
        ...(await creationInput()),
        source_sha256: "a".repeat(64),
      }),
    ]
  ) {
    const response = await app.request("/admin/zone-sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    assert(response.status === 400, "Invalid creation must return 400");
  }
  const wrongId = await app.request("/admin/zone-sets/not-a-uuid/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ association_approval_reference: "AHC-1" }),
  });
  assert(wrongId.status === 400, "Invalid identifier must return 400");
  const query = await app.request("/admin/zone-sets?environment=production", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await creationInput()),
  });
  assert(query.status === 400, "Environment query must be rejected");
  for (
    const path of ["/admin/zone-sets", `/admin/zone-sets/${zoneSetId}/activate`]
  ) {
    const response = await app.request(path, { method: "PUT" });
    assert(
      response.status === 405 && response.headers.get("Allow") === "POST",
      "Only POST is supported",
    );
  }
  assert(calls() === 0, "Invalid requests must not reach Service");
});

Deno.test("FAB-2 HTTP: application mounts canonical API routes and protects them", async () => {
  for (
    const path of [
      "/api/admin/zone-sets",
      `/api/admin/zone-sets/${zoneSetId}/activate`,
    ]
  ) {
    const response = await actualApp.request(path, { method: "POST" });
    assert(
      response.status === 401 &&
        (await response.json()).error.code === "authentication_required",
      "Canonical route must require auth",
    );
  }
  const unprefixed = await actualApp.request("/admin/zone-sets", {
    method: "POST",
  });
  assert(unprefixed.status === 404, "Application basePath must be respected");
});
