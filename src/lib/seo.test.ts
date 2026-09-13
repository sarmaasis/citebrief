import assert from "node:assert/strict";
import { PLANS } from "./billing";
import {
  CANONICAL_ORIGIN,
  HOME_DESCRIPTION,
  HOME_TITLE,
  INDEXABLE_PATHS,
  PAGE_COPY,
  PRICING_FAQS,
  ROBOTS_DISALLOW,
  canonicalPath,
  homeJsonLd,
  legalJsonLd,
  pricingJsonLd,
  publicMetadata,
  sitemapEntries,
} from "./seo";

assert.equal(CANONICAL_ORIGIN, "https://getcitebrief.com");
assert.equal(canonicalPath("/"), CANONICAL_ORIGIN);
assert.equal(canonicalPath("/pricing"), "https://getcitebrief.com/pricing");
assert.equal(canonicalPath("/legal/privacy/"), "https://getcitebrief.com/legal/privacy");

assert.deepEqual([...INDEXABLE_PATHS], ["/", "/pricing", "/report", "/legal/privacy", "/legal/terms"]);
assert.ok(!INDEXABLE_PATHS.includes("/login" as (typeof INDEXABLE_PATHS)[number]));
assert.ok(!INDEXABLE_PATHS.includes("/signup" as (typeof INDEXABLE_PATHS)[number]));
assert.ok(!INDEXABLE_PATHS.includes("/alternatives/otterly" as (typeof INDEXABLE_PATHS)[number]));
assert.ok(!INDEXABLE_PATHS.includes("/for-seo-agencies" as (typeof INDEXABLE_PATHS)[number]));

assert.deepEqual([...ROBOTS_DISALLOW], ["/app/", "/api/", "/r/", "/invite/"]);

const urls = sitemapEntries().map((entry) => entry.url);
assert.deepEqual(urls, INDEXABLE_PATHS.map((path) => canonicalPath(path)));
assert.equal(
  sitemapEntries().every((entry) => entry.url.startsWith(CANONICAL_ORIGIN)),
  true,
);

assert.match(HOME_TITLE, /CiteBrief/);
assert.match(HOME_TITLE, /Friday PDF/);
assert.doesNotMatch(HOME_TITLE, /GEO|AEO|Peec|Profound|keyword tracker/i);
assert.match(HOME_DESCRIPTION, /ChatGPT/);
assert.match(HOME_DESCRIPTION, /Perplexity/);
assert.match(HOME_DESCRIPTION, /Gemini/);
assert.match(HOME_DESCRIPTION, /AI Overviews/);

const titles = [
  PAGE_COPY.home.title,
  `${PAGE_COPY.pricing.title} · CiteBrief`,
  `${PAGE_COPY.report.title} · CiteBrief`,
  `${PAGE_COPY.privacy.title} · CiteBrief`,
  `${PAGE_COPY.terms.title} · CiteBrief`,
];
assert.equal(new Set(titles).size, titles.length);
assert.equal(PRICING_FAQS.length, 6);
assert.ok(PRICING_FAQS.some((item) => item.q === "Can I pay annually?"));

const descriptions = [
  PAGE_COPY.home.description,
  PAGE_COPY.pricing.description,
  PAGE_COPY.report.description,
  PAGE_COPY.privacy.description,
  PAGE_COPY.terms.description,
];
assert.equal(new Set(descriptions).size, descriptions.length);

const homeMeta = publicMetadata(PAGE_COPY.home);
assert.equal((homeMeta.alternates as { canonical: string }).canonical, CANONICAL_ORIGIN);
assert.equal((homeMeta.openGraph as { url: string }).url, CANONICAL_ORIGIN);

const pricingMeta = publicMetadata(PAGE_COPY.pricing);
assert.equal((pricingMeta.alternates as { canonical: string }).canonical, `${CANONICAL_ORIGIN}/pricing`);
assert.match(String(pricingMeta.description), /149/);
assert.match(String(pricingMeta.description), /249/);
assert.match(String(pricingMeta.description), /499/);

const graph = homeJsonLd()["@graph"] as Array<{ "@type": string; offers?: { name: string; price: string }[] }>;
assert.equal(graph.some((node) => node["@type"] === "Organization"), true);
assert.equal(graph.some((node) => node["@type"] === "WebSite"), true);
assert.equal(graph.some((node) => node["@type"] === "SoftwareApplication"), true);

const app = graph.find((node) => node["@type"] === "SoftwareApplication");
assert.ok(app?.offers);
assert.equal(app.offers.length, 3);
assert.deepEqual(
  app.offers.map((offer) => offer.price).sort(),
  [String(PLANS.agency.amountUsd), String(PLANS.starter.amountUsd), String(PLANS.studio.amountUsd)].sort(),
);

const faq = (pricingJsonLd()["@graph"] as Array<{ "@type": string; mainEntity?: { name: string }[] }>).find(
  (node) => node["@type"] === "FAQPage",
);
assert.ok(faq?.mainEntity);
assert.equal(faq.mainEntity.length, PRICING_FAQS.length);
assert.equal(
  faq.mainEntity.every((entity, index) => entity.name === PRICING_FAQS[index].q),
  true,
);

const privacy = legalJsonLd("privacy");
assert.equal(
  privacy["@graph"].some((node) => node["@type"] === "BreadcrumbList"),
  true,
);

console.log("seo.test.ts ok");
