import {
  ANNUAL_MONTHS_CHARGED,
  EXTRA_BRAND_USD,
  PLANS,
  TRIAL_BRAND_CAP,
  TRIAL_DAYS,
  TRIAL_RUN_CAP,
} from "@/lib/billing";

export type LegalArticle = {
  slug: string;
  path: `/legal/${string}`;
  title: string;
  description: string;
  updated: string;
  sections: { heading: string; paragraphs: string[]; bullets?: string[] }[];
};

const CONTACT = "support@getcitebrief.com";

export const LEGAL_ARTICLES: LegalArticle[] = [
  {
    slug: "privacy",
    path: "/legal/privacy",
    title: "Privacy",
    description:
      "How CiteBrief stores workspace, brand, and report data. Reports use third-party AI answers that may be incomplete. GDPR and CCPA rights. We do not sell personal data.",
    updated: "14 Sep 2026",
    sections: [
      {
        heading: "Who we are",
        paragraphs: [
          "CiteBrief (getcitebrief.com) provides white-label AI-search reports for agencies. For account and billing data we are a controller. For workspace content you submit (brands, prompts, reports) we act as a processor on your instructions. Contact: " +
            CONTACT +
            ".",
        ],
      },
      {
        heading: "What we store",
        paragraphs: [
          "Workspace, member, brand, prompt, run, engine output, report HTML/PDF, brand-kit, and subscription metadata. Sign-in uses email and password, magic link, or Google on getcitebrief.com only. Optional domains redirect and do not share cookies.",
        ],
      },
      {
        heading: "AI answers",
        paragraphs: [
          "Reports query third-party AI search surfaces (ChatGPT, Perplexity, Gemini, and Google AI Overviews) through Cloudflare AI Gateway. Those answers may be incomplete or change. We store engine outputs, source URLs, timestamps, and gateway request ids so your team can inspect a finding. See the AI disclaimer.",
        ],
      },
      {
        heading: "Processors",
        paragraphs: [
          "Cloudflare (hosting, D1, R2, KV, AI Gateway), Dodo Payments (cards), Resend (transactional email), and Google (optional OAuth). Details: subprocessors page.",
        ],
      },
      {
        heading: "Legal bases and GDPR",
        paragraphs: [
          "If GDPR applies: contract (to run the workspace), legitimate interests (security, abuse prevention, product integrity), and consent where required for optional cookies. We do not run marketing analytics cookies today. You may request access, correction, export, restriction, objection, or deletion at " +
            CONTACT +
            ". Export and deletion request also live in Settings → Workspace.",
        ],
      },
      {
        heading: "CCPA / US state privacy",
        paragraphs: [
          "We do not sell or share personal information as those terms are used in California law. California residents may request know, delete, and correct. We will not discriminate for exercising those rights. We do not use sensitive personal information to infer characteristics.",
        ],
      },
      {
        heading: "Client links",
        paragraphs: [
          "Client report links under /r are public token URLs. They do not require login. Anyone with the link can read that report until it expires (90 days) or you revoke it in the app.",
        ],
      },
      {
        heading: "Retention and children",
        paragraphs: [
          "See the retention page. CiteBrief is not directed at children under 16.",
        ],
      },
    ],
  },
  {
    slug: "terms",
    path: "/legal/terms",
    title: "Terms",
    description:
      "CiteBrief terms of use. Reports reflect third-party AI search answers and may be incomplete. Monthly billing unless noted. Client links expire.",
    updated: "14 Sep 2026",
    sections: [
      {
        heading: "The service",
        paragraphs: [
          "By using CiteBrief you agree to use it for lawful client reporting. CiteBrief is a report layer, not a guarantee of rankings, citations, or demand. It is not a GEO optimizer, keyword tracker, or content generator.",
        ],
      },
      {
        heading: "AI output",
        paragraphs: [
          "Reports reflect answers from third-party AI search engines and may be incomplete. You are responsible for what you send to clients. Read the AI disclaimer before forwarding a report.",
        ],
      },
      {
        heading: "Plans",
        paragraphs: [
          `Starter is $${PLANS.starter.amountUsd}/mo for ${PLANS.starter.brands} brands, Agency $${PLANS.agency.amountUsd}/mo for ${PLANS.agency.brands} brands, Studio $${PLANS.studio.amountUsd}/mo for ${PLANS.studio.brands} brands. Extra brands are $${EXTRA_BRAND_USD.agency}/mo on Agency and $${EXTRA_BRAND_USD.studio}/mo on Studio. Annual billing is ${ANNUAL_MONTHS_CHARGED} months prepaid when Dodo annual products are configured. Trial is ${TRIAL_DAYS} days, ${TRIAL_BRAND_CAP} brand, and ${TRIAL_RUN_CAP} full report. Cancel at period end. Generated PDFs remain available for 90 days after cancel.`,
        ],
      },
      {
        heading: "Accounts and links",
        paragraphs: [
          "Owners control seats, billing, export, and deletion requests. Client report links do not require login, expire after 90 days, and can be revoked. Optional domains redirect to getcitebrief.com and do not share sign-in sessions.",
        ],
      },
    ],
  },
  {
    slug: "dpa",
    path: "/legal/dpa",
    title: "Data Processing Addendum",
    description:
      "CiteBrief DPA for agency workspace data. Cloudflare hosting, Dodo payments, Resend email, AI Gateway. Standard contractual clauses on request.",
    updated: "14 Sep 2026",
    sections: [
      {
        heading: "Roles",
        paragraphs: [
          "This DPA applies when you are a controller (or processor for your client) and CiteBrief processes workspace content as a processor. Account, security, and billing records are processed as a controller as described in the privacy policy.",
        ],
      },
      {
        heading: "Instructions",
        paragraphs: [
          "We process brand, prompt, run, and report data only to provide the service, including engine queries, PDF storage, sending, and support. We will not sell that content. Subprocessors are listed publicly and may change with notice on that page.",
        ],
      },
      {
        heading: "Security and assistance",
        paragraphs: [
          "Security measures are described on the security page: single-domain auth, tokenized client links, encryption in transit, access logging for admin actions. We will assist with data-subject requests you cannot fulfill in-product (export and deletion request already exist in Settings).",
        ],
      },
      {
        heading: "International transfers",
        paragraphs: [
          "Hosting is on Cloudflare. Transfers rely on Cloudflare's published transfer mechanisms. Signed SCCs or a countersigned DPA: email " +
            CONTACT +
            ".",
        ],
      },
    ],
  },
  {
    slug: "subprocessors",
    path: "/legal/subprocessors",
    title: "Subprocessors",
    description:
      "CiteBrief subprocessors: Cloudflare, Dodo Payments, Resend, and Google OAuth. AI providers are reached through Cloudflare AI Gateway.",
    updated: "14 Sep 2026",
    sections: [
      {
        heading: "Current list",
        bullets: [
          "Cloudflare — application hosting, D1, R2, KV, Queue, AI Gateway, Browser Rendering",
          "Dodo Payments — checkout, subscriptions, customer portal, invoices",
          "Resend — magic links, verification, report email",
          "Google — optional sign-in (OAuth) when configured",
        ],
        paragraphs: [
          "Engine providers (OpenAI, Perplexity, Google Gemini, and similar) receive the buyer questions you configure, via Cloudflare AI Gateway. They do not receive your client’s login. Changes to this list will be reflected on this page.",
        ],
      },
    ],
  },
  {
    slug: "retention",
    path: "/legal/retention",
    title: "Data retention",
    description:
      "CiteBrief retention: PDFs 90 days after cancel, engine cache 24 hours, client links 90 days or until revoked, auth sessions per Better Auth.",
    updated: "14 Sep 2026",
    sections: [
      {
        heading: "Product data",
        bullets: [
          "Reports and PDFs: kept while the workspace is active; 90 days after cancel",
          "Client links: 90 days from creation, or until revoked",
          "Engine cache: 24 hours for identical prompt + engine",
          "Invites: 14 days unless accepted",
          "Audit logs: kept for support and security review",
          "Auth sessions: until expiry or sign-out",
        ],
        paragraphs: [
          "Deletion requests remove workspace content after we confirm the owner email. Backups may lag for a short window. Export before you request deletion if you still need a copy.",
        ],
      },
    ],
  },
  {
    slug: "security",
    path: "/legal/security",
    title: "Security",
    description:
      "CiteBrief security: single-domain Better Auth on getcitebrief.com, D1 storage, Dodo payments, Resend email, Cloudflare AI Gateway, 90-day client links, incident contact.",
    updated: "14 Sep 2026",
    sections: [
      {
        heading: "Auth model",
        paragraphs: [
          "First-party authentication on getcitebrief.com only (email/password, magic link, Google). Optional domains such as citebrief.xyz must 301 redirect and must not set auth cookies. Production rejects stub and dev-admin internal secrets.",
        ],
      },
      {
        heading: "Data storage",
        paragraphs: [
          "Application data lives in Cloudflare D1. Report HTML and PDFs live in R2. Better Auth rate-limit and session cache may use KV. Transport is HTTPS with HSTS, frame denial, and a content security policy.",
        ],
      },
      {
        heading: "Payments, email, AI",
        paragraphs: [
          "Cards are handled by Dodo Payments. We do not store card numbers. Transactional email is Resend. Model calls go through Cloudflare AI Gateway rather than raw provider keys in product code. Live engines do not silently stub-succeed.",
        ],
      },
      {
        heading: "Reports and access",
        paragraphs: [
          "Client links are unguessable tokens, noindex, 90-day expiry, and revocable in the report viewer. Internal admin impersonation, webhook replay, billing, invites, and report sends write audit logs. Rate limits apply to sign-in, runs, sends, invites, public tokens, and admin routes.",
        ],
      },
      {
        heading: "Incidents",
        paragraphs: [
          "Report suspected incidents to " + CONTACT + ". We will acknowledge and follow up with affected workspace owners when required.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    path: "/legal/cookies",
    title: "Cookies",
    description:
      "CiteBrief cookie policy. Essential auth and security cookies only. No marketing analytics cookies are set today.",
    updated: "14 Sep 2026",
    sections: [
      {
        heading: "What we use",
        paragraphs: [
          "We set essential cookies for sign-in (Better Auth session) and, for internal support, a short-lived signed impersonation cookie. These are required to operate the app.",
          "We do not currently set marketing, advertising, or third-party analytics cookies. If that changes, this page will be updated before those cookies are used.",
        ],
      },
    ],
  },
  {
    slug: "disclaimer",
    path: "/legal/disclaimer",
    title: "AI report disclaimer",
    description:
      "CiteBrief reports reflect third-party AI answers that may be incomplete or change. Not a guarantee of citations, rankings, or demand.",
    updated: "14 Sep 2026",
    sections: [
      {
        heading: "What a report is",
        paragraphs: [
          "Each report is a snapshot of how selected AI search surfaces answered the buyer questions you configured. Answers can differ by region, session, model version, and time. Source URLs and raw answers are stored for inspection inside the app.",
        ],
      },
      {
        heading: "What a report is not",
        bullets: [
          "Not legal, financial, or investment advice",
          "Not a guarantee that a client will be named or recommended later",
          "Not a complete crawl of the internet or of every AI product",
          "Not a substitute for your own editorial review before sending to a client",
        ],
        paragraphs: [
          "If fewer than three engines succeed, treat the week as incomplete. Partial reports can still ship when three of four engines return.",
        ],
      },
    ],
  },
];

export function legalBySlug(slug: string) {
  return LEGAL_ARTICLES.find((article) => article.slug === slug) ?? null;
}
