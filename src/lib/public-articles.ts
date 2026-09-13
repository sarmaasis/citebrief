import { PLANS, TRIAL_BRAND_CAP, TRIAL_DAYS, TRIAL_RUN_CAP } from "@/lib/billing";

export type PublicArticle = {
  path: string;
  kind: "audience" | "compare" | "alternative";
  title: string;
  metaTitle: string;
  description: string;
  kicker?: string;
  lede: string;
  sections: { heading?: string; paragraphs: string[]; bullets?: string[] }[];
  related?: { href: string; label: string }[];
};

const ctaNote = `${TRIAL_DAYS}-day trial is ${TRIAL_BRAND_CAP} brand and ${TRIAL_RUN_CAP} full report. No weekly send until paid. Agency at $${PLANS.agency.amountUsd}/mo is the plan for ${PLANS.agency.brands} brands, weekly Friday sending, client CC, and ${PLANS.agency.seats} seats.`;

export const PUBLIC_ARTICLES: PublicArticle[] = [
  {
    path: "/for-seo-agencies",
    kind: "audience",
    title: "AI-search reporting for SEO agencies",
    metaTitle: "AI-search reporting for SEO agencies",
    description:
      "Add a Friday AI-search PDF to SEO retainers. Named, recommended, who won, and what to do next across ChatGPT, Perplexity, Gemini, and AI Overviews.",
    kicker: "For SEO agencies",
    lede: "Clients already ask whether they show up in ChatGPT. CiteBrief gives account managers a white-label Friday PDF they can forward without rewriting a deck.",
    sections: [
      {
        heading: "The retainer needs an artifact",
        paragraphs: [
          "SEO agencies can sell AI-search monitoring inside $3k–$8k retainers. The work fails when it becomes another dashboard tab or a GEO lecture. The client wants proof you checked this week, who won the shortlist, and what to do next.",
          "CiteBrief is the report layer, not a keyword tracker and not a replacement for your rank tools. Twenty buying questions. Four answer surfaces. A letter they can print.",
        ],
      },
      {
        heading: "What the Friday PDF contains",
        bullets: [
          "Named in X of 20 buyer questions, plus recommended in Y of 20",
          "Who won each question, with one next action",
          "Three priorities ranked by commercial urgency",
          "White-label cover, agency logo, prepared-by footer",
        ],
        paragraphs: [ctaNote],
      },
    ],
    related: [
      { href: "/pricing", label: `See Agency at $${PLANS.agency.amountUsd}` },
      { href: "/geo-reporting-for-agencies", label: "GEO reporting for agencies" },
    ],
  },
  {
    path: "/for-pr-agencies",
    kind: "audience",
    title: "Prove AI mentions for PR retainers",
    metaTitle: "AI visibility reports for PR agencies",
    description:
      "PR agencies use CiteBrief to show whether ChatGPT, Perplexity, Gemini, and AI Overviews name the client or a competitor. A Friday PDF, not another media dashboard.",
    kicker: "For PR agencies",
    lede: "Third-party mentions now include AI answers. CiteBrief turns those mentions into a client-ready Friday brief.",
    sections: [
      {
        heading: "Mentions without another war room",
        paragraphs: [
          "PR teams already collect coverage. Clients now ask if ChatGPT names them in category and comparison questions. Dumping raw model text into a slide is not a deliverable.",
          "CiteBrief checks buying questions, records who was named, and writes a short next-action line. The PDF is white-label. The client link expires and can be revoked.",
        ],
      },
      {
        heading: "What it is not",
        paragraphs: [
          "Not a clip farm, not a sentiment dashboard, not a content generator. If you need a weekly artifact that proves you checked AI answers, this is the product.",
          ctaNote,
        ],
      },
    ],
    related: [
      { href: "/ai-visibility-report-template", label: "AI visibility report template" },
      { href: "/white-label-ai-visibility-reports", label: "White-label AI visibility reports" },
    ],
  },
  {
    path: "/white-label-ai-visibility-reports",
    kind: "audience",
    title: "White-label AI visibility reports",
    metaTitle: "White-label AI visibility reports for agencies",
    description:
      "Agency-branded Friday PDFs and private client links. Logo, color, prepared-by footer, optional client CC on Agency. CiteBrief stays off the cover.",
    kicker: "White-label",
    lede: "The report should look like your agency. CiteBrief is the production line, not the byline.",
    sections: [
      {
        heading: "What white-label means here",
        bullets: [
          "Agency logo and accent on the PDF and client link",
          "Prepared-by footer you control",
          "Private /r token links with 90-day expiry and revoke from the app",
          "Client CC on Agency and Studio; custom sender domain on Studio",
        ],
        paragraphs: [
          "Starter is the workflow proof. Agency is the plan for weekly sending and seats. Studio adds custom sender identity.",
        ],
      },
    ],
    related: [
      { href: "/report", label: "View the sample Friday report" },
      { href: "/pricing", label: `See Agency at $${PLANS.agency.amountUsd}` },
    ],
  },
  {
    path: "/ai-visibility-report-template",
    kind: "audience",
    title: "AI visibility report template",
    metaTitle: "AI visibility report template for agencies",
    description:
      "A client-safe Friday template: named score, recommended score, who won, one next action, and three 10-day priorities. See the live sample.",
    kicker: "Template",
    lede: "Most AI visibility exports are tables. Agencies need a letter. This is the template CiteBrief fills every Friday.",
    sections: [
      {
        heading: "Cover",
        paragraphs: [
          "Agency name, client brand, week, named in X of 20, recommended in Y of 20, one paragraph in plain English. No GEO jargon unless you turn on technical mode.",
        ],
      },
      {
        heading: "Rows and close",
        paragraphs: [
          "Each buying question: named, recommended, engines, who won, one sentence, one next action. Close with three priorities: a high-intent miss, a repeating competitor, and a fix that can ship in ten days.",
        ],
      },
    ],
    related: [
      { href: "/report", label: "Open the anonymized sample" },
      { href: "/white-label-ai-visibility-reports", label: "White-label AI visibility reports" },
    ],
  },
  {
    path: "/geo-reporting-for-agencies",
    kind: "audience",
    title: "GEO reporting for agencies, without the dashboard",
    metaTitle: "GEO reporting for agencies",
    description:
      "Generative engine optimization reporting as a Friday PDF. CiteBrief tracks buyer questions across ChatGPT, Perplexity, Gemini, and AI Overviews for agency retainers.",
    kicker: "GEO, as a report",
    lede: "GEO is a category buyers search. CiteBrief does not compete as the deepest tracker. It ships the report agencies can monetize this week.",
    sections: [
      {
        heading: "Use the word with clients carefully",
        paragraphs: [
          "Account managers should not lead with GEO, AEO, or model names. The PDF talks about buyer questions and who AI recommended. Keep the jargon in sales conversations if you must, not in the client letter.",
          "If you already run a GEO platform, keep it. Add CiteBrief when you need a forwardable artifact on a weekly cadence.",
        ],
      },
    ],
    related: [
      { href: "/ai-search-reporting-for-agencies", label: "AI-search reporting for agencies" },
      { href: "/pricing", label: `See Agency at $${PLANS.agency.amountUsd}` },
    ],
  },
  {
    path: "/ai-search-reporting-for-agencies",
    kind: "audience",
    title: "AI-search reporting for agencies",
    metaTitle: "AI-search reporting for agencies",
    description:
      "The Friday AI-search report agencies send to clients. Track twenty buyer questions across ChatGPT, Perplexity, Gemini, and Google AI Overviews.",
    kicker: "The product",
    lede: "CiteBrief is the weekly AI-search report agencies send to clients. Not a cheap score. Not a Profound replacement.",
    sections: [
      {
        heading: "The job",
        paragraphs: [
          "Prove you checked AI-search this period. Show whether the client was named or recommended. Show who won when they were not. Give three actions. Let the account manager forward the PDF.",
          ctaNote,
        ],
      },
    ],
    related: [
      { href: "/for-seo-agencies", label: "For SEO agencies" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    path: "/alternatives/otterly",
    kind: "alternative",
    title: "Otterly alternative for agency client reports",
    metaTitle: "Otterly alternative for agencies",
    description:
      "Looking for an Otterly alternative? CiteBrief is the Friday AI-search PDF agencies send to clients, not a prompt-tracking dashboard.",
    kicker: "Alternative",
    lede: "Otterly is built around prompt tracking. CiteBrief is built around the client-ready Friday report. If your buyer is an agency that needs a white-label PDF, start here.",
    sections: [
      {
        heading: "When CiteBrief is the better fit",
        bullets: [
          "You sell retainers and need a weekly artifact, not another login for the client",
          "Account managers should not paste screenshots into slides",
          "You want named / recommended / who won in client-safe language",
        ],
        paragraphs: [
          `If you need the deepest prompt research workspace, keep a tracker. CiteBrief does not try to win that category. Agency is $${PLANS.agency.amountUsd}/mo for ${PLANS.agency.brands} brands and weekly sending.`,
        ],
      },
    ],
    related: [
      { href: "/compare/peec", label: "Compare with Peec" },
      { href: "/report", label: "Sample report" },
    ],
  },
  {
    path: "/alternatives/profound",
    kind: "alternative",
    title: "Profound alternative for agencies that need a Friday PDF",
    metaTitle: "Profound alternative for agencies",
    description:
      "Profound is an enterprise AI visibility platform. CiteBrief is the white-label Friday report layer for SEO, content, and PR agencies.",
    kicker: "Alternative",
    lede: "Profound is deep, expensive, and often too technical for account managers. CiteBrief is the letter you send on Friday.",
    sections: [
      {
        heading: "Different job",
        paragraphs: [
          "If you need enterprise share-of-voice research, Profound may be the right stack. If you need to add AI-search reporting to ten client retainers this quarter, you need a finished PDF, client links, and billing that maps to brands and seats.",
          "CiteBrief does not claim to replace Profound. It claims to be readable.",
        ],
      },
    ],
    related: [
      { href: "/white-label-ai-visibility-reports", label: "White-label reports" },
      { href: "/pricing", label: `Agency at $${PLANS.agency.amountUsd}` },
    ],
  },
  {
    path: "/compare/peec",
    kind: "compare",
    title: "CiteBrief vs Peec",
    metaTitle: "CiteBrief vs Peec",
    description:
      "Peec is a GEO platform. CiteBrief is the Friday AI-search report agencies send to clients. Compare jobs, not feature grids.",
    kicker: "Compare",
    lede: "Peec competes as a GEO platform. CiteBrief competes as the report layer agencies can immediately monetize.",
    sections: [
      {
        heading: "Choose CiteBrief if",
        bullets: [
          "The deliverable is a white-label PDF, not a client dashboard",
          "You already have SEO or PR retainers and need a Friday send",
          "You want 20 buying questions, four engines, and three next actions",
        ],
        paragraphs: [
          "Choose a GEO platform if you need optimization workflows, crawler logs, or a large analytics surface. CiteBrief will not pretend to be that product.",
        ],
      },
    ],
    related: [
      { href: "/compare/ai-rank-lab", label: "CiteBrief vs AI Rank Lab" },
      { href: "/geo-reporting-for-agencies", label: "GEO reporting for agencies" },
    ],
  },
  {
    path: "/compare/ai-rank-lab",
    kind: "compare",
    title: "CiteBrief vs AI Rank Lab",
    metaTitle: "CiteBrief vs AI Rank Lab",
    description:
      "AI Rank Lab tracks AI rankings. CiteBrief sends the Friday PDF your client actually reads: named, recommended, who won, what to do next.",
    kicker: "Compare",
    lede: "Ranking tables help analysts. Clients fund retainers when they receive a short letter with a score and a next action.",
    sections: [
      {
        paragraphs: [
          "Use AI Rank Lab if your team lives in rank tracking. Use CiteBrief if the account manager has to send something by Friday that a CMO can read in four minutes.",
          `Plans start at $${PLANS.starter.amountUsd}/mo Starter. Weekly Friday sending is Agency at $${PLANS.agency.amountUsd}/mo for ${PLANS.agency.brands} brands.`,
        ],
      },
    ],
    related: [
      { href: "/compare/aeo-vision", label: "CiteBrief vs AEO Vision" },
      { href: "/report", label: "Sample report" },
    ],
  },
  {
    path: "/compare/aeo-vision",
    kind: "compare",
    title: "CiteBrief vs AEO Vision",
    metaTitle: "CiteBrief vs AEO Vision",
    description:
      "AEO tools measure answer-engine presence. CiteBrief packages that measurement into a white-label Friday report for agencies.",
    kicker: "Compare",
    lede: "Answer-engine optimization is a research problem. Agency reporting is a packaging problem. CiteBrief solves the second.",
    sections: [
      {
        paragraphs: [
          "If you need a wide AEO research surface, keep a specialist tool. If you need client-safe language, a private link, and a PDF that does not mention embeddings, use CiteBrief.",
          "Default reports hide raw model text. An in-app sources drawer keeps evidence for when someone challenges a finding.",
        ],
      },
    ],
    related: [
      { href: "/alternatives/otterly", label: "Otterly alternative" },
      { href: "/for-seo-agencies", label: "For SEO agencies" },
    ],
  },
];

export function articleByPath(path: string) {
  return PUBLIC_ARTICLES.find((article) => article.path === path) ?? null;
}
