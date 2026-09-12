import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "./schema";

export function dbFromEnv(env: CloudflareEnv) {
  return drizzle(env.DB, { schema });
}

export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  return dbFromEnv(env);
}

export type Database = ReturnType<typeof dbFromEnv>;
