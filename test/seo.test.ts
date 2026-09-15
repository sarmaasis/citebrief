import assert from "node:assert/strict";
import { PLANS, TRIAL_PROMPT_CAP } from "@/lib/billing";
import { LEGAL_ARTICLES } from "@/lib/legal-articles";
import { PUBLIC_ARTICLES } from "@/lib/public-articles";
import {
  CANONICAL_ORIGIN,
  HOME_DESCRIPTION,
  HOME_TITLE,
  INDEXABLE_PATHS,
  PAGE_COPY,
  PRICING_FAQS,
  PUBLIC_ENGINE_LABELS,
  PUBLIC_ENGINES_PHRASE,
  ROBOTS_DISALLOW,
  SEO_PLAN_OFFERS,
  canonicalPath,
  homeJsonLd,
  legalJsonLd,
  pricingJsonLd,
  publicMetadata,
  sitemapEntries,
} from "@/lib/seo";
import { buildLlmsFullTxt, buildLlmsTxt } from "@/lib/llms-txt";

assert.equal(CANONICAL_ORIGIN, "https://getcitebrief.com");
assert.equal(canonicalPath("/"), CANONICAL_ORIGIN);
assert.equal(canonicalPath("/pricing"), "https://getcitebrief.com/pricing");
assert.equal(canonicalPath("/legal/privacy/"), "https://getcitebrief.com/legal/privacy");

assert.ok(INDEXABLE_PATHS.includes("/"));
assert.ok(INDEXABLE_PATHS.includes("/pricing"));
assert.ok(INDEXABLE_PATHS.includes("/report"));
assert.ok(INDEXABLE_PATHS.includes("/legal/privacy"));
assert.ok(INDEXABLE_PATHS.includes("/legal/terms"));
assert.ok(INDEXABLE_PATHS.includes("/legal/dpa"));
assert.ok(INDEXABLE_PATHS.includes("/legal/security"));
assert.ok(INDEXABLE_PATHS.includes("/legal/subprocessors"));
assert.ok(INDEXABLE_PATHS.includes("/legal/retention"));
assert.ok(INDEXABLE_PATHS.includes("/legal/cookies"));
assert.ok(INDEXABLE_PATHS.includes("/legal/disclaimer"));
assert.ok(INDEXABLE_PATHS.includes("/for-seo-agencies"));
assert.ok(INDEXABLE_PATHS.includes("/for-pr-agencies"));
assert.ok(INDEXABLE_PATHS.includes("/white-label-ai-visibility-reports"));
assert.ok(INDEXABLE_PATHS.includes("/ai-visibility-report-template"));
assert.ok(INDEXABLE_PATHS.includes("/geo-reporting-for-agencies"));
assert.ok(INDEXABLE_PATHS.includes("/ai-search-reporting-for-agencies"));
assert.ok(INDEXABLE_PATHS.includes("/alternatives/otterly"));
assert.ok(INDEXABLE_PATHS.includes("/alternatives/profound"));
assert.ok(INDEXABLE_PATHS.includes("/compare/peec"));
assert.ok(INDEXABLE_PATHS.includes("/compare/ai-rank-lab"));
assert.ok(INDEXABLE_PATHS.includes("/compare/aeo-vision"));
assert.equal(
  INDEXABLE_PATHS.some((path) => path === "/playbooks" || path.startsWith("/playbooks/")),
  false,
);
assert.equal(new Set(INDEXABLE_PATHS).size, INDEXABLE_PATHS.length);
assert.ok(!INDEXABLE_PATHS.includes("/login" as (typeof INDEXABLE_PATHS)[number]));
assert.ok(!INDEXABLE_PATHS.includes("/signup" as (typeof INDEXABLE_PATHS)[number]));
assert.ok(!INDEXABLE_PATHS.some((path) => path.startsWith("/app")));

for (const article of LEGAL_ARTICLES) {
  assert.ok(INDEXABLE_PATHS.includes(article.path as (typeof INDEXABLE_PATHS)[number]), article.path);
}
for (const article of PUBLIC_ARTICLES) {
  assert.ok(INDEXABLE_PATHS.includes(article.path as (typeof INDEXABLE_PATHS)[number]), article.path);
}

assert.deepEqual([...ROBOTS_DISALLOW], ["/app/", "/api/", "/r/", "/invite/", "/verify"]);

const urls = sitemapEntries().map((entry) => entry.url);
assert.deepEqual(urls, INDEXABLE_PATHS.map((path) => canonicalPath(path)));
assert.equal(
  sitemapEntries().every((entry) => entry.url.startsWith(CANONICAL_ORIGIN)),
  true,
);

