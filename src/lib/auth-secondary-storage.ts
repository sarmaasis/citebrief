export type AuthSecondaryStorage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
  getAndDelete: (key: string) => Promise<string | null>;
  increment: (key: string, ttl: number) => Promise<number>;
};

export type KvLike = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

type MemoryEntry = {
  value: string;
  expiresAt: number | null;
};

/** Process-local fallback for `next dev` when KV is unbound. */
const processMemory = new Map<string, MemoryEntry>();

export function isKvLike(value: unknown): value is KvLike {
  if (!value || typeof value !== "object") return false;
  const kv = value as Record<string, unknown>;
  return typeof kv.get === "function" && typeof kv.put === "function" && typeof kv.delete === "function";
}

export function incrementCounterSnapshot(
  current: { n: number; exp: number } | null,
  ttlSeconds: number,
  now = Date.now(),
): { n: number; exp: number } {
  const ttlMs = Math.max(1, Math.floor(ttlSeconds)) * 1000;
  if (!current || now >= current.exp) {
    return { n: 1, exp: now + ttlMs };
  }
  return { n: current.n + 1, exp: current.exp };
}

export function parseIncrementValue(raw: string | null, now = Date.now()): { n: number; exp: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { n?: unknown; exp?: unknown };
    if (
      typeof parsed.n === "number" &&
      typeof parsed.exp === "number" &&
      Number.isFinite(parsed.n) &&
      Number.isFinite(parsed.exp)
    ) {
      if (now >= parsed.exp) return null;
      return { n: parsed.n, exp: parsed.exp };
    }
  } catch {
    const n = Number(raw);
    if (Number.isFinite(n)) return { n, exp: now + 60_000 };
  }
  return null;
}

function pruneMemory(memory: Map<string, MemoryEntry>, now: number) {
  for (const [key, entry] of memory) {
    if (entry.expiresAt !== null && now >= entry.expiresAt) memory.delete(key);
  }
}

/**
 * Better Auth secondary storage with `increment` (required for rate limiting).
 * Uses KV when bound; otherwise an in-memory Map so local `next dev` does not 500.
 */
export function createAuthSecondaryStorage(
  kv?: unknown,
  options?: { memory?: Map<string, MemoryEntry> },
): AuthSecondaryStorage {
  const store = isKvLike(kv) ? kv : null;
  const memory = options?.memory ?? processMemory;

  async function get(key: string): Promise<string | null> {
    if (store) {
      const value = await store.get(key);
      return value == null ? null : String(value);
    }
    const now = Date.now();
    pruneMemory(memory, now);
    return memory.get(key)?.value ?? null;
  }

  async function set(key: string, value: string, ttl?: number) {
    if (store) {
      if (ttl === undefined) {
        await store.put(key, value);
        return;
      }
      await store.put(key, value, { expirationTtl: Math.max(60, Math.ceil(ttl)) });
      return;
    }
    memory.set(key, {
      value,
      expiresAt: ttl === undefined ? null : Date.now() + Math.max(1, ttl) * 1000,
    });
  }

  async function remove(key: string) {
    if (store) {
      await store.delete(key);
      return;
    }
    memory.delete(key);
  }

  return {
    get,
    set,
    delete: remove,
    getAndDelete: async (key) => {
      const value = await get(key);
      if (value != null) await remove(key);
      return value;
    },
    increment: async (key, ttl) => {
      const now = Date.now();
      const next = incrementCounterSnapshot(parseIncrementValue(await get(key), now), ttl, now);
      const remainingSec = Math.max(1, Math.ceil((next.exp - now) / 1000));
      await set(key, JSON.stringify({ n: next.n, exp: next.exp }), remainingSec);
      return next.n;
    },
  };
}
