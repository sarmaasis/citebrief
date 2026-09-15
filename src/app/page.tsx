import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { DomainLeadForm } from "@/components/marketing/domain-lead-form";
import { PdfPreview } from "@/components/marketing/pdf-preview";
import { SAMPLE_REPORT } from "@/components/marketing/sample-report-data";
import { JsonLd } from "@/components/seo/json-ld";
import { PLANS, TRIAL_BRAND_CAP, TRIAL_DAYS, TRIAL_PROMPT_CAP, TRIAL_RUN_CAP } from "@/lib/billing";
import { homeJsonLd, metadataPages } from "@/lib/seo";
import { getMarketingAuth } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = metadataPages.home;

const steps = [
  {
    n: "01",
    title: "You add a client, 3 competitors, a market",
    body: "CiteBrief writes an unbranded buyer pack. Branded checks stay in an appendix and do not raise the score.",
  },
  {
    n: "02",
    title: "We run the pack on the engines",
    body: "ChatGPT, Gemini, Grok, and Google AI Overviews. Mentioned, cited, who won — fail closed if an engine dies.",
  },
  {
    n: "03",
    title: "Friday you get a PDF the AM forwards",
    body: "White-label cover, per-engine table, five actions. No client login.",
  },
];

const problems = [
  { title: "The slide is a screenshot", body: "One ChatGPT grab is not a metric." },
  { title: "The prompt had the brand in it", body: "“What is Acme?” always cites Acme." },
  { title: "The client still doesn’t have a number", body: "They need dated sample size, not a vibe." },
];

const fit = [
  "Practices with retainers",
  "Consultants with more than one logo",
  "In-house teams with more than one brand",
];

export default async function HomePage() {
  const auth = await getMarketingAuth();
  return (
    <div className="min-h-screen">
      <JsonLd json={homeJsonLd()} />
      <MarketingHeader />
      <main id="main">
        <section className="mx-auto grid max-w-6xl items-start gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-cb-accent">Friday brief for client teams</p>
            <h1 className="mt-3 font-serif text-4xl leading-[1.1] tracking-tight text-cb-text sm:text-5xl lg:text-[52px] lg:leading-[1.05]">
              The file your AM can forward when the client asks “are we in ChatGPT?”
            </h1>
            <p className="mt-6 max-w-xl text-lg text-cb-muted">
              Unbranded buyer questions across ChatGPT, Gemini, Grok, and Google AI Overviews. One white-label PDF
              per client, every Friday.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href="#send-domain">Send a client domain</a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/report">Read a sample brief</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-cb-muted">No client login. Your logo. Dated sample — not one screenshot.</p>
            <p className="mt-3 text-sm font-medium text-cb-text">
              66% of agencies say clients now ask for this. 48% still cannot measure it.
            </p>
            <p className="mt-1 text-xs text-cb-muted">AgencyAnalytics 2026 · n=494</p>
            <div id="send-domain">
              <DomainLeadForm signedIn={auth.signedIn} />
            </div>
            <p className="mt-4 text-sm text-cb-muted">
              {TRIAL_DAYS}-day trial: {TRIAL_BRAND_CAP} brand, {TRIAL_PROMPT_CAP} buyer questions, {TRIAL_RUN_CAP}{" "}
              full report. {PLANS.agency.name} is ${PLANS.agency.amountUsd}/mo for {PLANS.agency.brands} clients.
            </p>
          </div>
          <div>
            <PdfPreview />
          </div>
        </section>

        <section className="border-t border-cb-line">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3 sm:py-16">
            {problems.map((item) => (
              <div key={item.title}>
                <h2 className="text-base font-medium tracking-tight">{item.title}</h2>
                <p className="mt-2 text-sm text-cb-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-cb-line">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-24">
            <h2 className="text-2xl font-semibold tracking-tight">How a brief works</h2>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <li key={step.n} className="rounded-cb-panel border border-cb-line bg-cb-surface p-6">
                  <p className="font-mono text-xs tabular-nums text-cb-accent">{step.n}</p>
                  <h3 className="mt-3 text-base font-medium tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-cb-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-cb-line">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-24">
            <h2 className="text-2xl font-semibold tracking-tight">What’s on page 1</h2>
            <ul className="mt-6 max-w-xl space-y-2 text-sm text-cb-muted">
              <li>Mentioned or not, per engine</li>
              <li>Who got the slot</li>
              <li>Which buyer questions you lost</li>
              <li>Five actions for next week</li>
            </ul>
            <div className="mt-10 rounded-cb-panel border border-cb-line bg-cb-surface p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-cb-accent">Worked example</p>
              <p className="mt-3 text-lg font-medium tracking-tight text-cb-text">
                Northline kept the Northstar retainer by sending {SAMPLE_REPORT.named}/{SAMPLE_REPORT.total} named
                instead of screenshots.
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-cb-muted">{SAMPLE_REPORT.summary}</p>
              <Link href="/report" className="mt-4 inline-block text-sm text-cb-accent">
                Read the sample letter →
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-cb-line">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-24">
            <h2 className="text-2xl font-semibold tracking-tight">Who it’s for</h2>
            <ul className="mt-6 space-y-2 text-sm text-cb-text">
              {fit.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-cb-muted">Not a $29 personal score. Not a GEO optimizer.</p>
          </div>
        </section>

        <section className="border-t border-cb-line">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-12 sm:px-6 sm:py-16 md:flex-row md:items-center lg:py-24">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Send one domain. Friday you have a brief.</h2>
              <p className="mt-2 max-w-xl text-sm text-cb-muted">
                ${PLANS.agency.amountUsd}/mo for {PLANS.agency.brands} clients on {PLANS.agency.name}.{" "}
                {PLANS.studio.name} at ${PLANS.studio.amountUsd}/mo for {PLANS.studio.brands} brands and custom sender.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href="#send-domain">Send a client domain</a>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing">See {PLANS.agency.name} at ${PLANS.agency.amountUsd}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
