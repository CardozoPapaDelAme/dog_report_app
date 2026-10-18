import {
  assertAssociationActor,
  paginateAssociationRows,
} from "./associationService.js";

function assertThrowsForbidden(actor) {
  try {
    assertAssociationActor(actor);
  } catch (error) {
    if (error?.code === "forbidden") return;
    throw error;
  }
  throw new Error("Expected association authorization to fail");
}

Deno.test("association service accepts the association and administrator roles only", () => {
  assertAssociationActor({ type: "authenticated", role: "association" });
  assertAssociationActor({ type: "authenticated", role: "administrator" });
  assertThrowsForbidden({ type: "authenticated", role: "internal" });
  assertThrowsForbidden({ type: "anonymous" });
});

Deno.test("association service builds a page from the extra repository row", () => {
  const page = paginateAssociationRows(
    [{ id: "a" }, { id: "b" }, { id: "c" }],
    2,
  );
  if (!page.hasMore || page.rows.length !== 2 || page.rows[1].id !== "b") {
    throw new Error(
      "service should trim the extra row and retain next-page state",
    );
  }
});
