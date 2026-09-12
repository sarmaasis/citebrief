export type StoredObject = {
  key: string;
  bytes: number;
  backend: "r2" | "filesystem" | "memory";
};

const memoryFallback = new Map<string, Uint8Array>();

function toBytes(body: string | Uint8Array): Uint8Array {
  return typeof body === "string" ? new TextEncoder().encode(body) : body;
}

async function putFilesystem(key: string, bytes: Uint8Array): Promise<boolean> {
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const full = path.join(process.cwd(), ".data", "r2", key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
    return true;
  } catch {
    return false;
  }
}

async function getFilesystem(key: string): Promise<Uint8Array | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const full = path.join(process.cwd(), ".data", "r2", key);
    const buf = await readFile(full);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export async function putReportObject(
  env: CloudflareEnv,
  key: string,
  body: string | Uint8Array,
  contentType: string,
): Promise<StoredObject> {
  const bytes = toBytes(body);

  try {
    if (env.R2) {
      await env.R2.put(key, bytes, {
        httpMetadata: { contentType },
      });
      return { key, bytes: bytes.byteLength, backend: "r2" };
    }
  } catch {
    // Fall through for local/dev without R2.
  }

  if (await putFilesystem(key, bytes)) {
    return { key, bytes: bytes.byteLength, backend: "filesystem" };
  }

  memoryFallback.set(key, bytes);
  return { key, bytes: bytes.byteLength, backend: "memory" };
}

export async function getReportObject(env: CloudflareEnv, key: string): Promise<Uint8Array | null> {
  try {
    if (env.R2) {
      const obj = await env.R2.get(key);
      if (obj) {
        return new Uint8Array(await obj.arrayBuffer());
      }
    }
  } catch {
    // Fall through.
  }

  const fromDisk = await getFilesystem(key);
  if (fromDisk) {
    return fromDisk;
  }

  return memoryFallback.get(key) ?? null;
}

export function reportObjectKeys(workspaceId: string, brandId: string, ymd: string) {
  const base = `reports/${workspaceId}/${brandId}/${ymd}`;
  return {
    pdfKey: `${base}.pdf`,
    htmlKey: `${base}.html`,
  };
}
