import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { magicLink } from "better-auth/plugins";
import { getDb } from "@/db";
import { ensureWorkspaceForUser } from "@/lib/workspace";
import { sendTransactionalEmail } from "@/lib/email";

function isStubValue(value: string | undefined) {
  return !value || value === "stub" || value.startsWith("stub-");
}

async function createAuth() {
  const db = await getDb();
  const { env, cf } = await getCloudflareContext({ async: true });

  const google =
    !isStubValue(env.GOOGLE_CLIENT_ID) && !isStubValue(env.GOOGLE_CLIENT_SECRET)
      ? {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        }
      : {
          clientId: env.GOOGLE_CLIENT_ID || "stub-google-client-id",
          clientSecret: env.GOOGLE_CLIENT_SECRET || "stub-google-client-secret",
        };

  return betterAuth({
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: true,
        cf,
        d1: {
          db,
          options: {
            usePlural: true,
            debugLogs: false,
          },
        },
        kv: env.KV as unknown as import("@cloudflare/workers-types").KVNamespace,
      },
      {
        appName: "CiteBrief",
        secret: env.BETTER_AUTH_SECRET || "dev-only-replace-with-BETTER_AUTH_SECRET",
        baseURL: env.BETTER_AUTH_URL || "http://localhost:3000",
        trustedOrigins: (env.BETTER_AUTH_TRUSTED_ORIGINS ?? env.BETTER_AUTH_URL ?? "")
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
        emailAndPassword: {
          enabled: true,
        },
        socialProviders: {
          google,
        },
        plugins: [
          magicLink({
            sendMagicLink: async ({ email, url }) => {
              await sendTransactionalEmail({
                env,
                to: email,
                subject: "Sign in to CiteBrief",
                html: `<p>Use this link to sign in to CiteBrief.</p><p><a href="${url}">Open magic link</a></p>`,
              });
            },
          }),
        ],
        databaseHooks: {
          user: {
            create: {
              after: async (user) => {
                await ensureWorkspaceForUser(db, user);
              },
            },
          },
        },
      },
    ),
  });
}

export async function initAuth() {
  return createAuth();
}
