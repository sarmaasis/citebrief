"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    monthly: 149,
    brands: 3,
    prompts: 20,
    cadence: "Monthly",
    recommended: false,
    cta: "Start trial",
  },
  {
    name: "Agency",
    monthly: 199,
    brands: 8,
    prompts: 20,
    cadence: "Weekly",
    recommended: true,
    cta: "Start Agency trial",
  },
  {
    name: "Studio",
    monthly: 399,
    brands: 20,
    prompts: 30,
    cadence: "Weekly",
    recommended: false,
    cta: "Start trial",
  },
];

const faqs = [
  {
    q: "Can my client read the PDF without an account?",
    a: "Yes. Share a client link or CC them on the Friday email.",
  },
  {
    q: "What if one engine fails?",
    a: "We soft-fail. A three-engine report still ships.",
  },
  {
    q: "Is this a GEO optimizer?",
    a: "No. CiteBrief is the report layer your account team already promises.",
  },
  {
    q: "What is included in the trial?",
    a: "14 days, 1 brand, 1 full run.",
  },
  {
    q: "Can I pay annually?",
    a: "Annual is 10 months. Toggle above the cards.",
  },
];

export function PricingView() {
  const [annual, setAnnual] = useState(false);

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-serif text-5xl tracking-tight">Simple pricing for agency retainers</h1>
      <p className="mt-4 text-lg text-cb-muted">White-label Friday PDFs. Not a $29 vanity score.</p>

      <div className="mt-8 inline-flex rounded-cb-control border border-cb-line bg-cb-surface p-1">
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
          Annual (2 months free)
        </button>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const price = annual ? Math.round((plan.monthly * 10) / 12) : plan.monthly;
          return (
            <article
              key={plan.name}
              className={cn(
                "rounded-cb-card border bg-cb-surface p-6",
                plan.recommended ? "border-2 border-cb-accent" : "border-cb-line",
              )}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                {plan.recommended ? (
                  <span className="rounded-cb-control bg-cb-accent-subtle px-2 py-1 text-xs text-cb-accent">
                    Recommended
                  </span>
                ) : null}
              </div>
              <p className="mt-4 font-mono text-3xl tabular-nums">
                ${price}
                <span className="text-sm text-cb-muted">/mo</span>
              </p>
              <ul className="mt-6 space-y-2 text-sm text-cb-muted">
                <li>{plan.brands} brands</li>
                <li>{plan.prompts} prompts</li>
                <li>{plan.cadence} cadence</li>
              </ul>
              <Button asChild className="mt-8 w-full" variant={plan.recommended ? "default" : "outline"}>
                <Link href="/signup">{plan.cta}</Link>
              </Button>
            </article>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-cb-muted">Add-ons: extra brand and extra run meters. Tax handled by Dodo.</p>

      <section className="mt-16 max-w-3xl">
        <h2 className="text-xl font-semibold">Questions agencies actually ask</h2>
        <div className="mt-6 divide-y divide-cb-line border-y border-cb-line">
          {faqs.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-cb-text">
                {item.q}
              </summary>
              <p className="mt-2 text-sm text-cb-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
