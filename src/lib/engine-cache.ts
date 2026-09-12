import { and, eq, gt } from "drizzle-orm";
import type { Database } from "@/db";
import { engineCache } from "@/db/schema";
import type { EngineId } from "@/lib/engines";
import type { ExtractedRow } from "@/lib/extractor";

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildCacheKey(engine: EngineId, promptText: string): string {
  return `${engine}:${promptText.trim().toLowerCase()}`;
}

export async function readEngineCache(db: Database, engine: EngineId, promptText: string) {
  const cacheKey = buildCacheKey(engine, promptText);
  const now = new Date();
  const [row] = await db
    .select()
    .from(engineCache)
    .where(and(eq(engineCache.cacheKey, cacheKey), gt(engineCache.expiresAt, now)))
    .limit(1);
  if (!row) {
    return null;
  }
  let extracted: ExtractedRow | null = null;
  if (row.extractedJson) {
    try {
      extracted = JSON.parse(row.extractedJson) as ExtractedRow;
    } catch {
      extracted = null;
    }
  }
  return { rawAnswer: row.rawAnswer, extracted };
}

export async function writeEngineCache(
  db: Database,
  args: {
    engine: EngineId;
    promptText: string;
    rawAnswer: string;
    extracted: ExtractedRow;
  },
) {
  const now = new Date();
  const cacheKey = buildCacheKey(args.engine, args.promptText);
  const id = crypto.randomUUID();
  try {
    await db.insert(engineCache).values({
      id,
      cacheKey,
      engine: args.engine,
      promptText: args.promptText,
      rawAnswer: args.rawAnswer,
      extractedJson: JSON.stringify(args.extracted),
      createdAt: now,
      expiresAt: new Date(now.getTime() + DAY_MS),
    });
  } catch {
    // Unique race: ignore; cache is best-effort.
  }
}
