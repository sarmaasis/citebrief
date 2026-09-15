"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ANNUAL_MONTHS_CHARGED,
  EXTRA_BRAND_USD,
  EXTRA_RUN_USD,
  MONTHLY_RECHECK_CREDITS,
  PLANS,
  PREMIUM_ENGINE_PACK_USD,
  SEAT_OVERAGE_USD,
  TRIAL_BRAND_CAP,
  TRIAL_DAYS,
  TRIAL_PROMPT_CAP,
  TRIAL_RUN_CAP,
  planAnnualAmountUsd,
  type PublicPlanId,
} from "@/lib/billing";
import { planCtaHref } from "@/lib/marketing-cta";
import { PRICING_FAQS } from "@/lib/pricing-faq";
import { cn } from "@/lib/utils";

const plans = [
  {
    id: "starter" as const,
    name: "Starter",
    monthly: PLANS.starter.amountUsd,
    recommended: false,
    pitch: "For founders and small teams checking whether AI search can find and recommend them.",
    monthlyCta: "Start trial",
    annualCta: "Start annual",
    bullets: [
      `${PLANS.starter.brands} brands`,
      `${PLANS.starter.brands * PLANS.starter.prompts} tracked question capacity`,
      `${PLANS.starter.prompts} buyer questions per brand`,
      "Monthly report cadence",
      "CiteBrief sender",
      "PDF download and private client link",
      `${MONTHLY_RECHECK_CREDITS.starter} manual re-check credits/mo`,
      "Basic recommended actions and prompt performance",
      "ChatGPT, Gemini, Grok, and AI Overviews",
      `${PLANS.starter.seats} seat`,
      "No weekly send, client email, extra brands, or command center",
    ],
  },
  {
    id: "agency" as const,
    name: PLANS.agency.name,
    monthly: PLANS.agency.amountUsd,
    recommended: true,
    pitch: "For in-house marketing and GEO teams that need weekly tracking, trends, and actions.",
    monthlyCta: `Start ${PLANS.agency.name} trial`,
    annualCta: `Start ${PLANS.agency.name} annual`,
    bullets: [
      `${PLANS.agency.brands} brands or projects`,
      `${PLANS.agency.brands * PLANS.agency.prompts} tracked question capacity`,
      `${PLANS.agency.prompts} buyer questions per brand`,
      `${PLANS.agency.seats} seats`,
      "Weekly Friday reports",
      `${MONTHLY_RECHECK_CREDITS.agency} manual re-check credits/mo`,
      "Executive PDF, private share links, and team reporting",
      "Visibility dashboard: scorecards, competitors, opportunities, risks, pipeline",
      "History and week-over-week movement",
      "Cited pages on every report (in-app drawer + PDF shortlist)",
      "Prospect pitch audits (48h, no client slot)",
      "Recommended next actions and content fixes",
      "ChatGPT, Gemini, Grok, and AI Overviews",
      "Slack webhook",
      `Extra brands at $${EXTRA_BRAND_USD.agency}/mo`,
      `Perplexity via $${PREMIUM_ENGINE_PACK_USD}/mo engine pack`,
    ],
  },
  {
    id: "studio" as const,
    name: PLANS.studio.name,
    monthly: PLANS.studio.amountUsd,
    recommended: false,
    pitch: "For agencies and consultants packaging AI-search reporting across a client portfolio.",
    monthlyCta: `Start ${PLANS.studio.name} trial`,
    annualCta: `Start ${PLANS.studio.name} annual`,
    bullets: [
      `${PLANS.studio.brands} client brands`,
      `${PLANS.studio.brands * PLANS.studio.prompts} tracked question capacity`,
      `${PLANS.studio.prompts} buyer questions per brand`,
      `Everything in ${PLANS.agency.name}`,
      "Weekly Friday reports",
      `${MONTHLY_RECHECK_CREDITS.studio} manual re-check credits/mo`,
      "Custom sender name and domain",
      "Bulk approve and send",
      "Portfolio filters and CSV export",
      "Prospect pitch audits (48h PDF, convert on win)",
      "Cited pages on every report",
      "ChatGPT, Gemini, Grok, AI Overviews, and Perplexity",
      `${PLANS.studio.seats} seats`,
      "Coming soon: client portal archive, Looker Studio/API exports, priority processing",
      `Extra brands at $${EXTRA_BRAND_USD.studio}/mo`,
    ],
  },
];

