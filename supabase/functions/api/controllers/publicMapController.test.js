import { Hono } from "hono";

import {
  createPublicMapController,
  parsePublicClustersQuery,
  parsePublicReportsQuery,
} from "./publicMapController.js";

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

Deno.test("public reports query applies defaults and validates timestamps", () => {
  assertEquals(parsePublicReportsQuery({}), {
    ok: true,
    value: { since: null, limit: 100 },
  });
  assertEquals(parsePublicReportsQuery({ limit: "1000" }).value.limit, 1000);
  assertEquals(
    parsePublicReportsQuery({ since: "2026-09-01T00:00:00-06:00" }).value
      .since,
    "2026-09-01T06:00:00.000Z",
  );
  assert(parsePublicReportsQuery({ limit: "1001" }).ok === false, "max 1000");
  assert(
    parsePublicReportsQuery({ since: "2026-09-01" }).ok === false,
    "timezone is required",
  );
  assert(
    parsePublicReportsQuery({ unexpected: "1" }).ok === false,
    "unknown query keys are rejected",
  );
});

Deno.test("public clusters query validates zoom, viewport and default limit", () => {
  assertEquals(parsePublicClustersQuery({ zoom: "9" }), {
    ok: true,
    value: { zoom: 9, limit: 2000, viewport: null },
  });
  assertEquals(
    parsePublicClustersQuery({
      zoom: "17",
      limit: "5000",
      min_longitude: "-107.7",
      min_latitude: "27.7",
      max_longitude: "-107.5",
      max_latitude: "27.9",
    }).value,
    {
      zoom: 17,
      limit: 5000,
      viewport: {
        minLongitude: -107.7,
        minLatitude: 27.7,
        maxLongitude: -107.5,
        maxLatitude: 27.9,
      },
    },
  );
  assert(parsePublicClustersQuery({}).ok === false, "zoom is required");
  assert(parsePublicClustersQuery({ zoom: "23" }).ok === false, "max zoom");
  assert(
    parsePublicClustersQuery({ zoom: "12", min_longitude: "-107.7" }).ok ===
      false,
    "viewport is all-or-nothing",
  );
});

Deno.test("public map controller rejects malformed query before service call", async () => {
  let calls = 0;
  const controller = createPublicMapController({
    listReports: () => {
      calls += 1;
      return [];
    },
    listClusters: () => {
      calls += 1;
      return [];
    },
  });
  const app = new Hono();
  app.get("/public/reports", controller.reports);
  app.get("/public/clusters", controller.clusters);

  const reportsResponse = await app.request("/public/reports?limit=1001");
  const clustersResponse = await app.request("/public/clusters?zoom=12&limit=5001");

  assert(reportsResponse.status === 400, "invalid report query should be 400");
  assert(clustersResponse.status === 400, "invalid cluster query should be 400");
  assert(calls === 0, "invalid requests must not reach the service");
});
