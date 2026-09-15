import { cache } from "react";
import { cookies, headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { initAuth } from "@/auth";
import { getDb, type Database } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { actAsCookieName, parseActAsCookieValue, readActAsFromRequest } from "@/lib/admin-impersonate";
import { isVerifiedAuthUser } from "@/lib/auth-access";
import { parseWorkspaceRole, type WorkspaceRole } from "@/lib/permissions";
import { isForbiddenProductionSecret, isProductionRuntime } from "@/lib/runtime-env";
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

function adminActAsSecret(env: CloudflareEnv): string | null {
  const configured = env.INTERNAL_ADMIN_SECRET?.trim();
  if (isProductionRuntime(env)) {
    if (isForbiddenProductionSecret(configured)) return null;
    return configured ?? null;
  }
  if (configured && !isForbiddenProductionSecret(configured)) return configured;
  return "dev-admin";
}

async function resolveActAsWorkspaceId(requestHeaders: Headers, env: CloudflareEnv): Promise<string | null> {
  const secret = adminActAsSecret(env);
  if (!secret) return null;
  const auth = requestHeaders.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  const headerActAs = readActAsFromRequest(new Request("https://local", { headers: requestHeaders }));

  if (headerActAs && bearer && bearer === secret) {
    return headerActAs;
  }

  const jar = await cookies();
  const raw = jar.get(actAsCookieName())?.value;
  return parseActAsCookieValue(raw, secret);
}

export type MarketingAuth = {
  signedIn: boolean;
  /** Signed-in CTA target (workspace home; empty state covers onboarding). */
  appHref: "/app" | "/app/onboarding";
};

/**
 * Request-scoped session for marketing chrome. Cookie/session only — no D1
 * membership/brand lookups (those were doubling marketing TTFB). `/app` empty
 * state already steers brandless workspaces to onboarding.
 */
export const getMarketingAuth = cache(async (): Promise<MarketingAuth> => {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id || !session.user.email || !isVerifiedAuthUser(session.user)) {
      return { signedIn: false, appHref: "/app" };
    }
    return { signedIn: true, appHref: "/app" };
  } catch {
    return { signedIn: false, appHref: "/app" };
  }
});

/** One Better Auth session read per request (layout + pages share this). */
const getAuthSession = cache(async () => {
  const auth = await initAuth();
  return auth.api.getSession({
    headers: await headers(),
  });
});

/** Unverified cookie: send the user to `/verify`, not `/app`. */
export const getUnverifiedSessionEmail = cache(async (): Promise<string | null> => {
  try {
    const session = await getAuthSession();
    if (session?.user?.email && !isVerifiedAuthUser(session.user)) {
      return session.user.email;
    }
    return null;
  } catch {
    return null;
  }
});

/** Request-scoped: workspace layout + page both call this; must not double-hit D1/auth. */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  try {
    const requestHeaders = await headers();
    const session = await getAuthSession();
    if (!session?.user?.id || !session.user.email || !isVerifiedAuthUser(session.user)) {
      return null;
    }

    const db = await getDb();
    const user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
    };

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

    const loadMembership = () =>
      db
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

    let membership = await loadMembership();
    if (!membership[0]) {
      // First verified login only — skip ensureWorkspace on every nav when membership exists.
      await ensureWorkspaceForUser(db, user);
      membership = await loadMembership();
    }

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
});

export async function requireAppContext(): Promise<AppContext> {
  const ctx = await getAppContext();
  if (!ctx) {
    throw new Error("Sign in required.");
  }
  return ctx;
}
