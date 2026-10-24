import { createPhotoValidationService } from "./photoValidationService.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fakeSql() {
  const statements = [];
  const tx = (strings, ...values) => {
    statements.push({ text: strings.join("?"), values });
    return Promise.resolve([]);
  };
  return { statements, sql: { begin: (callback) => callback(tx) } };
}

async function rejects(operation, code) {
  try {
    await operation();
  } catch (error) {
    assert(error.code === code, `Expected ${code}, got ${error.code}`);
    return;
  }
  throw new Error(`Expected ${code}`);
}

Deno.test("photo validation service reads in an anonymous transaction and returns numbers", async () => {
  const f = fakeSql();
  const service = createPhotoValidationService({
    getSql: () => f.sql,
    repository: {
      getActivePhotoValidation: () =>
        Promise.resolve({ version: "4", photo_dog_probability_min: "0.350", change_note: "x" }),
    },
  });
  const result = await service.read();
  assert(
    JSON.stringify(result) === JSON.stringify({ version: 4, photo_dog_probability_min: 0.35 }),
    "maps to numeric fields only",
  );
  assert(f.statements.some((s) => s.text.includes("app.role") && s.text.includes("anonymous") || s.values.includes("anonymous") || s.text.includes("'anonymous'")), "sets anonymous role");
});

Deno.test("photo validation service maps missing configuration and connection errors", async () => {
  const f = fakeSql();
  await rejects(
    () =>
      createPhotoValidationService({
        getSql: () => f.sql,
        repository: { getActivePhotoValidation: () => Promise.resolve(null) },
      }).read(),
    "configuration_unavailable",
  );
  await rejects(
    () =>
      createPhotoValidationService({
        getSql: () => ({ begin: () => Promise.reject({ code: "ECONNREFUSED" }) }),
      }).read(),
    "dependency_unavailable",
  );
});
