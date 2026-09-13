import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { magicLink } from "better-auth/plugins";
import { getDb } from "@/db";
import { magicLinkEmail, verifyEmail } from "@/emails";
import { isEmailBindingReady, sendTransactionalEmail } from "@/lib/email";
import { isForbiddenProductionSecret, isProductionRuntime } from "@/lib/runtime-env";
import { ensureWorkspaceForUser } from "@/lib/workspace";

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
  const baseURL = (env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  if (isProductionRuntime(env) && isForbiddenProductionSecret(env.BETTER_AUTH_SECRET)) {
    throw new Error("BETTER_AUTH_SECRET must be set to a non-stub value in production.");
  }

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
        rateLimit: {
          enabled: true,
          window: 60,
          max: 20,
        },
        baseURL,
        trustedOrigins: [baseURL],
        // Same-origin marketing (`/`) and app (`/app`) must share the session cookie.
        advanced: {
          useSecureCookies: baseURL.startsWith("https://"),
          defaultCookieAttributes: {
            path: "/",
            sameSite: "lax",
            httpOnly: true,
            secure: baseURL.startsWith("https://"),
          },
        },
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: isProductionRuntime(env) || isEmailBindingReady(env),
        },
        emailVerification: {
          sendOnSignUp: true,
          sendVerificationEmail: async ({ user, url }) => {
            const mail = verifyEmail({ url });
            await sendTransactionalEmail({
              env,
              to: user.email,
              subject: mail.subject,
              html: mail.html,
              text: mail.text,
            });
          },
        },
        socialProviders: {
          google,
        },
        plugins: [
          magicLink({
            sendMagicLink: async ({ email, url }) => {
              const mail = magicLinkEmail({ url });
              await sendTransactionalEmail({
                env,
                to: email,
                subject: mail.subject,
                html: mail.html,
                text: mail.text,
              });
            },
          }),
        ],
        databaseHooks: {
          user: {
            create: {
              after: async (user) => {
                await ensureWorkspaceForUser(db, {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  emailVerified: user.emailVerified,
                });
              },
            },
            update: {
              after: async (user) => {
                await ensureWorkspaceForUser(db, {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  emailVerified: user.emailVerified,
                });
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
