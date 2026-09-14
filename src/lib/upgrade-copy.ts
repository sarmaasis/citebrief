import { EXTRA_BRAND_USD, EXTRA_RUN_USD, PLANS, SEAT_OVERAGE_USD } from "@/lib/billing";

/** Server-safe copy. Do not keep this in a `"use client"` file — named exports go undefined on RSC. */
export const UPGRADE_COPY = {
  thirdBrand: {
    title: "Need a third client brand?",
    body: `Starter includes ${PLANS.starter.brands} brands. Agency includes ${PLANS.agency.brands} client brands and weekly Friday reports so every retainer gets a finished artifact.`,
    cta: "Upgrade to Agency",
  },
  fourthBrand: {
    title: "Need a third client brand?",
    body: `Starter includes ${PLANS.starter.brands} brands. Agency includes ${PLANS.agency.brands} client brands and weekly Friday reports so every retainer gets a finished artifact.`,
    cta: "Upgrade to Agency",
  },
  weeklyStarter: {
    title: "Weekly reports are on Agency",
    body: "Starter stays monthly. Agency ships every Friday with white-label and client CC.",
    cta: "Upgrade to Agency",
  },
  commandCenter: {
    title: "This view is on Agency",
    body: "Trial and Starter stay on a lighter Home. Agency unlocks the Friday send queue, client risk, and opportunity rollups.",
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
    body: "Studio unlocks custom sender name and domain so reports leave from your agency address.",
    cta: "Upgrade to Studio",
  },
  membersStarter: {
    title: "Invites start on Agency",
    body: `Starter is ${PLANS.starter.seats} owner seat. Agency includes ${PLANS.agency.seats} seats so an account manager can send Friday reports.`,
    cta: "Upgrade to Agency",
  },
  extraBrandAgency: {
    title: "You hit the Agency brand cap",
    body: `Add an extra brand for $${EXTRA_BRAND_USD.agency}/mo, or move to Studio for ${PLANS.studio.brands} brands and custom sender.`,
    cta: "See billing",
  },
  extraRun: {
    title: "This run is outside the included cap",
    body: `Agency includes ${PLANS.agency.manualRerunsPerBrandPerWeek} manual re-runs per brand per week. Extra runs are $${EXTRA_RUN_USD.agency} so Friday delivery is never blocked by a re-check.`,
    cta: "See usage",
  },
} as const;
