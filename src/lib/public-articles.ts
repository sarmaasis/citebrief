import {
  PLANS,
  TRIAL_BRAND_CAP,
  TRIAL_DAYS,
  TRIAL_PROMPT_CAP,
  TRIAL_RUN_CAP,
} from "@/lib/billing";

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

const ctaNote = `${TRIAL_DAYS}-day trial is ${TRIAL_BRAND_CAP} brand, ${TRIAL_PROMPT_CAP} buyer questions, and ${TRIAL_RUN_CAP} full report on ChatGPT + Gemini only. No weekly send or command center until paid. Agency at $${PLANS.agency.amountUsd}/mo is the plan for ${PLANS.agency.brands} brands, weekly Friday sending, client CC, ${PLANS.agency.seats} seats, and the command-center dashboard.`;

export const PUBLIC_ARTICLES: PublicArticle[] = [
  {
    path: "/for-seo-agencies",
    kind: "audience",
    title: "AI-search reporting for SEO agencies",
    metaTitle: "AI-search reporting for SEO agencies",
    description:
      "Add a Friday AI-search PDF to SEO retainers. Named, recommended, who won, and what to do next across ChatGPT, Gemini, Grok, and AI Overviews.",
    kicker: "For SEO agencies",
    lede: "Clients already ask whether they show up in ChatGPT. CiteBrief gives account managers a white-label Friday PDF they can forward without rewriting a deck.",
    sections: [
      {
        heading: "The retainer needs an artifact",
        paragraphs: [
          "SEO agencies can sell AI-search monitoring inside $3k–$8k retainers. The work fails when the only output is another analytics tab or a GEO lecture. The client wants proof you checked this week, who won the shortlist, and what to do next.",
          "CiteBrief is the report layer clients read, plus an Agency command center your team uses between Fridays. Not a keyword tracker and not a replacement for your rank tools. Twenty buying questions when paid. Four AI surfaces. A letter they can print.",
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
      "PR agencies use CiteBrief to show whether ChatGPT, Gemini, Grok, and AI Overviews name the client or a competitor. A Friday PDF for the client; Agency adds a command center for the team.",
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
          "Not a clip farm, not a media monitoring suite, not a content generator. Clients get a Friday PDF. Agency unlocks the command center for risk, opportunities, and send pipeline.",
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
    title: "GEO reporting for agencies, as a Friday PDF",
    metaTitle: "GEO reporting for agencies",
    description:
      "GEO reporting agencies can monetize: a white-label Friday PDF clients read, plus an Agency command center for risk, competitors, and next actions across ChatGPT, Gemini, Grok, and AI Overviews.",
    kicker: "GEO, as a report",
    lede: "GEO is a category buyers search. CiteBrief does not compete as the deepest tracker. It ships the Friday PDF clients read, and on Agency a command center your team uses between Fridays.",
    sections: [
      {
        heading: "Use the word with clients carefully",
        paragraphs: [
          "Account managers should not lead with GEO, AEO, or model names. The PDF talks about buyer questions and who AI recommended. Keep the jargon in sales conversations if you must, not in the client letter.",
          "If you already run a GEO research platform, keep it. Add CiteBrief when you need a forwardable Friday artifact plus an Agency workspace that shows who is winning, what changed, and what to do next.",
        ],
      },
      {
        heading: "What CiteBrief is (and is not)",
        bullets: [
          "Client deliverable: white-label Friday PDF and private link",
          "Agency+ workspace: command center with scorecards, opportunities, risks, and send pipeline",
          "Not a client login dashboard and not a deep GEO crawler or prompt-research suite",
        ],
        paragraphs: [ctaNote],
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
      "The Friday AI-search report agencies send to clients. Track twenty buyer questions across ChatGPT, Gemini, Grok, and Google AI Overviews.",
    kicker: "The product",
    lede: "CiteBrief is the weekly AI-search report agencies send to clients, plus an Agency command center for the team. Not a cheap score. Not a Profound replacement.",
    sections: [
      {
        heading: "The job",
        paragraphs: [
          "Prove you checked AI-search this period. Show whether the client was named or recommended. Show who won when they were not. Give three actions. Let the account manager forward the PDF. On Agency, open the command center between Fridays to see movement, risks, and opportunities.",
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
      "Looking for an Otterly alternative? CiteBrief is the Friday AI-search PDF agencies send to clients, plus an Agency command center for the team — not a prompt-tracking research workspace.",
    kicker: "Alternative",
    lede: "Otterly is built around prompt tracking. CiteBrief is built around the client-ready Friday report and, on Agency, a command center for risk and next actions. If your buyer is an agency that needs a white-label PDF, start here.",
    sections: [
      {
        heading: "When CiteBrief is the better fit",
        bullets: [
          "You sell retainers and need a weekly artifact, not another login for the client",
          "Account managers should not paste screenshots into slides",
          "You want named / recommended / who won in client-safe language",
          "Your team needs Agency scorecards, opportunities, and a send pipeline between Fridays",
        ],
        paragraphs: [
          `If you need the deepest prompt research workspace, keep a tracker. CiteBrief does not try to win that category. Agency is $${PLANS.agency.amountUsd}/mo for ${PLANS.agency.brands} brands, weekly sending, and the command center.`,
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
          "The deliverable is a white-label PDF for the client, not a client login dashboard",
          "You already have SEO or PR retainers and need a Friday send",
          "You want 20 buying questions, four AI surfaces, and three next actions",
          "Your team needs an Agency command center for risk, opportunities, and send pipeline",
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
