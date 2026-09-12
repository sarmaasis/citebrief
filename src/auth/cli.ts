import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { magicLink } from "better-auth/plugins";

/**
 * Schema-only Better Auth config for the CLI.
 * Runtime auth is created per request in `initAuth()` so D1 is never a global binding.
 */
export const auth = betterAuth({
  ...withCloudflare(
    {
      autoDetectIpAddress: true,
      geolocationTracking: true,
      cf: {},
    },
    {
      secret: "cli-schema-only-not-for-runtime",
      baseURL: "https://getcitebrief.com",
      emailAndPassword: { enabled: true },
      socialProviders: {
        google: {
          clientId: "stub-google-client-id",
          clientSecret: "stub-google-client-secret",
        },
      },
      plugins: [
        magicLink({
          sendMagicLink: async () => undefined,
        }),
      ],
    },
  ),
  database: drizzleAdapter({} as D1Database, {
    provider: "sqlite",
    usePlural: true,
  }),
  advanced: { database: { validateSchema: false } },
});
