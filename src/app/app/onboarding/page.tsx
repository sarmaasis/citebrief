import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { workspaceEntitlements } from "@/lib/entitlements";
import { serializeOnboardingResume, shouldResumeOnboardingBrand } from "@/lib/onboarding-resume";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { getBrandBundle, listWorkspaceBrands } from "@/server/workspace-data";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string; new?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const startFresh = params.new === "1";

  let resume = null;
  if (!startFresh) {
    const rows = await listWorkspaceBrands(ctx);
    const resumeId = shouldResumeOnboardingBrand({
      startFresh,
      requestedBrandId: params.brandId,
      brandIds: rows.map((row) => row.id),
    });
    if (resumeId) {
      const bundle = await getBrandBundle(ctx, resumeId);
      if (bundle) resume = serializeOnboardingResume(bundle);
    }
  }

  return (
    <OnboardingFlow
      allowSend={ent.allowsEmailSend}
      allowApproval={ent.allowsApproval}
      resume={resume}
      startFresh={startFresh}
    />
  );
}