assert.match(HOME_TITLE, /CiteBrief/);
assert.match(HOME_TITLE, /Friday PDF/);
assert.doesNotMatch(HOME_TITLE, /GEO|AEO|Peec|Profound|keyword tracker/i);
assert.equal(PUBLIC_ENGINES_PHRASE, "ChatGPT, Gemini, Grok, and AI Overviews");
assert.deepEqual([...PUBLIC_ENGINE_LABELS], ["ChatGPT", "Gemini", "Grok", "AI Overviews"]);
assert.match(HOME_DESCRIPTION, /ChatGPT/);
assert.match(HOME_DESCRIPTION, /Gemini/);
assert.match(HOME_DESCRIPTION, /Grok/);
assert.match(HOME_DESCRIPTION, /AI Overviews/);
assert.doesNotMatch(HOME_DESCRIPTION, /Claude/);
assert.match(HOME_DESCRIPTION, new RegExp(PUBLIC_ENGINES_PHRASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

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

const softFailFaq = PRICING_FAQS.find((item) => item.q === "What if one engine fails?");
assert.ok(softFailFaq);
assert.match(softFailFaq.a, /three of those four/);
assert.doesNotMatch(softFailFaq.a, /four of five|Claude/i);

const trialFaq = PRICING_FAQS.find((item) => item.q === "What is included in the trial?");
assert.ok(trialFaq);
assert.match(trialFaq.a, new RegExp(`${TRIAL_PROMPT_CAP} buyer questions`));
assert.match(trialFaq.a, /ChatGPT \+ Gemini only/);
assert.doesNotMatch(trialFaq.a, /Claude/);

for (const item of PRICING_FAQS) {
  assert.doesNotMatch(item.a, /Claude/);
  assert.doesNotMatch(item.a, /four of five/);
}

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

assert.deepEqual(
  SEO_PLAN_OFFERS.map((plan) => ({ name: plan.name, price: plan.price, brands: plan.brands })),
  [
    { name: "Starter", price: 99, brands: 2 },
    { name: "Agency", price: 249, brands: 10 },
    { name: "Studio", price: 799, brands: 25 },
  ],
);

const pricingMeta = publicMetadata(PAGE_COPY.pricing);
assert.equal((pricingMeta.alternates as { canonical: string }).canonical, `${CANONICAL_ORIGIN}/pricing`);
assert.match(String(pricingMeta.description), /Starter \$99/);
assert.match(String(pricingMeta.description), /Agency \$249/);
assert.match(String(pricingMeta.description), /Studio \$799/);
assert.match(String(pricingMeta.description), /10 client brands/);
assert.match(String(pricingMeta.description), /Enterprise from \$1,499/);
assert.doesNotMatch(String(pricingMeta.description), /\$149/);
assert.doesNotMatch(String(pricingMeta.description), /Studio \$499/);
assert.doesNotMatch(String(pricingMeta.description), /8 client brands/);
assert.doesNotMatch(String(pricingMeta.description), /20 client brands/);
assert.doesNotMatch(String(pricingMeta.description), /Claude/);

const graph = homeJsonLd()["@graph"] as Array<{ "@type": string; offers?: { name: string; price: string }[] }>;
assert.equal(graph.some((node) => node["@type"] === "Organization"), true);
assert.equal(graph.some((node) => node["@type"] === "WebSite"), true);
assert.equal(graph.some((node) => node["@type"] === "SoftwareApplication"), true);

const app = graph.find((node) => node["@type"] === "SoftwareApplication") as {
  "@type": string;
  offers?: { name: string; price: string; description?: string }[];
  featureList?: string[];
};
assert.ok(app?.offers);
assert.equal(app.offers.length, SEO_PLAN_OFFERS.length);
assert.deepEqual(
  app.offers.map((offer) => offer.price),
  SEO_PLAN_OFFERS.map((plan) => String(plan.price)),
);
assert.equal(app.offers[1]?.name, `CiteBrief ${PLANS.agency.name}`);
assert.match(String(app.offers[1]?.description), new RegExp(`${PLANS.agency.brands} client brands`));
assert.ok(app.featureList?.some((item) => item.includes(`${PLANS.agency.brands} Agency`)));
assert.ok(app.featureList?.some((item) => item.includes(PUBLIC_ENGINES_PHRASE)));
assert.ok(app.featureList?.some((item) => /command center/i.test(item)));
assert.ok(app.featureList?.some((item) => /competitor intelligence/i.test(item)));
assert.equal(
  app.featureList?.some((item) => /Claude/i.test(item)),
  false,
);
assert.equal(
  app.offers.some(
    (offer) =>
      offer.price === "149" ||
      offer.price === "499" ||
      /8 client brands|20 client brands/.test(offer.description ?? ""),
  ),
  false,
);
assert.equal(app.offers.map((offer) => offer.price).includes("799"), true);

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

const disclaimer = LEGAL_ARTICLES.find((article) => article.slug === "disclaimer");
assert.ok(disclaimer);
const disclaimerText = disclaimer.sections.flatMap((section) => section.paragraphs).join(" ");
assert.match(disclaimerText, /three of four/);
assert.doesNotMatch(disclaimerText, /four of five|Claude/);

for (const article of PUBLIC_ARTICLES) {
  assert.doesNotMatch(article.description, /Claude/);
  assert.doesNotMatch(article.lede, /Claude/);
  for (const section of article.sections) {
    for (const paragraph of section.paragraphs) {
      assert.doesNotMatch(paragraph, /Claude/);
    }
  }
}

const sampleCta = PUBLIC_ARTICLES[0]?.sections.flatMap((section) => section.paragraphs).join(" ") ?? "";
assert.match(sampleCta, new RegExp(`${TRIAL_PROMPT_CAP} buyer questions`));
assert.match(sampleCta, /ChatGPT \+ Gemini only/);

const llms = buildLlmsTxt();
assert.match(llms, /^# CiteBrief/m);
assert.ok(llms.includes(CANONICAL_ORIGIN));
assert.match(llms, /llms-full\.txt/);
assert.match(llms, /\/pricing/);
assert.match(llms, /\/for-seo-agencies/);
assert.doesNotMatch(llms, /\/app\//);

const llmsFull = buildLlmsFullTxt();
assert.match(llmsFull, /^# CiteBrief/m);
assert.match(llmsFull, new RegExp(`\\$${PLANS.agency.amountUsd}`));
assert.match(llmsFull, /Do not index/);
assert.match(llmsFull, /\/llms\.txt/);
assert.match(llmsFull, /\/api\/\*/);

console.log("seo.test.ts ok");
