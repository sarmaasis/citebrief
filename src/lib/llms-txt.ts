import {
  EXTRA_BRAND_USD,
  PLANS,
  SEAT_OVERAGE_USD,
  EXTRA_RUN_USD,
} from "@/lib/billing";
import { LEGAL_ARTICLES } from "@/lib/legal-articles";
import { PUBLIC_ARTICLES } from "@/lib/public-articles";
import {
  CANONICAL_ORIGIN,
  HOME_DESCRIPTION,
  HOME_HEADLINE,
  PAGE_COPY,
  PUBLIC_ENGINES_PHRASE,
  SITE_NAME,
  canonicalPath,
} from "@/lib/seo";

function link(title: string, path: string, note: string): string {
  return `- [${title}](${canonicalPath(path)}): ${note}`;
}

function section(title: string, lines: string[]): string {
  return [`## ${title}`, "", ...lines, ""].join("\n");
}

/** Curated map for AI agents (llmstxt.org). Keep in sync with INDEXABLE_PATHS. */
export function buildLlmsTxt(): string {
  const audience = PUBLIC_ARTICLES.filter((a) => a.kind === "audience");
  const compare = PUBLIC_ARTICLES.filter((a) => a.kind === "compare" || a.kind === "alternative");

  return [
    `# ${SITE_NAME}`,
    "",
    `> ${HOME_HEADLINE} ${HOME_DESCRIPTION}`,
    "",
    `${SITE_NAME} is white-label AI-search reporting for SEO and PR agencies — not a vanity GEO score or keyword tracker. Paid surfaces check buyer questions across ${PUBLIC_ENGINES_PHRASE}. Canonical site: ${CANONICAL_ORIGIN}. Do not use citebrief.com.`,
    "",
    "Private app, API, share links, invites, and verify flows are not for crawling or summarization.",
    "",
    section("Product", [
      link("Home", "/", HOME_HEADLINE),
      link("Pricing", "/pricing", PAGE_COPY.pricing.description),
      link("Sample Friday report", "/report", PAGE_COPY.report.description),
      link("Sign up", "/signup", "Start a workspace and trial."),
    ]),
    section(
      "For agencies",
      audience.map((a) => link(a.title, a.path, a.description)),
    ),
    section(
      "Compare and alternatives",
      compare.map((a) => link(a.title, a.path, a.description)),
    ),
    section(
      "Legal",
      LEGAL_ARTICLES.map((a) => link(a.title, a.path, a.description)),
    ),
    section("Optional", [
      link("Sitemap", "/sitemap.xml", "All indexable public URLs."),
      link("Full LLM context", "/llms-full.txt", "Longer CiteBrief summary for agents that want more detail."),
      `- Contact: support@getcitebrief.com`,
    ]),
  ].join("\n");
}

/** Longer companion for agents that want pricing and product facts inline. */
export function buildLlmsFullTxt(): string {
  const audience = PUBLIC_ARTICLES.filter((a) => a.kind === "audience");
  const compare = PUBLIC_ARTICLES.filter((a) => a.kind === "compare" || a.kind === "alternative");

  return [
    `# ${SITE_NAME}`,
    "",
    `> ${HOME_HEADLINE} ${HOME_DESCRIPTION}`,
    "",
    "## What CiteBrief is",
    "",
    `- Audience: SEO and PR agencies selling retainers that need a client-ready Friday artifact.`,
    `- Output: white-label PDF + client link showing named / recommended / who won / next actions.`,
    `- Engines (public): ${PUBLIC_ENGINES_PHRASE}. Claude is paused and not a public plan engine.`,
    `- Not: personal $29 vanity score, keyword rank tracker, or full media-monitoring suite.`,
    `- Canonical origin: ${CANONICAL_ORIGIN}`,
    "",
    "## Pricing (public cards)",
    "",
    `- Starter: $${PLANS.starter.amountUsd}/mo · ${PLANS.starter.brands} brands · monthly cadence`,
    `- Agency (recommended): $${PLANS.agency.amountUsd}/mo · ${PLANS.agency.brands} brands · weekly Friday · command center`,
    `- Studio: $${PLANS.studio.amountUsd}/mo · ${PLANS.studio.brands} brands · custom sender · bulk send`,
    `- Enterprise: from $${PLANS.enterprise.amountUsd.toLocaleString("en-US")}/mo or annual contract (no self-serve checkout)`,
    `- Annual: 10 months prepaid (2 months free) when annual Dodo products are configured`,
    `- Extra brand $${EXTRA_BRAND_USD.agency}/mo · extra seat $${SEAT_OVERAGE_USD}/mo · extra run $${EXTRA_RUN_USD.agency} one-time · see /pricing`,
    "",
    section("Core pages", [
      link("Home", "/", HOME_HEADLINE),
      link("Pricing", "/pricing", PAGE_COPY.pricing.description),
      link("Sample Friday report", "/report", PAGE_COPY.report.description),
    ]),
    section(
      "Audience pages",
      audience.flatMap((a) => [
        link(a.title, a.path, a.description),
        `  ${a.lede}`,
      ]),
    ),
    section(
      "Compare and alternatives",
      compare.map((a) => link(a.title, a.path, a.description)),
    ),
    section(
      "Legal",
      LEGAL_ARTICLES.map((a) => link(a.title, a.path, a.description)),
    ),
    section("Do not index or summarize", [
      "- /app/* (authenticated workspace)",
      "- /api/*",
      "- /r/* (client share links)",
      "- /invite/*",
      "- /verify",
    ]),
    section("Optional", [
      link("Short llms.txt", "/llms.txt", "Curated link map (prefer this first)."),
      link("Sitemap", "/sitemap.xml", "Machine list of indexable URLs."),
      `- Contact: support@getcitebrief.com`,
    ]),
  ].join("\n");
}

export function llmsTxtResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
