import assert from "node:assert/strict";
import {
  createAuthSecondaryStorage,
  incrementCounterSnapshot,
  isKvLike,
  parseIncrementValue,
} from "./auth-secondary-storage";

assert.equal(isKvLike(undefined), false);
assert.equal(isKvLike({}), false);
assert.equal(
  isKvLike({
    get: async () => null,
    put: async () => undefined,
    delete: async () => undefined,
  }),
  true,
);

const now = 1_700_000_000_000;
const first = incrementCounterSnapshot(null, 10, now);
assert.equal(first.n, 1);
assert.equal(first.exp, now + 10_000);
const second = incrementCounterSnapshot(first, 10, now + 1_000);
assert.equal(second.n, 2);
assert.equal(second.exp, first.exp);
const rolled = incrementCounterSnapshot(first, 10, first.exp);
assert.equal(rolled.n, 1);
assert.equal(rolled.exp, first.exp + 10_000);

assert.equal(parseIncrementValue(null, now), null);
assert.deepEqual(parseIncrementValue(JSON.stringify({ n: 3, exp: now + 5_000 }), now), { n: 3, exp: now + 5_000 });
assert.equal(parseIncrementValue(JSON.stringify({ n: 3, exp: now }), now), null);

function memoryKv() {
  const data = new Map<string, { value: string; exp?: number }>();
  return {
    async get(key: string) {
      const row = data.get(key);
      if (!row) return null;
      if (row.exp && Date.now() >= row.exp) {
        data.delete(key);
        return null;
      }
      return row.value;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      data.set(key, {
        value,
        exp: options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined,
      });
    },
    async delete(key: string) {
      data.delete(key);
    },
  };
}

async function run() {
  const memory = createAuthSecondaryStorage(undefined, { memory: new Map() });
  assert.equal(await memory.increment("rl:a", 60), 1);
  assert.equal(await memory.increment("rl:a", 60), 2);
  assert.equal(await memory.increment("rl:a", 60), 3);
  assert.equal(await memory.get("missing"), null);
  await memory.set("sess", "token", 60);
  assert.equal(await memory.get("sess"), "token");
  assert.equal(await memory.getAndDelete("sess"), "token");
  assert.equal(await memory.get("sess"), null);

  const kvStore = createAuthSecondaryStorage(memoryKv());
  assert.equal(await kvStore.increment("rl:b", 60), 1);
  assert.equal(await kvStore.increment("rl:b", 60), 2);
  await kvStore.set("k", "v", 60);
  assert.equal(await kvStore.get("k"), "v");
  await kvStore.delete("k");
  assert.equal(await kvStore.get("k"), null);
}

run()
  .then(() => {
    console.log("auth-secondary-storage.test.ts ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
