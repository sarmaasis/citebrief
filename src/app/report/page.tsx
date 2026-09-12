import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { PdfPreview } from "@/components/marketing/pdf-preview";

export const metadata: Metadata = {
  title: "Sample report",
  description: "A white-label Friday PDF agencies can forward to clients.",
};

export default function SampleReportPage() {
  return (
    <div className="min-h-screen bg-cb-bg">
      <MarketingHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Sample Friday PDF</h1>
            <p className="mt-3 max-w-xl text-sm text-cb-muted">
              Anonymized agency brief. Same letter layout clients print. Live downloads land after the
              report engine.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled>
              Download PDF
            </Button>
            <Button type="button" variant="outline" disabled>
              Copy client link
            </Button>
          </div>
        </div>
        <div className="flex justify-center rounded-cb-panel border border-cb-line bg-cb-bg p-4 sm:p-10">
          <PdfPreview />
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
