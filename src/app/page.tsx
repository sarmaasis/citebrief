import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { PdfPreview } from "@/components/marketing/pdf-preview";

const bento = [
  { title: "Named in 12 of 20", body: "Score the week without a dashboard lecture." },
  { title: "Who won", body: 'ClickUp won "Asana alternatives for agencies".' },
  { title: "Next action", body: "Write a comparison page for Asana vs Northstar." },
  { title: "Friday send", body: "In the inbox before standup." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <MarketingHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="font-serif text-[56px] leading-[1.05] tracking-tight text-cb-text lg:text-[64px]">
              The Friday PDF your client actually reads.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-cb-muted">
              Agencies track twenty buyer questions across ChatGPT, Perplexity, Gemini, and AI
              Overviews. Every Friday, CiteBrief emails a white-label report.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup">Start the first report</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/report">View a sample</Link>
              </Button>
            </div>
          </div>
          <PdfPreview />
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-4 md:grid-cols-2">
            {bento.map((cell) => (
              <div key={cell.title} className="rounded-cb-panel border border-cb-line bg-cb-surface p-6">
                <p className="text-sm font-medium text-cb-accent">{cell.title}</p>
                <p className="mt-2 text-sm text-cb-muted">{cell.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-cb-line">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-16 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Agency retainers need a Friday artifact.</h2>
              <p className="mt-2 text-sm text-cb-muted">Start with one brand. Send the first report this week.</p>
            </div>
            <Button asChild>
              <Link href="/pricing">See Agency at $199</Link>
            </Button>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
