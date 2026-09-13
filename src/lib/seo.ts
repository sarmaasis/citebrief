import type { Metadata } from "next";
import { PLANS } from "@/lib/billing";
import { LEGAL_ARTICLES, legalBySlug } from "@/lib/legal-articles";
import { PRICING_FAQS } from "@/lib/pricing-faq";
import { PUBLIC_ARTICLES, type PublicArticle } from "@/lib/public-articles";

export { PRICING_FAQS } from "@/lib/pricing-faq";

/** Canonical public origin from PRODUCT.md. Do not use citebrief.com or citebrief.xyz here. */
export const CANONICAL_ORIGIN = "https://getcitebrief.com";
export const SITE_NAME = "CiteBrief";

export const HOME_HEADLINE = "The Friday PDF your client actually reads.";
export const HOME_TITLE = `${SITE_NAME} · ${HOME_HEADLINE.replace(/\.$/, "")}`;
export const HOME_DESCRIPTION =
  "Track twenty buyer questions across ChatGPT, Perplexity, Gemini, and AI Overviews, then send a white-label Friday PDF with who won, where you were missing, and what to do next.";

/**
 * Public marketing IA: core product pages plus launch-audit commercial, compare, and legal URLs.
 */
export const INDEXABLE_PATHS = [
  "/",
  "/pricing",
  "/report",
  ...PUBLIC_ARTICLES.map((article) => article.path),
  ...LEGAL_ARTICLES.map((article) => article.path),
] as const;

export type IndexablePath = (typeof INDEXABLE_PATHS)[number];

/** Private or authenticated surfaces that must not be crawled. */
export const ROBOTS_DISALLOW = ["/app/", "/api/", "/r/", "/invite/"] as const;

/** List prices and Agency limits from billing.ts (AGENCY_PLAN_UPDATE.md, 14 Sep 2026). */
export const SEO_PLAN_OFFERS = [
  { name: PLANS.starter.name, price: PLANS.starter.amountUsd, brands: PLANS.starter.brands, cadence: "Monthly reports" },
  { name: PLANS.agency.name, price: PLANS.agency.amountUsd, brands: PLANS.agency.brands, cadence: "Weekly Friday reports" },
  { name: PLANS.studio.name, price: PLANS.studio.amountUsd, brands: PLANS.studio.brands, cadence: "Weekly Friday reports" },
] as const;

export const PAGE_COPY = {
  home: {
    path: "/" as const,
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    absoluteTitle: true,
  },
  pricing: {
    path: "/pricing" as const,
    title: "Simple pricing for agency retainers",
    description: `Starter $${PLANS.starter.amountUsd}, Agency $${PLANS.agency.amountUsd}, Studio $${PLANS.studio.amountUsd}. Agency includes weekly white-label Friday reports for ${PLANS.agency.brands} client brands. Not a $29 vanity score.`,
  },
  report: {
    path: "/report" as const,
    title: "Sample Friday report",
    description:
      "Anonymized sample Friday PDF agencies can forward to clients. See who was named, who won, and what to do next before you start a trial.",
  },
  privacy: {
    path: "/legal/privacy" as const,
    title: "Privacy",
    description: LEGAL_ARTICLES.find((article) => article.slug === "privacy")!.description,
  },
  terms: {
    path: "/legal/terms" as const,
    title: "Terms",
    description: LEGAL_ARTICLES.find((article) => article.slug === "terms")!.description,
  },
  login: {
    title: "Sign in",
    description: "Sign in to CiteBrief to send the weekly AI-search report.",
    follow: true,
  },
  signup: {
    title: "Sign up",
    description: "Create a CiteBrief workspace and start the first Friday report.",
    follow: true,
  },
  invite: {
    title: "Workspace invite",
    description: "Accept a CiteBrief workspace invite.",
    follow: false,
  },
} as const;

export function canonicalPath(path: string): string {
  if (!path || path === "/") return CANONICAL_ORIGIN;
  const prefixed = path.startsWith("/") ? path : `/${path}`;
  return `${CANONICAL_ORIGIN}${prefixed.replace(/\/+$/, "")}`;
}

function ogTitle(title: string, absolute?: boolean): string {
  return absolute ? title : `${title} · ${SITE_NAME}`;
}

