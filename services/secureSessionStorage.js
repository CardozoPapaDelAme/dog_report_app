const DEFAULT_MAX_ITEM_BYTES = 1500;

function utf8Size(character) {
  const codePoint = character.codePointAt(0);
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

function splitUtf8(value, maxBytes) {
  const chunks = [];
  let chunk = "";
  let chunkBytes = 0;
  for (const character of value) {
    const characterBytes = utf8Size(character);
    if (chunk && chunkBytes + characterBytes > maxBytes) {
      chunks.push(chunk);
      chunk = "";
      chunkBytes = 0;
    }
    chunk += character;
    chunkBytes += characterBytes;
  }
  if (chunk || chunks.length === 0) chunks.push(chunk);
  return chunks;
}

function parseManifest(value) {
  if (!value) return null;
  try {
    const manifest = JSON.parse(value);
    if (
      manifest?.version === 1 &&
      typeof manifest.generation === "string" &&
      Number.isInteger(manifest.count) && manifest.count > 0
    ) return manifest;
  } catch {
    // A damaged manifest is treated as no session.
  }
  return null;
}

function chunkKey(key, generation, index) {
  return `${key}.chunk.${generation}.${index}`;
}

async function removeGeneration(secureStore, key, generation, count) {
  await Promise.all(Array.from({ length: count }, (_, index) =>
    secureStore.deleteItemAsync(chunkKey(key, generation, index))
  ));
}


export function createSecureSessionStorage({
  secureStore,
  maxItemBytes = DEFAULT_MAX_ITEM_BYTES,
  createGeneration = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
}) {
  if (
    typeof secureStore?.getItemAsync !== "function" ||
    typeof secureStore?.setItemAsync !== "function" ||
    typeof secureStore?.deleteItemAsync !== "function"
  ) throw new TypeError("A compatible SecureStore module is required.");
  if (!Number.isInteger(maxItemBytes) || maxItemBytes < 4) {
    throw new TypeError("maxItemBytes must be an integer of at least 4.");
  }

  return Object.freeze({
    async getItem(key) {
      const manifestText = await secureStore.getItemAsync(key);
      if (!manifestText) return null;
      const manifest = parseManifest(manifestText);
      if (!manifest) return null;
      const values = await Promise.all(Array.from(
        { length: manifest.count },
        (_, index) => secureStore.getItemAsync(
          chunkKey(key, manifest.generation, index),
        ),
      ));
      if (values.some((value) => typeof value !== "string")) return null;
      return values.join("");
    },

    async setItem(key, value) {
      if (typeof value !== "string") {
        throw new TypeError("Secure session values must be strings.");
      }
      const previousManifest = parseManifest(await secureStore.getItemAsync(key));
      const generation = createGeneration();
      const chunks = splitUtf8(value, maxItemBytes);
      try {
        for (let index = 0; index < chunks.length; index += 1) {
          await secureStore.setItemAsync(
            chunkKey(key, generation, index),
            chunks[index],
          );
        }
        await secureStore.setItemAsync(key, JSON.stringify({
          version: 1,
          generation,
          count: chunks.length,
        }));
      } catch (error) {
        await removeGeneration(secureStore, key, generation, chunks.length)
          .catch(() => {});
        throw error;
      }
      if (previousManifest && previousManifest.generation !== generation) {
        await removeGeneration(
          secureStore,
          key,
          previousManifest.generation,
          previousManifest.count,
        ).catch(() => {});
      }
    },

    async removeItem(key) {
      const manifestText = await secureStore.getItemAsync(key);
      await secureStore.deleteItemAsync(key);
      const manifest = parseManifest(manifestText);
      if (manifest) {
        await removeGeneration(
          secureStore,
          key,
          manifest.generation,
          manifest.count,
        );
      }
    },
  });
}
