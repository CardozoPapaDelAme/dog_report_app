import Jimp from "jimp-compact";
import { sanitizePhotoBytes } from "./photoImage.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

Deno.test("photo sanitizer decodes Uint8Array image bytes", async () => {
  const source = await new Jimp(16, 16, 0xff0000ff);
  const bytes = new Uint8Array(await source.getBufferAsync(Jimp.MIME_PNG));

  const sanitized = await sanitizePhotoBytes({
    bytes,
    declaredMimeType: "image/png",
  });

  assert(sanitized.detectedMimeType === "image/png");
  assert(sanitized.width === 16);
  assert(sanitized.height === 16);
  assert(sanitized.bytes.length > 0);
});
