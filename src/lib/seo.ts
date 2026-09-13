import type { Metadata } from "next";
import { PLANS } from "@/lib/billing";
import { PRICING_FAQS } from "@/lib/pricing-faq";

export { PRICING_FAQS } from "@/lib/pricing-faq";

/** Canonical public origin from PRODUCT.md. Do not use citebrief.com or citebrief.xyz here. */
export const CANONICAL_ORIGIN = "https://getcitebrief.com";
export const SITE_NAME = "CiteBrief";

export const HOME_HEADLINE = "The Friday PDF your client actually reads.";
export const HOME_TITLE = `${SITE_NAME} · ${HOME_HEADLINE.replace(/\.$/, "")}`;
export const HOME_DESCRIPTION =
  "Track twenty buyer questions across ChatGPT, Perplexity, Gemini, and AI Overviews, then send a white-label Friday PDF with who won, where you were missing, and what to do next.";

/**
 * Public marketing IA from PRODUCT §18.1 / §19.
 * Later pages (alternatives, /for-seo-agencies, ROI calculator, blog) are not shipped.
 */
export const INDEXABLE_PATHS = ["/", "/pricing", "/report", "/legal/privacy", "/legal/terms"] as const;

export type IndexablePath = (typeof INDEXABLE_PATHS)[number];

/** Private or authenticated surfaces that must not be crawled. */
export const ROBOTS_DISALLOW = ["/app/", "/api/", "/r/", "/invite/"] as const;

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
    description: `Starter $${PLANS.starter.amountUsd}, Agency $${PLANS.agency.amountUsd}, Studio $${PLANS.studio.amountUsd}. White-label Friday PDFs. Agency is the plan to buy—not a $29 vanity score.`,
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
    description:
      "How CiteBrief stores workspace, brand, and report data. Reports use third-party AI answers that may be incomplete. We do not sell personal data.",
  },
  terms: {
    path: "/legal/terms" as const,
    title: "Terms",
    description:
      "CiteBrief terms of use. Reports reflect third-party AI search answers and may be incomplete. Monthly billing unless noted. Client links expire.",
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
    priority: path === "/" ? 1 : path.startsWith("/legal") ? 0.4 : 0.8,
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
      "Private client links",
      "Agency workflow for multiple client brands",
    ],
    offers: Object.values(PLANS).map((plan) => ({
      "@type": "Offer",
      name: `${SITE_NAME} ${plan.name}`,
      price: String(plan.amountUsd),
      priceCurrency: "USD",
      url: canonicalPath("/pricing"),
      description: "Monthly subscription",
    })),
    publisher: { "@id": `${CANONICAL_ORIGIN}/#organization` },
  };
}

function webPageNode(path: IndexablePath, name: string, description: string) {
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

export function legalJsonLd(kind: "privacy" | "terms") {
  const copy = PAGE_COPY[kind];
  const name = ogTitle(copy.title);
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      websiteNode(),
      webPageNode(copy.path, name, copy.description),
      breadcrumbNode([
        { name: SITE_NAME, path: "/" },
        { name: copy.title, path: copy.path },
      ]),
    ],
  };
}
