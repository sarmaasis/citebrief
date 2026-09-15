import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { PitchDomainForm } from "@/components/brands/pitch-domain-form";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { UPGRADE_COPY } from "@/lib/upgrade-copy";
import { upgradeHintForBrandCap, workspaceEntitlements } from "@/lib/entitlements";
import { serializeOnboardingResume, shouldResumeOnboardingBrand } from "@/lib/onboarding-resume";
import { getAppContext } from "@/lib/session";
import { countActiveBrands, getWorkspaceSubscription } from "@/lib/usage";
import { getBrandBundle, listWorkspaceBrands } from "@/server/workspace-data";

function domainSeed(raw?: string) {
  if (!raw?.trim()) return {};
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./i, "");
    const slug = host.split(".")[0] || host;
    return {
      name: slug.charAt(0).toUpperCase() + slug.slice(1),
      siteUrl: `https://${host}`,
    };
  } catch {
    return { siteUrl: raw };
  }
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{
    brandId?: string;
    new?: string;
    siteUrl?: string;
    competitors?: string;
    market?: string;
    kind?: string;
  }>;
}) {
  const params = await searchParams;
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");

  if (params.kind === "pitch") {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">48h pitch audit</h1>
          <p className="mt-2 text-sm text-cb-muted">
            One-shot prospect PDF. Does not use a client slot. Convert on win to keep tracking.
          </p>
        </div>
        <div className="rounded-cb-card border border-cb-line bg-cb-surface p-5">
          <PitchDomainForm />
        </div>
        <p className="text-sm text-cb-muted">
          <Link href="/app" className="text-cb-accent">
            Back to This week
          </Link>
        </p>
      </div>
    );
  }

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const startFresh = params.new === "1";

  if (startFresh) {
    const active = await countActiveBrands(ctx.db, ctx.workspace.id);
    if (active >= ent.brandLimit) {
      const upgrade = !ent.paid
        ? UPGRADE_COPY.trialBrand
        : ent.plan === "starter"
          ? UPGRADE_COPY.thirdBrand
          : ent.plan === "studio" || ent.plan === "enterprise"
            ? UPGRADE_COPY.extraBrandStudio
            : UPGRADE_COPY.extraBrandAgency;
      return (
        <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
          <h1 className="text-xl font-semibold tracking-tight">Client limit reached</h1>
          <UpgradePrompt title={upgrade.title} body={upgradeHintForBrandCap(ent)} cta={upgrade.cta} />
          <p className="text-sm text-cb-muted">
            <Link href="/app/brands" className="text-cb-accent">
              Back to clients
            </Link>
          </p>
        </div>
      );
    }
  }

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
      promptCap={ent.promptCap}
      initialFields={{
        ...domainSeed(params.siteUrl),
        ...("competitors" in params && params.competitors ? { competitors: params.competitors } : {}),
        ...("market" in params && params.market ? { market: params.market } : {}),
      }}
    />
  );
}
