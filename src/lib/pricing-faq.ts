import {
  ANNUAL_MONTHS_CHARGED,
  EXTRA_BRAND_USD,
  PLANS,
  SEAT_OVERAGE_USD,
  TRIAL_BRAND_CAP,
  TRIAL_DAYS,
  TRIAL_RUN_CAP,
} from "@/lib/billing";

/** Shared with the pricing page so FAQ schema cannot drift from on-page copy. */
export const PRICING_FAQS = [
  {
    q: "Can my client read the PDF without an account?",
    a: "Yes. Every plan includes a private client link. Client CC on the Friday email is Agency and Studio only. Client pages do not require login and expire after 90 days.",
  },
  {
    q: "What if one engine fails?",
    a: "We soft-fail. If three of four engines return, the Friday PDF still ships. Failed engines stay out of the client-facing report unless fewer than three succeed.",
  },
  {
    q: "Is this a GEO optimizer or an SEO tracker?",
    a: "No. CiteBrief is the report layer agencies send to clients. It is not a cheap visibility score, a keyword tracker, a content generator, or a Peec or Profound replacement.",
  },
  {
    q: "What is included in the trial?",
    a: `${TRIAL_DAYS} days, ${TRIAL_BRAND_CAP} brand, ${TRIAL_RUN_CAP} full report. No weekly send until paid. No Studio engines in trial. No free forever plan. After the trial, Starter is $${PLANS.starter.amountUsd}/mo for ${PLANS.starter.brands} brands on a monthly cadence; weekly Friday sending is Agency ($${PLANS.agency.amountUsd}/mo, ${PLANS.agency.brands} brands) and Studio ($${PLANS.studio.amountUsd}/mo).`,
  },
  {
    q: "What if I outgrow Starter?",
    a: `Move to Agency at $${PLANS.agency.amountUsd}/mo for ${PLANS.agency.brands} brands, weekly Friday reports, white-label, client CC, history, Slack, extra brands, and ${PLANS.agency.seats} seats. Studio is $${PLANS.studio.amountUsd}/mo for a custom sender, ${PLANS.studio.brands} brands, ${PLANS.studio.prompts} questions, ${PLANS.studio.seats} seats, and limited Claude/Grok capacity. Enterprise starts at $${PLANS.enterprise.amountUsd.toLocaleString("en-US")}/mo or annual contract for custom limits, SSO, and SLA. Extra seats are $${SEAT_OVERAGE_USD}/mo after the plan cap. Extra brands are $${EXTRA_BRAND_USD.agency}/mo on Agency and $${EXTRA_BRAND_USD.studio}/mo on Studio only.`,
  },
  {
    q: "Can I pay annually?",
    a: `Yes. Annual is ${ANNUAL_MONTHS_CHARGED} months prepaid (2 months free). Toggle Annual, then start a plan. You sign up if needed, then continue to checkout for that plan on annual billing. If annual products are not live yet, the charge may still use the monthly product until they are.`,
  },
] as const;
