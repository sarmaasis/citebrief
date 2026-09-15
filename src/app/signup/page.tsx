import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Logo } from "@/components/brand/logo";
import { AuthLegalLinks } from "@/components/marketing/footer";
import {
  ANNUAL_MONTHS_CHARGED,
  PLANS,
  planAnnualAmountUsd,
  TRIAL_BRAND_CAP,
  TRIAL_DAYS,
  TRIAL_PROMPT_CAP,
  TRIAL_RUN_CAP,
  type PlanId,
} from "@/lib/billing";
import { loginHref, postAuthPath, readPlanAndInterval } from "@/lib/marketing-cta";
import { getMarketingAuth } from "@/lib/session";
import { metadataPages } from "@/lib/seo";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = metadataPages.signup;

const trialLead = `${TRIAL_DAYS}-day trial. ${TRIAL_BRAND_CAP} brand. ${TRIAL_PROMPT_CAP} buyer questions. ${TRIAL_RUN_CAP} full report on ChatGPT, Gemini, Grok, and AI Overviews.`;

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
      body: `${trialLead} Then ${listed.name} annual at $${planAnnualAmountUsd(plan).toLocaleString("en-US")} (${ANNUAL_MONTHS_CHARGED} months prepaid). After you create the workspace you go to annual checkout.`,
    };
  }
  if (plan === "starter") {
    return {
      title: "Start the first report",
      body: `${trialLead} Starter is $${listed.amountUsd}/mo after that for monthly reports on ${listed.brands} brands. No weekly send, client email, extra brands, or command center.`,
    };
  }
  if (plan === "studio") {
    return {
      title: "Start the first report",
      body: `${trialLead} ${listed.name} is $${listed.amountUsd}/mo for ${listed.brands} brands, a custom sender, bulk send, portfolio CSV, and weekly Friday reports.`,
    };
  }
  if (plan === "enterprise") {
    return {
      title: "Start the first report",
      body: `${trialLead} Enterprise starts at $${listed.amountUsd.toLocaleString("en-US")}/mo for custom limits, SSO-ready review, and contract support.`,
    };
  }
  return {
    title: "Start the first report",
      body: `${trialLead} No weekly send or command center until paid. ${PLANS.agency.name} is $${PLANS.agency.amountUsd}/mo for ${PLANS.agency.brands} brands, weekly Friday reports, white-label, client CC, ${PLANS.agency.seats} seats, and the command-center dashboard.`,
  };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    invite?: string;
    plan?: string;
    interval?: string;
    email?: string;
    domain?: string;
    competitors?: string;
    market?: string;
  }>;
}) {
  const params = await searchParams;
  const invite = params.invite?.trim() || null;
  const { planId, interval } = invite ? { planId: null, interval: "monthly" as const } : readPlanAndInterval(params);
  const onboarding = new URLSearchParams({ new: "1" });
  if (params.domain) onboarding.set("siteUrl", params.domain);
  if (params.competitors) onboarding.set("competitors", params.competitors);
  if (params.market) onboarding.set("market", params.market);
  const nextPath = params.domain ? `/app/onboarding?${onboarding.toString()}` : postAuthPath({ inviteToken: invite, plan: planId, interval });
  const auth = await getMarketingAuth();
  if (auth.signedIn) {
    if (invite) redirect(`/invite/${invite}`);
    redirect(nextPath);
  }
  const copy = signupCopy(planId, interval, invite);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-sm leading-6 text-cb-muted">{copy.body}</p>
      {!invite ? (
        <ol className="mt-6 space-y-2 text-sm text-cb-muted">
          <li>1. Add one client brand.</li>
          <li>
            2. We generate {TRIAL_PROMPT_CAP} buyer questions on trial ({PLANS.agency.prompts} on paid
            plans).
          </li>
          <li>3. Send or share the first PDF.</li>
        </ol>
      ) : null}
      <div className="mt-8">
        <AuthForm
          mode="signup"
          inviteToken={invite}
          initialEmail={params.email ?? ""}
          nextPath={nextPath}
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
      <AuthLegalLinks />
    </main>
  );
}
