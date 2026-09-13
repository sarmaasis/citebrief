import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";

export default async function OnboardingPage() {
  const ctx = await getAppContext();
  const sub = ctx ? await getWorkspaceSubscription(ctx.db, ctx.workspace.id) : null;
  return <OnboardingFlow allowSend={workspaceEntitlements(sub).allowsEmailSend} />;
}
