import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { SampleReportDoc } from "@/components/marketing/sample-report-doc";
import { JsonLd } from "@/components/seo/json-ld";
import { metadataPages, reportJsonLd } from "@/lib/seo";

export const metadata: Metadata = metadataPages.report;

const bullets = [
  "Who won each buyer question",
  "One next action per gap",
  "Agency name on the cover, not CiteBrief",
];

export default function SampleReportPage() {
  return (
    <div className="min-h-screen bg-cb-bg">
      <JsonLd json={reportJsonLd()} />
      <MarketingHeader />
      <main className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Sample Friday report</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-cb-muted">
              Anonymized Northline Agency brief for Northstar. Same letter layout clients print. Read
              it before you start a trial.
            </p>
            <ul className="mt-4 space-y-1 text-sm text-cb-muted">
              {bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <Button asChild size="lg">
            <Link href="/signup?plan=agency">Start the first report</Link>
          </Button>
        </div>
        <div className="rounded-cb-panel border border-cb-line bg-cb-bg p-4 sm:p-10">
          <SampleReportDoc />
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-cb-line pt-10 sm:flex-row sm:items-center">
          <p className="max-w-xl text-sm text-cb-muted">
            14-day trial. 1 brand. 1 full report. Then Agency at $249/mo for weekly Friday sending.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/signup?plan=agency">Start the first report</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">See Agency at $249</Link>
            </Button>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
