import { notFound } from "next/navigation";
import { PromptsPage } from "@/components/prompts/prompts-page";
import { workspaceEntitlements } from "@/lib/entitlements";
import { normalizePromptDrafts, type PromptDraft, type PromptMix } from "@/lib/prompts";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { getBrandBundle } from "@/server/workspace-data";

export default async function BrandPromptsPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) {
    notFound();
  }
  const { id } = await params;
  const bundle = await getBrandBundle(ctx, id);
  if (!bundle) {
    notFound();
  }

  const initial: PromptDraft[] = normalizePromptDrafts(
    bundle.prompts.map((row) => ({
      text: row.text,
      mix: row.mix as PromptMix,
      sortOrder: row.sortOrder,
    })),
  );

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const promptCap = workspaceEntitlements(sub).promptCap;

  return (
    <PromptsPage brandId={bundle.brand.id} brandName={bundle.brand.name} initial={initial} promptCap={promptCap} />
  );
}
