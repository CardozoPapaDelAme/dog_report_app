import {
  parseAssociationCursor,
  parseAssociationLimit,
  parseAssociationQuery,
  parseAssociationTimestamp,
} from "./associationController.js";

function assertEquals(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

Deno.test("association query accepts optional dates and limits results from 1 to 5000", () => {
  assertEquals(parseAssociationLimit(undefined), 100);
  assertEquals(parseAssociationLimit("1"), 1);
  assertEquals(parseAssociationLimit("5000"), 5000);
  assertEquals(parseAssociationLimit("0"), null);
  assertEquals(parseAssociationLimit("5001"), null);
  assertEquals(parseAssociationLimit("1.5"), null);
  assertEquals(
    parseAssociationTimestamp("2026-09-01T00:00:00-06:00"),
    "2026-09-01T06:00:00.000Z",
  );
});

Deno.test("association query rejects malformed or reversed date ranges", () => {
  assertEquals(parseAssociationTimestamp("2026-09-01"), undefined);
  assertEquals(
    parseAssociationQuery({
      from: "2026-09-02T00:00:00Z",
      to: "2026-09-01T00:00:00Z",
      limit: "20",
    }).ok,
    false,
  );
});

Deno.test("association cursor round trips an accepted timestamp and report id", () => {
  const cursor = btoa(
    "2026-09-01T00:00:00.000Z|11111111-1111-4111-8111-111111111111",
  )
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  assertEquals(parseAssociationCursor(cursor), {
    acceptedAt: "2026-09-01T00:00:00.000Z",
    id: "11111111-1111-4111-8111-111111111111",
  });
  assertEquals(parseAssociationCursor("not-a-cursor"), undefined);
});
