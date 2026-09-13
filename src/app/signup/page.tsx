import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Logo } from "@/components/brand/logo";
import {
  ANNUAL_MONTHS_CHARGED,
  PLANS,
  planAnnualAmountUsd,
  TRIAL_BRAND_CAP,
  TRIAL_DAYS,
  TRIAL_RUN_CAP,
  type PlanId,
} from "@/lib/billing";
import { loginHref, postAuthPath, readPlanAndInterval } from "@/lib/marketing-cta";
import { metadataPages } from "@/lib/seo";

export const metadata: Metadata = metadataPages.signup;

function signupCopy(
  planId: PlanId | null,
  interval: "monthly" | "annual",
  invite: string | null,
) {
  if (invite) {
    return {
      title: "Accept your invite",
      body: "Create an account with the invited email. You will join the agency workspace.",
    };
  }
  const plan = planId ?? "agency";
  const listed = PLANS[plan];
  if (interval === "annual") {
    return {
      title: "Start the first report",
      body: `${TRIAL_DAYS}-day trial, then ${listed.name} annual at $${planAnnualAmountUsd(plan).toLocaleString("en-US")} (${ANNUAL_MONTHS_CHARGED} months prepaid). After you create the workspace you go to annual checkout.`,
    };
  }
  if (plan === "starter") {
    return {
      title: "Start the first report",
      body: `${TRIAL_DAYS}-day trial. ${TRIAL_BRAND_CAP} brand. ${TRIAL_RUN_CAP} full report. Starter is $${listed.amountUsd}/mo after that for monthly reports on ${listed.brands} brands.`,
    };
  }
  if (plan === "studio") {
    return {
      title: "Start the first report",
      body: `${TRIAL_DAYS}-day trial. ${TRIAL_BRAND_CAP} brand. ${TRIAL_RUN_CAP} full report. Studio is $${listed.amountUsd}/mo for ${listed.brands} brands, a custom sender, and weekly Friday reports.`,
    };
  }
  return {
    title: "Start the first report",
    body: `${TRIAL_DAYS}-day trial. ${TRIAL_BRAND_CAP} brand. ${TRIAL_RUN_CAP} full report. Agency is $${PLANS.agency.amountUsd}/mo for weekly Friday reports on ${PLANS.agency.brands} brands.`,
  };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; plan?: string; interval?: string }>;
}) {
  const params = await searchParams;
  const invite = params.invite?.trim() || null;
  const { planId, interval } = invite ? { planId: null, interval: "monthly" as const } : readPlanAndInterval(params);
  const copy = signupCopy(planId, interval, invite);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-sm leading-6 text-cb-muted">{copy.body}</p>
      {!invite ? (
        <ol className="mt-6 space-y-2 text-sm text-cb-muted">
          <li>1. Add one client brand.</li>
          <li>2. We generate twenty buying questions.</li>
          <li>3. Send or share the first PDF.</li>
        </ol>
      ) : null}
      <div className="mt-8">
        <AuthForm
          mode="signup"
          inviteToken={invite}
          nextPath={postAuthPath({ inviteToken: invite, plan: planId, interval })}
        />
      </div>
      {!invite ? (
        <p className="mt-6 text-sm text-cb-muted">
          Read the sample first?{" "}
          <Link href="/report" className="text-cb-accent">
            View a sample
          </Link>
          {" · "}
          <Link href="/pricing" className="text-cb-accent">
            See plans
          </Link>
        </p>
      ) : null}
      <p className="mt-4 text-sm text-cb-muted">
        Already have an account?{" "}
        <Link href={loginHref({ invite, plan: planId, interval })} className="text-cb-accent">
          Sign in
        </Link>
      </p>
    </main>
  );
}
