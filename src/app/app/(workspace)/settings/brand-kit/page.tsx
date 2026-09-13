import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BrandKitForm } from "@/components/settings/brand-kit-form";
import { getAppContext } from "@/lib/session";
import { brandKits } from "@/db/schema";

export default async function BrandKitPage() {
  const ctx = await getAppContext();
  if (!ctx) {
    notFound();
  }
  const [kit] = await ctx.db
    .select()
    .from(brandKits)
    .where(eq(brandKits.workspaceId, ctx.workspace.id))
    .limit(1);

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Brand kit</h1>
          <p className="mt-3 text-sm text-cb-muted">
            Logo, color, footer, and Prepared by appear on PDFs and client links. CiteBrief stays off the client page.
          </p>
      <div className="mt-8">
        <BrandKitForm
          initial={{
            logoUrl: kit?.logoUrl || "",
            accentColor: kit?.accentColor || "#0B3D2E",
            footerText: kit?.footerText || "",
            preparedBy: kit?.preparedBy || ctx.workspace.name,
          }}
        />
      </div>
    </div>
  );
}
