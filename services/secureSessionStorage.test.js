import test from "node:test";
import assert from "node:assert/strict";

import { createSecureSessionStorage } from "./secureSessionStorage.js";

function createStore({ failOnKey = null } = {}) {
  const values = new Map();
  return {
    values,
    async getItemAsync(key) { return values.get(key) ?? null; },
    async setItemAsync(key, value) {
      if (key === failOnKey) throw new Error("write failed");
      values.set(key, value);
    },
    async deleteItemAsync(key) { values.delete(key); },
  };
}

test("secure storage reads and writes large Unicode values in bounded chunks", async () => {
  const secureStore = createStore();
  let generation = 0;
  const storage = createSecureSessionStorage({
    secureStore,
    maxItemBytes: 8,
    createGeneration: () => `generation-${++generation}`,
  });
  const value = "refresh-token-😀-".repeat(12);

  await storage.setItem("supabase.auth.token", value);

  assert.equal(await storage.getItem("supabase.auth.token"), value);
  for (const [key, item] of secureStore.values) {
    if (key.includes(".chunk.")) {
      assert.ok(Buffer.byteLength(item, "utf8") <= 8);
    }
  }
});

test("failed replacement preserves the previous session", async () => {
  const secureStore = createStore();
  let generation = 0;
  const storage = createSecureSessionStorage({
    secureStore,
    maxItemBytes: 8,
    createGeneration: () => `generation-${++generation}`,
  });
  await storage.setItem("auth", "old session");
  const manifest = secureStore.values.get("auth");
  secureStore.setItemAsync = async (key, value) => {
    if (key === "auth") throw new Error("manifest write failed");
    secureStore.values.set(key, value);
  };

  await assert.rejects(storage.setItem("auth", "new session"), /manifest write failed/);
  assert.equal(secureStore.values.get("auth"), manifest);
  assert.equal(await storage.getItem("auth"), "old session");
});

test("remove clears the manifest and its chunks", async () => {
  const secureStore = createStore();
  const storage = createSecureSessionStorage({
    secureStore,
    createGeneration: () => "generation",
  });
  await storage.setItem("auth", "session");

  await storage.removeItem("auth");

  assert.equal(await storage.getItem("auth"), null);
  assert.equal(secureStore.values.size, 0);
});

test("corrupt or incomplete manifests fail closed", async () => {
  const secureStore = createStore();
  const storage = createSecureSessionStorage({ secureStore });
  secureStore.values.set("bad", "not-json");
  secureStore.values.set("partial", JSON.stringify({
    version: 1,
    generation: "missing",
    count: 2,
  }));

  assert.equal(await storage.getItem("bad"), null);
  assert.equal(await storage.getItem("partial"), null);
});
