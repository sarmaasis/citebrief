import { notFound } from "next/navigation";
import { PromptsPage } from "@/components/prompts/prompts-page";
import { workspaceEntitlements } from "@/lib/entitlements";
import { topUpBrandPrompts } from "@/lib/prompt-topup";
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
  let bundle = await getBrandBundle(ctx, id);
  if (!bundle) {
    notFound();
  }

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const promptCap = workspaceEntitlements(sub).promptCap;

  // Recover this brand only (not the whole workspace) if still under the plan cap.
  if (bundle.prompts.length > 0 && bundle.prompts.length < promptCap) {
    await topUpBrandPrompts(ctx.db, bundle.brand.id, promptCap);
    bundle = (await getBrandBundle(ctx, id)) ?? bundle;
  }

  const initial: PromptDraft[] = normalizePromptDrafts(
    bundle.prompts.map((row) => ({
      id: row.id,
      text: row.text,
      mix: row.mix as PromptMix,
      sortOrder: row.sortOrder,
    })),
  );

  return (
    <PromptsPage brandId={bundle.brand.id} brandName={bundle.brand.name} initial={initial} promptCap={promptCap} />
  );
}
