import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";

export async function ensureWorkspaceForUser(
  db: Database,
  user: { id: string; name?: string | null; email: string },
) {
  const existing = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id))
    .limit(1);

  if (existing[0]) {
    return;
  }

  const workspaceId = crypto.randomUUID();
  const now = new Date();
  const label = user.name?.trim() || user.email.split("@")[0] || "Workspace";

  await db.insert(workspaces).values({
    id: workspaceId,
    name: `${label} workspace`,
    timezone: "America/New_York",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(workspaceMembers).values({
    id: crypto.randomUUID(),
    workspaceId,
    userId: user.id,
    role: "owner",
    createdAt: now,
  });
}
