import {
  assertActivatableZoneSet,
  assertAtMostOneActiveZone,
  canonicalZoneGeometry,
  sha256Hex,
  validateZoneSetActivation,
  validateZoneSetCreation,
  ZoneSetError,
} from "./zone-set.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const polygon = {
  type: "Polygon",
  coordinates: [[[-107.64, 27.73], [-107.63, 27.73], [-107.63, 27.74], [
    -107.64,
    27.73,
  ]]],
};

async function validCreation(overrides = {}) {
  const geometry = overrides.geometry ?? polygon;
  return {
    name: "Creel candidate",
    source_uri: "https://example.test/creel.geojson",
    source_version: "v1",
    source_sha256: await sha256Hex(canonicalZoneGeometry(geometry)),
    geometry,
    ...overrides,
  };
}

async function rejects(operation, field) {
  try {
    await operation();
  } catch (error) {
    assert(
      error instanceof ZoneSetError && error.code === "invalid_request",
      "Expected validation error",
    );
    if (field) assert(error.details.fields[field], `Expected ${field} error`);
    return;
  }
  throw new Error("Expected validation error");
}

Deno.test("FAB-2 DOMAIN: creation normalizes Polygon and binds checksum to canonical GeoJSON", async () => {
  const result = await validateZoneSetCreation(await validCreation());
  assert(
    result.geometry.type === "MultiPolygon",
    "Polygon must normalize to MultiPolygon",
  );
  assert(
    result.source_sha256 === await sha256Hex(result.canonical_geometry),
    "Checksum must match stored geometry",
  );
  assert(result.name === "Creel candidate", "Metadata must survive validation");
});

Deno.test("FAB-2 DOMAIN: geometry and checksum reject malformed or mismatched evidence", async () => {
  await rejects(
    async () =>
      validateZoneSetCreation(
        await validCreation({ source_sha256: "a".repeat(64) }),
      ),
    "source_sha256",
  );
  await rejects(
    async () =>
      validateZoneSetCreation(
        await validCreation({
          geometry: { type: "Point", coordinates: [0, 0] },
        }),
      ),
    "geometry",
  );
  await rejects(
    async () =>
      validateZoneSetCreation(
        await validCreation({
          geometry: {
            ...polygon,
            coordinates: [[
              [-107.64, 27.73],
              [-107.63, 27.73],
              [-107.63, 27.74],
              [-107.64, 27.74],
            ]],
          },
        }),
      ),
    "geometry",
  );
  await rejects(
    async () =>
      validateZoneSetCreation(await validCreation({ source_uri: "not a uri" })),
    "source_uri",
  );
});

Deno.test("FAB-2 DOMAIN: creation rejects unknown, incomplete and noncanonical fields", async () => {
  await rejects(
    async () => validateZoneSetCreation(await validCreation({ extra: true })),
    "extra",
  );
  await rejects(
    async () => validateZoneSetCreation(await validCreation({ name: "   " })),
    "name",
  );
  await rejects(
    async () =>
      validateZoneSetCreation(
        await validCreation({ source_sha256: "A".repeat(64) }),
      ),
    "source_sha256",
  );
});

Deno.test("FAB-2 DOMAIN: activation keeps Association approval separate from Administrator note", () => {
  const result = validateZoneSetActivation({
    association_approval_reference: "AHC-2026-09-21",
    note: "Validated before activation.",
  });
  assert(
    result.association_approval_reference === "AHC-2026-09-21" &&
      result.note.startsWith("Validated"),
    "Values retained",
  );
  for (
    const input of [{}, { association_approval_reference: "   " }, {
      association_approval_reference: "AHC-1",
      note: "",
    }, { association_approval_reference: "AHC-1", extra: true }]
  ) {
    let caught;
    try {
      validateZoneSetActivation(input);
    } catch (error) {
      caught = error;
    }
    assert(
      caught instanceof ZoneSetError && caught.code === "invalid_request",
      "Activation validation required",
    );
  }
});

Deno.test("FAB-2 DOMAIN: activation permits at most one active zone and only a checksum-matched draft", async () => {
  assertAtMostOneActiveZone([]);
  let activeConflict;
  try {
    assertAtMostOneActiveZone([{ id: "first" }, { id: "second" }]);
  } catch (error) {
    activeConflict = error;
  }
  assert(
    activeConflict instanceof ZoneSetError &&
      activeConflict.code === "zone_set_conflict",
    "Only one active set allowed",
  );
  const source_geojson = JSON.parse(canonicalZoneGeometry(polygon));
  const source_sha256 = await sha256Hex(canonicalZoneGeometry(source_geojson));
  await assertActivatableZoneSet({
    status: "draft",
    source_geojson,
    source_sha256,
  });
  for (
    const zoneSet of [
      { status: "retired", source_geojson, source_sha256 },
      { status: "draft", source_geojson, source_sha256: "a".repeat(64) },
    ]
  ) {
    let conflict;
    try {
      await assertActivatableZoneSet(zoneSet);
    } catch (error) {
      conflict = error;
    }
    assert(
      conflict instanceof ZoneSetError && conflict.code === "zone_set_conflict",
      "Only valid draft can activate",
    );
  }
});
