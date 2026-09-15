import {
  ANNUAL_MONTHS_CHARGED,
  EXTRA_BRAND_USD,
  EXTRA_RUN_USD,
  MONTHLY_RECHECK_CREDITS,
  PLANS,
  SEAT_OVERAGE_USD,
  TRIAL_BRAND_CAP,
  TRIAL_DAYS,
  TRIAL_PROMPT_CAP,
  TRIAL_RUN_CAP,
} from "@/lib/billing";

/** Shared with the pricing page so FAQ schema cannot drift from on-page copy. */
export const PRICING_FAQS = [
  {
    q: "Can my client read the PDF without an account?",
    a: "Yes. Every plan includes a private report link. Client CC on the Friday email is Growth and Agency only. Client pages do not require login and expire after 90 days.",
  },
  {
    q: "What if one engine fails?",
    a: "We soft-fail. Paid Friday runs check ChatGPT, Gemini, Grok, and AI Overviews. If three of those four return, the PDF still ships. Failed sources stay out of the client-facing report unless fewer than three succeed.",
  },
  {
    q: "Is this a GEO optimizer or an SEO tracker?",
    a: "CiteBrief is the AI-search reporting layer for teams and agencies: visibility, competitors, weekly actions, and client-ready reports. It is not a cheap vanity score, a keyword tracker, or a content generator.",
  },
  {
    q: "What is included in the trial?",
    a: `${TRIAL_DAYS} days, ${TRIAL_BRAND_CAP} brand, ${TRIAL_PROMPT_CAP} buyer questions, ${TRIAL_RUN_CAP} full report on ChatGPT + Gemini only. No weekly send, no command center, no unlimited reruns, and no extra-brand add-on until paid. No free forever plan. After the trial, Starter is $${PLANS.starter.amountUsd}/mo for ${PLANS.starter.brands} brands on a monthly cadence; weekly tracking starts on ${PLANS.agency.name} ($${PLANS.agency.amountUsd}/mo, ${PLANS.agency.brands * PLANS.agency.prompts} tracked questions) and agency white-label delivery is on ${PLANS.studio.name} ($${PLANS.studio.amountUsd}/mo).`,
  },
  {
    q: "What if I outgrow Starter?",
    a: `Move to ${PLANS.agency.name} at $${PLANS.agency.amountUsd}/mo for ${PLANS.agency.brands} brands, ${PLANS.agency.brands * PLANS.agency.prompts} tracked questions, weekly Friday reports, ${MONTHLY_RECHECK_CREDITS.agency} manual re-check credits/mo, email sending, history, Slack, extra brands at $${EXTRA_BRAND_USD.agency}/mo, ${PLANS.agency.seats} seats, and the command-center dashboard. ${PLANS.studio.name} is $${PLANS.studio.amountUsd}/mo for ${PLANS.studio.brands} client brands, ${PLANS.studio.brands * PLANS.studio.prompts} tracked questions, custom sender, white-label delivery, ${MONTHLY_RECHECK_CREDITS.studio} manual re-check credits/mo, ${PLANS.studio.seats} seats, bulk send, portfolio CSV export, and ChatGPT, Gemini, Grok, and AI Overviews. Extra re-checks are $${EXTRA_RUN_USD.agency} after monthly credits on paid plans. Enterprise starts at $${PLANS.enterprise.amountUsd.toLocaleString("en-US")}/mo or annual contract for custom limits, SSO, and SLA. Extra seats are $${SEAT_OVERAGE_USD}/mo after the plan cap. Extra brands are Growth+ only (not Starter or trial).`,
  },
  {
    q: "Can I pay annually?",
    a: `Yes. Annual is ${ANNUAL_MONTHS_CHARGED} months prepaid (2 months free). Toggle Annual, then start a plan. You sign up if needed, then continue to checkout for that plan on annual billing. If annual products are not live yet, the charge may still use the monthly product until they are.`,
  },
] as const;
