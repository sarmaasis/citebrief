import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { PdfPreview } from "@/components/marketing/pdf-preview";
import { SAMPLE_REPORT } from "@/components/marketing/sample-report-data";
import { JsonLd } from "@/components/seo/json-ld";
import { homeJsonLd, metadataPages } from "@/lib/seo";

export const metadata: Metadata = metadataPages.home;

const bento = [
  {
    kicker: "Named",
    title: `Named in ${SAMPLE_REPORT.named} of ${SAMPLE_REPORT.total}`,
    body: "A score a CMO can read. Not a dashboard lecture.",
  },
  {
    kicker: "Who won",
    title: "ClickUp won the shortlist",
    body: "Asana alternatives for agencies still goes to a rival.",
  },
  {
    kicker: "Next action",
    title: "Write the comparison page",
    body: "Asana vs Northstar. One owner. Ten days.",
  },
  {
    kicker: "Friday send",
    title: "In the inbox before standup",
    body: "White-label PDF, optional client CC, private link.",
  },
];

const steps = [
  {
    n: "01",
    title: "Add one client brand",
    body: "Six fields. CiteBrief writes twenty buying questions. No vanity prompts about whether ChatGPT mentioned the brand.",
  },
  {
    n: "02",
    title: "Check the four engines",
    body: "ChatGPT, Perplexity, Gemini, and Google AI Overviews. Named, recommended, and who won.",
  },
  {
    n: "03",
    title: "Send the Friday PDF",
    body: "White-label cover, scores, next actions. Forward it without rewriting.",
  },
];

const fit = [
  "SEO and content agencies adding AI-search reporting to retainers.",
  "PR agencies proving third-party mentions and citations matter.",
  "Paid and search agencies defending strategy when buyers ask ChatGPT first.",
  "B2B SaaS agencies whose clients care about comparison and shortlist queries.",
];

const posture = [
  {
    against: "Cheap trackers",
    line: "Your client cannot read a dashboard score.",
  },
  {
    against: "Deep platforms",
    line: "Your account manager needs a finished report by Friday.",
  },
  {
    against: "SEO suite tabs",
    line: "AI-search reporting is a client deliverable, not another keyword module.",
  },
  {
    against: "Manual slides",
    line: "Stop spending strategist time copying screenshots.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <JsonLd json={homeJsonLd()} />
      <MarketingHeader />
      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="font-serif text-[56px] leading-[1.05] tracking-tight text-cb-text lg:text-[64px]">
              The Friday PDF your client actually reads.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-cb-muted">
              Track twenty buyer questions across ChatGPT, Perplexity, Gemini, and AI Overviews,
              then send a white-label Friday PDF with who won, where you were missing, and what to
              do next.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup?plan=agency">Start the first report</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/report">View a sample</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-cb-muted">
              14-day trial. 1 brand. 1 full report. Built for agencies managing multiple clients.
            </p>
          </div>
          <PdfPreview />
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20 lg:pb-24">
          <div className="grid gap-4 md:grid-cols-2">
            {bento.map((cell) => (
              <div key={cell.kicker} className="rounded-cb-panel border border-cb-line bg-cb-surface p-6">
                <p className="text-xs font-medium uppercase tracking-wide text-cb-accent">{cell.kicker}</p>
                <p className="mt-3 text-lg font-medium tracking-tight text-cb-text">{cell.title}</p>
                <p className="mt-2 text-sm text-cb-muted">{cell.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-cb-line">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
            <h2 className="text-2xl font-semibold tracking-tight">From one client brand to a Friday PDF</h2>
            <p className="mt-2 max-w-2xl text-sm text-cb-muted">
              The weekly artifact is the PDF. The product is the agency workflow around it.
            </p>
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
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">For agencies that already sell retainers</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-cb-muted">
                Primary buyer is an agency owner, strategy lead, or account director with 5 to 40
                clients. Account managers run the workflow. Clients just read the PDF.
              </p>
              <ul className="mt-8 space-y-3 text-sm leading-6 text-cb-text">
                {fit.map((item) => (
                  <li key={item} className="border-t border-cb-line pt-3 first:border-t-0 first:pt-0">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-cb-muted">
                Not a $29 personal score. Not a GEO optimizer, keyword tracker, or content factory.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Win on the report, not another dashboard</h2>
              <ul className="mt-8 space-y-0">
                {posture.map((item) => (
                  <li key={item.against} className="border-t border-cb-line py-4 first:border-t-0 first:pt-0">
                    <p className="text-sm font-medium text-cb-text">{item.against}</p>
                    <p className="mt-1 text-sm text-cb-muted">{item.line}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-t border-cb-line">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-16 md:flex-row md:items-center lg:py-24">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Agency retainers need a Friday artifact.</h2>
              <p className="mt-2 max-w-xl text-sm text-cb-muted">
                Start with one brand. Agency is $249/mo for weekly Friday reports. If this saves
                reporting hours and helps defend one $3k retainer, it is an operating expense.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/signup?plan=agency">Send a Friday report</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing">See Agency at $249</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