export function PricingView({
  signedIn = false,
  annualProductsLive = { starter: false, agency: false, studio: false },
  initialAnnual = false,
}: {
  signedIn?: boolean;
  annualProductsLive?: Record<PublicPlanId, boolean>;
  initialAnnual?: boolean;
}) {
  const [annual, setAnnual] = useState(initialAnnual);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (annual) url.searchParams.set("interval", "annual");
    else url.searchParams.delete("interval");
    window.history.replaceState(null, "", url);
  }, [annual]);
  const missingAnnual = (Object.keys(annualProductsLive) as PublicPlanId[]).filter((id) => !annualProductsLive[id]);
  const annualLive = missingAnnual.length === 0;

  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-24">
      <h1 className="font-serif text-3xl tracking-tight sm:text-5xl">AI-search visibility for teams and agencies</h1>
      <p className="mt-4 max-w-2xl text-lg text-cb-muted">
        Start with a brand visibility report, then scale into weekly tracking, competitor movement,
        cited sources, and client-ready reporting. {PLANS.agency.name} gives teams{" "}
        {PLANS.agency.brands * PLANS.agency.prompts} tracked questions; {PLANS.studio.name} gives
        agencies {PLANS.studio.brands * PLANS.studio.prompts} tracked questions plus white-label
        sending.
      </p>

      <div className="mt-8 inline-flex max-w-full flex-wrap rounded-cb-control border border-cb-line bg-cb-surface p-1">
        <button
          type="button"
          onClick={() => setAnnual(false)}
          className={cn(
            "rounded-cb-control px-3 py-1.5 text-sm",
            !annual ? "bg-cb-accent text-cb-on-accent" : "text-cb-muted",
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setAnnual(true)}
          className={cn(
            "rounded-cb-control px-3 py-1.5 text-sm",
            annual ? "bg-cb-accent text-cb-on-accent" : "text-cb-muted",
          )}
        >
          Annual ({12 - ANNUAL_MONTHS_CHARGED} months free)
        </button>
      </div>
      {annual ? (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-cb-muted">
          {annualLive
            ? `Annual checkout is ${ANNUAL_MONTHS_CHARGED} months prepaid. Start a plan to go to annual checkout.`
            : `Annual is ${ANNUAL_MONTHS_CHARGED} months prepaid. Start a plan and we still send interval=annual into checkout. Live annual Dodo products are not configured yet${
                missingAnnual.length ? ` (${missingAnnual.join(", ")})` : ""
              }, so the charge may use the monthly product until those IDs are set.`}
        </p>
      ) : null}

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const annualTotal = plan.monthly * ANNUAL_MONTHS_CHARGED;
          const price = annual ? Math.round(annualTotal / 12) : plan.monthly;
          const interval = annual ? "annual" : "monthly";
          const href = planCtaHref({ plan: plan.id, interval, signedIn });
          return (
            <article
              key={plan.name}
              className={cn(
                "flex flex-col rounded-cb-card border bg-cb-surface p-6",
                plan.recommended ? "border-2 border-cb-accent" : "border-cb-line",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                {plan.recommended ? (
                  <span className="rounded-cb-control bg-cb-accent-subtle px-2 py-1 text-xs text-cb-accent">
                    Recommended
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-cb-muted">{plan.pitch}</p>
              <p className="mt-4 font-mono text-3xl tabular-nums">
                ${price}
                <span className="text-sm text-cb-muted">/mo</span>
              </p>
              {annual ? (
                <p className="mt-1 text-xs text-cb-muted">${annualTotal.toLocaleString("en-US")} billed annually</p>
              ) : (
                <p className="mt-1 text-xs text-cb-muted">Billed monthly</p>
              )}
              <ul className="mt-6 flex-1 space-y-2 text-sm text-cb-muted">
                {plan.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <Button asChild className="mt-8 w-full" variant={plan.recommended ? "default" : "outline"}>
                <Link href={href}>{annual ? plan.annualCta : plan.monthlyCta}</Link>
              </Button>
            </article>
          );
        })}
      </div>

      <p className="mt-6 text-sm leading-6 text-cb-muted">
        Add-ons: extra brand ${EXTRA_BRAND_USD.agency}/mo on {PLANS.agency.name} and {PLANS.studio.name} only (not trial or
        Starter). Extra run ${EXTRA_RUN_USD.agency} after monthly re-check credits on paid plans.
        Extra seats ${SEAT_OVERAGE_USD}/seat/mo after the plan cap. Premium engine pack $
        {PREMIUM_ENGINE_PACK_USD}/mo adds Perplexity on {PLANS.agency.name}. Tax handled by Dodo. Trial:{" "}
        {TRIAL_DAYS} days, {TRIAL_BRAND_CAP} brand, {TRIAL_PROMPT_CAP} buyer questions,{" "}
        {TRIAL_RUN_CAP} full run on ChatGPT, Gemini, Grok, and AI Overviews. No free forever plan.
      </p>
      <p className="mt-3 text-sm leading-6 text-cb-muted">
        Enterprise starts at ${PLANS.enterprise.amountUsd.toLocaleString("en-US")}/mo or annual
        contract for custom limits, dedicated onboarding, SSO-ready review, and priority support.
        Ask during onboarding — there is no self-serve Enterprise checkout.
      </p>
      <p className="mt-3 text-sm leading-6 text-cb-muted">
        Launch: first 25 paid workspaces can lock {PLANS.agency.name} annual at $
        {planAnnualAmountUsd("agency").toLocaleString("en-US")} for 12 months. First 20 paid workspaces
        get done-with-you setup.
      </p>

      <section className="mt-16 max-w-3xl">
        <h2 className="text-xl font-semibold">Questions buyers actually ask</h2>
        <div className="mt-6 divide-y divide-cb-line border-y border-cb-line">
          {PRICING_FAQS.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-cb-text">
                <h3 className="inline text-sm font-medium">{item.q}</h3>
              </summary>
              <p className="mt-2 text-sm leading-6 text-cb-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
