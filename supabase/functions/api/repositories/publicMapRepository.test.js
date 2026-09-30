import {
  listPublicClusters,
  listPublicReports,
} from "./publicMapRepository.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

Deno.test("public map repository reports calculate approximate location at read time", async () => {
  let sqlText = "";
  let values = [];
  const tx = (strings, ...parameters) => {
    sqlText = strings.join("?");
    values = parameters;
    return Promise.resolve([]);
  };

  await listPublicReports(tx, {
    since: "2026-09-01T00:00:00.000Z",
    limit: 50,
  });

  assert(
    sqlText.includes("app_private.approximate_public_location(r.location)"),
    "public report coordinates must be calculated from the internal location",
  );
  assert(
    !sqlText.includes("ST_X(r.location") && !sqlText.includes("ST_Y(r.location"),
    "public report payload must not expose exact coordinates",
  );
  assert(sqlText.includes("r.status = 'visible'"), "must select visible reports");
  assert(sqlText.includes("r.public_until > now()"), "must exclude expired reports");
  assert(
    sqlText.includes("dm.member_role = 'duplicate'"),
    "must exclude active non-canonical duplicate reports",
  );
  assert(
    sqlText.includes("r.published_at >="),
    "since must apply to the public publication timestamp",
  );
  assert(values.includes(50), "repository should receive the bounded limit");
});

Deno.test("public map repository clusters use metric DBSCAN and complete type counts", async () => {
  let sqlText = "";
  let values = [];
  const tx = (strings, ...parameters) => {
    sqlText = strings.join("?");
    values = parameters;
    return Promise.resolve([]);
  };

  await listPublicClusters(tx, {
    zoom: 12,
    radiusMeters: 250,
    viewport: {
      minLongitude: -107.7,
      minLatitude: 27.7,
      maxLongitude: -107.5,
      maxLatitude: 27.9,
    },
    limit: 2000,
  });

  assert(
    sqlText.includes("extensions.ST_Transform(r.location::extensions.geometry, 32613)"),
    "cluster membership must use exact UTM metric points internally",
  );
  assert(
    sqlText.includes("extensions.ST_ClusterDBSCAN(metric_point"),
    "clusters must be calculated by PostGIS DBSCAN",
  );
  assert(
    sqlText.includes("app_private.approximate_public_location"),
    "cluster centroids must be snapped before release",
  );
  assert(
    sqlText.includes("md5(array_to_string(member_ids, ','))"),
    "cluster_id must be deterministic from ordered members",
  );
  for (
    const alias of [
      "count_avistamiento_simple",
      "count_ataque_mascota",
      "count_ataque_ganado",
      "count_ataque_humano",
      "count_perro_lastimado",
      "count_otro",
    ]
  ) {
    assert(sqlText.includes(alias), `${alias} must be selected`);
  }
  assert(values.includes(250), "radius parameter should be passed to DBSCAN");
  assert(values.includes(2000), "input report cap should be applied");
});
