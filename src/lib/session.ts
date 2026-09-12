import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { initAuth } from "@/auth";
import { getDb, type Database } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { ensureWorkspaceForUser } from "@/lib/workspace";

export type AppUser = {
  id: string;
  name: string;
  email: string;
};

export type AppWorkspace = {
  id: string;
  name: string;
  timezone: string;
};

export type AppContext = {
  db: Database;
  user: AppUser;
  workspace: AppWorkspace;
};

export async function getAppContext(): Promise<AppContext | null> {
  try {
    const auth = await initAuth();
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id || !session.user.email) {
      return null;
    }

    const db = await getDb();
    await ensureWorkspaceForUser(db, session.user);

    const membership = await db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        workspaceName: workspaces.name,
        timezone: workspaces.timezone,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId, session.user.id))
      .limit(1);

    const row = membership[0];
    if (!row) {
      return null;
    }

    return {
      db,
      user: {
        id: session.user.id,
        name: session.user.name || session.user.email,
        email: session.user.email,
      },
      workspace: {
        id: row.workspaceId,
        name: row.workspaceName,
        timezone: row.timezone,
      },
    };
  } catch {
    return null;
  }
}

export async function requireAppContext(): Promise<AppContext> {
  const ctx = await getAppContext();
  if (!ctx) {
    throw new Error("Sign in required.");
  }
  return ctx;
}
