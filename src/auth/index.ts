import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { emailOTP, magicLink } from "better-auth/plugins";
import { getDb } from "@/db";
import { magicLinkEmail, verifyEmail } from "@/emails";
import { logDevEmailOtp, logDevMagicLink } from "@/lib/auth-otp";
import { createAuthSecondaryStorage, isKvLike } from "@/lib/auth-secondary-storage";
import { isEmailBindingReady, sendTransactionalEmail } from "@/lib/email";
import { isForbiddenProductionSecret, isProductionRuntime } from "@/lib/runtime-env";
import { ensureWorkspaceForUser } from "@/lib/workspace";

function isStubValue(value: string | undefined) {
  return !value || value === "stub" || value.startsWith("stub-");
}

async function createAuth() {
  const db = await getDb();
  const { env, cf } = await getCloudflareContext({ async: true });

  const googleLive =
    !isStubValue(env.GOOGLE_CLIENT_ID) && !isStubValue(env.GOOGLE_CLIENT_SECRET);
  const baseURL = (env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  if (isProductionRuntime(env) && isForbiddenProductionSecret(env.BETTER_AUTH_SECRET)) {
    throw new Error("BETTER_AUTH_SECRET must be set to a non-stub value in production.");
  }

  const kv = isKvLike(env.KV) ? env.KV : undefined;

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
        kv: kv as unknown as import("@cloudflare/workers-types").KVNamespace,
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
          requireEmailVerification: true,
        },
        emailVerification: {
          sendOnSignUp: false,
          sendOnSignIn: false,
          autoSignInAfterVerification: true,
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
        socialProviders: googleLive
          ? {
              google: {
                clientId: env.GOOGLE_CLIENT_ID,
                clientSecret: env.GOOGLE_CLIENT_SECRET,
              },
            }
          : {},
        plugins: [
          magicLink({
            sendMagicLink: async ({ email, url }) => {
              logDevMagicLink(email, url, env);
              const mail = magicLinkEmail({ url });
              try {
                await sendTransactionalEmail({
                  env,
                  to: email,
                  subject: mail.subject,
                  html: mail.html,
                  text: mail.text,
                });
              } catch (error) {
                if (isEmailBindingReady(env)) throw error;
              }
            },
          }),
          emailOTP({
            otpLength: 6,
            expiresIn: 300,
            sendVerificationOnSignUp: true,
            overrideDefaultEmailVerification: false,
            sendVerificationOTP: async ({ email, otp }) => {
              logDevEmailOtp(email, otp, env);
              const verifyUrl = `${baseURL}/verify?email=${encodeURIComponent(email)}`;
              const mail = verifyEmail({ otp, url: verifyUrl });
              try {
                await sendTransactionalEmail({
                  env,
                  to: email,
                  subject: mail.subject,
                  html: mail.html,
                  text: mail.text,
                });
              } catch (error) {
                if (isEmailBindingReady(env)) throw error;
              }
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
    secondaryStorage: createAuthSecondaryStorage(kv),
  });
}

export async function initAuth() {
  return createAuth();
}