export function publicMetadata(opts: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
}): Metadata {
  const url = canonicalPath(opts.path);
  const title = ogTitle(opts.title, opts.absoluteTitle);
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      title,
      description: opts.description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: opts.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function privateMetadata(opts: {
  title: string;
  description: string;
  follow?: boolean;
}): Metadata {
  const follow = Boolean(opts.follow);
  return {
    title: opts.title,
    description: opts.description,
    robots: {
      index: false,
      follow,
      nocache: true,
      googleBot: {
        index: false,
        follow,
        noimageindex: true,
      },
    },
    openGraph: {
      title: ogTitle(opts.title),
      description: opts.description,
    },
    twitter: {
      card: follow ? "summary_large_image" : "summary",
      title: ogTitle(opts.title),
      description: opts.description,
    },
  };
}

export const metadataPages = {
  home: publicMetadata(PAGE_COPY.home),
  pricing: publicMetadata(PAGE_COPY.pricing),
  report: publicMetadata(PAGE_COPY.report),
  privacy: publicMetadata(PAGE_COPY.privacy),
  terms: publicMetadata(PAGE_COPY.terms),
  login: privateMetadata(PAGE_COPY.login),
  signup: privateMetadata(PAGE_COPY.signup),
  invite: privateMetadata(PAGE_COPY.invite),
} satisfies Record<string, Metadata>;

export const appMetadata: Metadata = {
  title: {
    absolute: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: "CiteBrief workspace",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export const clientReportRobots: Metadata["robots"] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};

export function sitemapEntries(): { url: string; changeFrequency: "weekly" | "monthly"; priority: number }[] {
  return INDEXABLE_PATHS.map((path) => ({
    url: canonicalPath(path),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority:
      path === "/"
        ? 1
        : path === "/pricing" || path === "/report"
          ? 0.8
          : path.startsWith("/legal")
            ? 0.4
            : 0.7,
  }));
}

function organizationNode() {
  return {
    "@type": "Organization",
    "@id": `${CANONICAL_ORIGIN}/#organization`,
    name: SITE_NAME,
    url: CANONICAL_ORIGIN,
    logo: canonicalPath("/favicon.svg"),
    email: "support@getcitebrief.com",
    description: HOME_DESCRIPTION,
  };
}

function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": `${CANONICAL_ORIGIN}/#website`,
    name: SITE_NAME,
    url: CANONICAL_ORIGIN,
    description: HOME_DESCRIPTION,
    inLanguage: "en-US",
    publisher: { "@id": `${CANONICAL_ORIGIN}/#organization` },
  };
}

function softwareApplicationNode() {
  return {
    "@type": "SoftwareApplication",
    "@id": `${CANONICAL_ORIGIN}/#app`,
    name: SITE_NAME,
    url: CANONICAL_ORIGIN,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: HOME_DESCRIPTION,
    featureList: [
      "White-label Friday PDF reports",
      "Buyer questions across ChatGPT, Perplexity, Gemini, and Google AI Overviews",
      `Weekly reports for ${PLANS.agency.brands} Agency client brands`,
      "Private client links",
      "Recommended next actions on each report",
    ],
    offers: SEO_PLAN_OFFERS.map((plan) => ({
      "@type": "Offer",
      name: `${SITE_NAME} ${plan.name}`,
      price: String(plan.price),
      priceCurrency: "USD",
      url: canonicalPath("/pricing"),
      description: `${plan.cadence}. ${plan.brands} client brands.`,
    })),
    publisher: { "@id": `${CANONICAL_ORIGIN}/#organization` },
  };
}

function webPageNode(path: string, name: string, description: string) {
  return {
    "@type": "WebPage",
    "@id": `${canonicalPath(path)}#webpage`,
    url: canonicalPath(path),
    name,
    description,
    isPartOf: { "@id": `${CANONICAL_ORIGIN}/#website` },
    about: { "@id": `${CANONICAL_ORIGIN}/#app` },
    inLanguage: "en-US",
  };
}

function breadcrumbNode(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalPath(item.path),
    })),
  };
}

export function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      websiteNode(),
      softwareApplicationNode(),
      webPageNode("/", HOME_TITLE, HOME_DESCRIPTION),
    ],
  };
}

export function pricingJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      websiteNode(),
      webPageNode("/pricing", ogTitle(PAGE_COPY.pricing.title), PAGE_COPY.pricing.description),
      {
        "@type": "FAQPage",
        mainEntity: PRICING_FAQS.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  };
}

export function reportJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      websiteNode(),
      webPageNode("/report", ogTitle(PAGE_COPY.report.title), PAGE_COPY.report.description),
    ],
  };
}

export function legalJsonLd(slug: string) {
  const article = legalBySlug(slug) ?? legalBySlug("privacy")!;
  const name = ogTitle(article.title);
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      websiteNode(),
      webPageNode(article.path, name, article.description),
      breadcrumbNode([
        { name: SITE_NAME, path: "/" },
        { name: article.title, path: article.path },
      ]),
    ],
  };
}

export function articleMetadata(article: PublicArticle): Metadata {
  return publicMetadata({
    title: article.metaTitle,
    description: article.description,
    path: article.path,
  });
}

export function legalMetadata(slug: string): Metadata {
  const article = legalBySlug(slug);
  if (!article) {
    return { title: "Legal", robots: { index: false, follow: false } };
  }
  return publicMetadata({
    title: article.title,
    description: article.description,
    path: article.path,
  });
}

export function articleJsonLd(article: PublicArticle) {
  const name = ogTitle(article.metaTitle);
  const pageType = "WebPage";
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      websiteNode(),
      {
        "@type": pageType,
        "@id": `${canonicalPath(article.path)}#webpage`,
        url: canonicalPath(article.path),
        name,
        headline: article.title,
        description: article.description,
        isPartOf: { "@id": `${CANONICAL_ORIGIN}/#website` },
        about: { "@id": `${CANONICAL_ORIGIN}/#app` },
        inLanguage: "en-US",
      },
      breadcrumbNode([
        { name: SITE_NAME, path: "/" },
        { name: article.title, path: article.path },
      ]),
    ],
  };
}
