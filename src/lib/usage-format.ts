import { EXTRA_RUN_USD, parsePlanId } from "@/lib/billing";

/** Billing panel / top-bar aligned copy for paid run meters. */
export function formatPaidRunsUsageHint(args: {
  plan: string;
  /** Settled Dodo-metered extras in the current metering window only. */
  billableExtrasThisPeriod: number;
  monthlyRecheckCredits: number;
  monthlyRechecksRemaining: number;
  extraRunCredits: number;
}): string {
  const planId = parsePlanId(args.plan) ?? "agency";
  const extraUsd = EXTRA_RUN_USD[planId];
  const parts: string[] = [];
  if (args.monthlyRecheckCredits > 0) {
    parts.push(
      `${args.monthlyRechecksRemaining}/${args.monthlyRecheckCredits} rechecks left this month`,
    );
  } else {
    parts.push("Includes weekly quota before paid extras.");
  }
  if (args.billableExtrasThisPeriod > 0) {
    parts.push(`${args.billableExtrasThisPeriod} extra at $${extraUsd}`);
  }
  if (args.extraRunCredits > 0) {
    parts.push(
      `${args.extraRunCredits} extra-run credit${args.extraRunCredits === 1 ? "" : "s"}`,
    );
  }
  return parts.join(" · ");
}
