import {
  EXTRA_BRAND_USD,
  EXTRA_RUN_USD,
  MONTHLY_RECHECK_CREDITS,
  PLANS,
  SEAT_OVERAGE_USD,
  TRIAL_BRAND_CAP,
  TRIAL_PROMPT_CAP,
  TRIAL_RUN_CAP,
} from "@/lib/billing";

/** Server-safe copy. Do not keep this in a `"use client"` file — named exports go undefined on RSC. */
export const UPGRADE_COPY = {
  trialBrand: {
    title: "Trial includes one brand",
    body: `Trial is ${TRIAL_BRAND_CAP} brand, ${TRIAL_PROMPT_CAP} buyer questions, and ${TRIAL_RUN_CAP} full report on ChatGPT + Gemini. Agency unlocks ${PLANS.agency.brands} client brands, weekly Friday reports, and the command-center dashboard.`,
    cta: "Upgrade to Agency",
  },
  thirdBrand: {
    title: "Need another client brand?",
    body: `Starter includes ${PLANS.starter.brands} brands on a lighter Home. Agency includes ${PLANS.agency.brands} client brands, weekly Friday reports, risk and opportunity rollups, and a finished artifact for every retainer.`,
    cta: "Upgrade to Agency",
  },
  /** @deprecated Prefer trialBrand / thirdBrand. Kept for older call sites. */
  fourthBrand: {
    title: "Need another client brand?",
    body: `Starter includes ${PLANS.starter.brands} brands on a lighter Home. Agency includes ${PLANS.agency.brands} client brands, weekly Friday reports, risk and opportunity rollups, and a finished artifact for every retainer.`,
    cta: "Upgrade to Agency",
  },
  weeklyStarter: {
    title: "Weekly reports are on Agency",
    body: "Starter stays monthly with a lighter Home. Agency ships every Friday with white-label, client CC, and the command-center send queue.",
    cta: "Upgrade to Agency",
  },
  commandCenter: {
    title: "Command Center is on Agency",
    body: "Trial and Starter stay on a lighter Home. Agency unlocks the multi-client command center: brand scorecards, competitor movement, opportunity queue, risk alerts, send pipeline, and what to do next.",
    cta: "Upgrade to Agency",
  },
  ccStarter: {
    title: "Client CC is Agency and Studio",
    body: "Keep CiteBrief for your team on Starter, or upgrade when you want the Friday email to land in the client inbox.",
    cta: "Upgrade to Agency",
  },
  sendStarter: {
    title: "Email sending is on Agency",
    body: "Starter can download the PDF and copy a client link. Agency emails the Friday report and can CC the client.",
    cta: "Upgrade to Agency",
  },
  fourthSeatAgency: {
    title: "You hit the Agency seat cap",
    body: `Add a seat for $${SEAT_OVERAGE_USD}/mo, or upgrade to Studio for ${PLANS.studio.seats} seats so larger account teams can share Friday reports.`,
    cta: "See billing",
  },
  extraSeat: {
    title: "You hit the seat cap",
    body: `Add a seat for $${SEAT_OVERAGE_USD}/mo. Studio includes ${PLANS.studio.seats} seats if the account team is growing.`,
    cta: "See billing",
  },
  customSender: {
    title: "Custom sender needs Studio",
    body: "Studio unlocks custom sender name and domain so reports leave from your agency address. Agency keeps white-label PDF branding with the CiteBrief send path.",
    cta: "Upgrade to Studio",
  },
  membersStarter: {
    title: "Invites start on Agency",
    body: `Starter is ${PLANS.starter.seats} owner seat. Agency includes ${PLANS.agency.seats} seats so an account manager can send Friday reports.`,
    cta: "Upgrade to Agency",
  },
  extraBrandAgency: {
    title: "You hit the Agency brand cap",
    body: `Add an extra brand for $${EXTRA_BRAND_USD.agency}/mo, or move to Studio for ${PLANS.studio.brands} brands, custom sender, and portfolio CSV export. Extra brands are not available on trial or Starter.`,
    cta: "See billing",
  },
  extraBrandStudio: {
    title: "You hit the Studio brand cap",
    body: `Add an extra brand for $${EXTRA_BRAND_USD.studio}/mo, or talk to us about Enterprise for higher contractual floors.`,
    cta: "See billing",
  },
  extraRun: {
    title: "This run is outside the included cap",
    body: `Paid plans include scheduled reports plus monthly re-check credits (${MONTHLY_RECHECK_CREDITS.starter} on Starter, ${MONTHLY_RECHECK_CREDITS.agency} on Agency, ${MONTHLY_RECHECK_CREDITS.studio} on Studio). Extra re-checks are $${EXTRA_RUN_USD.agency} after credits — buy one before running again. Extra brands stay Agency+ only.`,
    cta: `Buy extra run · $${EXTRA_RUN_USD.agency}`,
  },
  extraRunTrial: {
    title: "Trial includes one full report",
    body: `Trial is ${TRIAL_RUN_CAP} report on ChatGPT + Gemini with ${TRIAL_PROMPT_CAP} buyer questions. No prepaid extra runs on trial. Subscribe to unlock monthly re-check credits, then $${EXTRA_RUN_USD.agency} extras.`,
    cta: "See billing",
  },
} as const;

export type UpgradeCopyBlock = (typeof UPGRADE_COPY)[keyof typeof UPGRADE_COPY];

/** Pick brand-cap upgrade copy from API error text (client components have no entitlements). */
export function brandCapUpgradeFromError(error: string | null | undefined): UpgradeCopyBlock {
  const text = (error ?? "").toLowerCase();
  if (text.includes("trial") || text.includes("unpaid")) return UPGRADE_COPY.trialBrand;
  if (text.includes("starter")) return UPGRADE_COPY.thirdBrand;
  if (text.includes("studio")) return UPGRADE_COPY.extraBrandStudio;
  if (text.includes("enterprise")) return UPGRADE_COPY.extraBrandStudio;
  if (text.includes("agency") || text.includes("extra brand")) return UPGRADE_COPY.extraBrandAgency;
  return UPGRADE_COPY.thirdBrand;
}

/** Pick extra-run upgrade copy from API error text. */
export function extraRunUpgradeFromError(error: string | null | undefined): UpgradeCopyBlock {
  const text = (error ?? "").toLowerCase();
  if (text.includes("trial") || text.includes("unpaid")) return UPGRADE_COPY.extraRunTrial;
  return UPGRADE_COPY.extraRun;
}

/** Prefer structured API `code` from brand/run cap responses. */
export function upgradeCopyForCapCode(
  code: string | null | undefined,
  error?: string | null,
): UpgradeCopyBlock {
  if (code === "trial_brand_cap") return UPGRADE_COPY.trialBrand;
  if (code === "trial_run_cap") return UPGRADE_COPY.extraRunTrial;
  if (code === "brand_cap") return brandCapUpgradeFromError(error);
  if (code === "run_cap" || code === "subscription_ended") {
    return extraRunUpgradeFromError(error);
  }
  if (error) {
    if (error.toLowerCase().includes("brand") || error.toLowerCase().includes("client")) {
      return brandCapUpgradeFromError(error);
    }
    return extraRunUpgradeFromError(error);
  }
  return UPGRADE_COPY.extraRun;
}
