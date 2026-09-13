// Optional CLI config. drizzle-kit is not a runtime dependency (esbuild advisory
// GHSA-67mh-4wv8-2f99 via deprecated @esbuild-kit). Install it locally to generate.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
});
