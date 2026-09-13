import { cookies, headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { initAuth } from "@/auth";
import { getDb, type Database } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { actAsCookieName, parseActAsCookieValue, readActAsFromRequest } from "@/lib/admin-impersonate";
import { isStubSecret } from "@/lib/billing";
import { parseWorkspaceRole, type WorkspaceRole } from "@/lib/permissions";
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
  role: WorkspaceRole;
  impersonating?: boolean;
};

async function resolveActAsWorkspaceId(requestHeaders: Headers, env: CloudflareEnv): Promise<string | null> {
  const secret = env.INTERNAL_ADMIN_SECRET || (process.env.NODE_ENV === "development" ? "dev-admin" : "");
  const auth = requestHeaders.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  const headerActAs = readActAsFromRequest(new Request("https://local", { headers: requestHeaders }));

  if (headerActAs && bearer && secret && (bearer === secret || (secret === "dev-admin" && bearer === "dev-admin"))) {
    return headerActAs;
  }

  if (!secret || (isStubSecret(secret) && secret !== "dev-admin")) return null;
  const jar = await cookies();
  const raw = jar.get(actAsCookieName())?.value;
  return parseActAsCookieValue(raw, secret);
}

export async function getAppContext(): Promise<AppContext | null> {
  try {
    const auth = await initAuth();
    const requestHeaders = await headers();
    const session = await auth.api.getSession({
      headers: requestHeaders,
    });
    if (!session?.user?.id || !session.user.email) {
      return null;
    }

    const db = await getDb();
    await ensureWorkspaceForUser(db, {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
    });

    const { env } = await getCloudflareContext({ async: true });
    const actAsId = await resolveActAsWorkspaceId(requestHeaders, env);

    if (actAsId) {
      const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, actAsId)).limit(1);
      if (workspace) {
        return {
          db,
          user: {
            id: session.user.id,
            name: session.user.name || session.user.email,
            email: session.user.email,
          },
          workspace: {
            id: workspace.id,
            name: workspace.name,
            timezone: workspace.timezone,
          },
          role: "owner",
          impersonating: true,
        };
      }
    }

    const membership = await db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        workspaceName: workspaces.name,
        timezone: workspaces.timezone,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId, session.user.id))
      .orderBy(desc(workspaceMembers.createdAt))
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
      role: parseWorkspaceRole(row.role),
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
