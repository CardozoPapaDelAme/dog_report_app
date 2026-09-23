import { presentAssociationReports } from "./associationPresenter.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

Deno.test("association presenter exposes only the business projection and next cursor", async () => {
  const sensitive = {
    device_fingerprint_hash: "secret",
    flags: [{ reason: "spam" }],
    trust_score: 0.5,
    status_reason: "administrator_approved",
    approved_object_path: "private/path.jpg",
  };
  const row = {
    id: "11111111-1111-4111-8111-111111111111",
    longitude: -106.08,
    latitude: 28.63,
    incident_type: "avistamiento_simple",
    sighting_type: "individual",
    details: { notes: "near hotel" },
    color_predominante: "brown",
    tamano: "mediano",
    tiene_collar: false,
    has_sanitized_photo: true,
    client_created_at: "2026-09-01T00:00:00.000Z",
    accepted_at: "2026-09-02T00:00:00.000Z",
    ...sensitive,
  };
  const context = {
    get: () => "requestId",
    header(name, value) {
      this.headers ??= {};
      this.headers[name] = value;
    },
    json(body, status) {
      return Response.json(body, { status });
    },
  };

  const response = presentAssociationReports(context, {
    rows: [row],
    hasMore: true,
  });
  const body = await response.json();
  const item = body.data.items[0];

  assert(response.status === 200, "should return 200");
  assert(body.data.items.length === 1, "should return only the requested page");
  assert(
    typeof body.data.next_cursor === "string",
    "should return a cursor when another row exists",
  );
  assert(item.location.longitude === -106.08, "should preserve exact location");
  assert(
    item.occurred_at === row.client_created_at,
    "should expose occurred timestamp",
  );
  for (const key of Object.keys(sensitive)) {
    assert(item[key] === undefined, `must exclude ${key}`);
  }
});
