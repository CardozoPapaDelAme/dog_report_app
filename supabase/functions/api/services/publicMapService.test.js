import {
  clusterRadiusForZoom,
  INCIDENT_TYPES,
} from "../domain/publicMap.js";
import { createPublicMapService } from "./publicMapService.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEquals(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

function fakeSql() {
  const statements = [];
  const tx = (strings, ...values) => {
    statements.push({ text: strings.join("?"), values });
    return Promise.resolve([]);
  };
  return {
    statements,
    sql: {
      begin(callback) {
        return callback(tx);
      },
    },
  };
}

Deno.test("public map domain resolves balanced zoom radii", () => {
  assertEquals(clusterRadiusForZoom(0), 1000);
  assertEquals(clusterRadiusForZoom(9), 500);
  assertEquals(clusterRadiusForZoom(12), 250);
  assertEquals(clusterRadiusForZoom(15), 100);
  assertEquals(clusterRadiusForZoom(22), 50);
});

Deno.test("public map service sets anonymous context and maps reports", async () => {
  const f = fakeSql();
  let input;
  const service = createPublicMapService({
    getSql: () => f.sql,
    repository: {
      listPublicReports: (_tx, values) => {
        input = values;
        return Promise.resolve([{
          report_id: "11111111-1111-4111-8111-111111111111",
          approximate_longitude: "-107.635",
          approximate_latitude: "27.751",
          incident_type: "avistamiento_simple",
          sighting_type: "solitario",
          details: { descripcion: "visible" },
          color_predominante: "cafe",
          tamano: null,
          tiene_collar: null,
          has_sanitized_photo: false,
          occurred_at: "2026-09-01T00:00:00.000Z",
          has_flags: true,
        }]);
      },
      listPublicClusters: () => Promise.resolve([]),
    },
  });

  const reports = await service.listReports({ since: null });

  assert(input.limit === 100, "reports default limit should be applied");
  assert(
    f.statements.some((statement) => statement.text.includes("app.role")),
    "service should set local anonymous role context",
  );
  assertEquals(reports[0].approximateLocation, {
    longitude: -107.635,
    latitude: 27.751,
  });
  assert(reports[0].hasFlags === true, "flag warning should be exposed");
});

Deno.test("public map service caps cluster input and fills six type counts", async () => {
  const f = fakeSql();
  let input;
  const service = createPublicMapService({
    getSql: () => f.sql,
    repository: {
      listPublicReports: () => Promise.resolve([]),
      listPublicClusters: (_tx, values) => {
        input = values;
        return Promise.resolve([{
          cluster_id: "z12-r250-example",
          report_count: 3,
          approximate_longitude: -107.635,
          approximate_latitude: 27.751,
          count_avistamiento_simple: 2,
          count_ataque_mascota: 0,
          count_ataque_ganado: 0,
          count_ataque_humano: 1,
          count_perro_lastimado: 0,
          count_otro: 0,
        }]);
      },
    },
  });

  const clusters = await service.listClusters({ zoom: 12, limit: 9000 });

  assert(input.radiusMeters === 250, "zoom 12 should use the 250m radius");
  assert(input.limit === 5000, "service should cap cluster input defensively");
  assert(
    INCIDENT_TYPES.every((type) =>
      Object.hasOwn(clusters[0].typeCounts, type)
    ),
    "type_counts must include all six incident types",
  );
  assertEquals(clusters[0].typeCounts.otro, 0);
  assertEquals(clusters[0].highestSeverity, "ataque_humano");
});
