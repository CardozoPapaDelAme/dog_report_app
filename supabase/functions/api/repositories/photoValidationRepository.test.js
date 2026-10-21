import { getActivePhotoValidation } from "./photoValidationRepository.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

Deno.test("photo validation repository reads only the active version of the deployment environment", async () => {
  let sqlText = "";
  const tx = (strings) => {
    sqlText = strings.join("?");
    return Promise.resolve([{ version: 3, photo_dog_probability_min: "0.250" }]);
  };
  const row = await getActivePhotoValidation(tx);
  assert(row.version === 3, "returns the first row");
  assert(sqlText.includes("c.is_active = TRUE"), "must select the active version");
  assert(sqlText.includes("public.deployment_metadata"), "must join the deployment environment");
  assert(!sqlText.includes("change_note") && !sqlText.includes("created_by"), "no audit fields");
  assert(await getActivePhotoValidation(() => Promise.resolve([])) === null, "null when none");
});
