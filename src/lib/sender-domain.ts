import { isValidSenderDomain } from "@/lib/email";

/** CiteBrief-owned sending / product domain. Auth, trial CC, and Agency From use this. */
export const SYSTEM_SENDER_DOMAIN = "getcitebrief.com";

/** Default From when CF_EMAIL_FROM is unset. */
export const SYSTEM_FROM_ADDRESS = `CiteBrief <auth@${SYSTEM_SENDER_DOMAIN}>`;

export type SenderDomainStatus = "system" | "none" | "pending" | "verified";

export type SenderDomainChecks = {
  spfOk: boolean;
  dkimOk: boolean;
  dmarcOk: boolean;
  cfOk: boolean;
};

export type SenderDomainSnapshot = {
  systemDomain: typeof SYSTEM_SENDER_DOMAIN;
  systemFrom: typeof SYSTEM_FROM_ADDRESS;
  allowsCustomSender: boolean;
  senderName: string | null;
  senderDomain: string | null;
  checks: SenderDomainChecks;
  status: SenderDomainStatus;
  verifiedAt: string | null;
  /** True when Studio may send as reports@{senderDomain}. */
  customFromActive: boolean;
  previewFrom: string;
};

export function normalizeSenderDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
  if (!cleaned) return null;
  return cleaned;
}

/** Custom domain must be a real hostname and must not collide with CiteBrief's system domain. */
export function isAllowedCustomSenderDomain(value: string): boolean {
  const domain = normalizeSenderDomain(value);
  if (!domain || !isValidSenderDomain(domain)) return false;
  if (domain === SYSTEM_SENDER_DOMAIN) return false;
  if (domain.endsWith(`.${SYSTEM_SENDER_DOMAIN}`)) return false;
  return true;
}

export function allSenderDomainChecksOk(checks: SenderDomainChecks): boolean {
  return Boolean(checks.spfOk && checks.dkimOk && checks.dmarcOk && checks.cfOk);
}

export function deriveSenderDomainStatus(args: {
  allowsCustomSender: boolean;
  senderDomain: string | null | undefined;
  checks: SenderDomainChecks;
  verifiedAt?: Date | number | null;
}): SenderDomainStatus {
  if (!args.allowsCustomSender) return "system";
  const domain = normalizeSenderDomain(args.senderDomain);
  if (!domain) return "none";
  if (allSenderDomainChecksOk(args.checks) && args.verifiedAt) return "verified";
  if (allSenderDomainChecksOk(args.checks)) return "verified";
  return "pending";
}

export function isCustomSenderDomainVerified(args: {
  allowsCustomSender: boolean;
  senderDomain: string | null | undefined;
  checks: SenderDomainChecks;
}): boolean {
  if (!args.allowsCustomSender) return false;
  const domain = normalizeSenderDomain(args.senderDomain);
  if (!domain || !isAllowedCustomSenderDomain(domain)) return false;
  return allSenderDomainChecksOk(args.checks);
}

export function previewSenderFrom(args: {
  allowsCustomSender: boolean;
  senderName?: string | null;
  senderDomain?: string | null;
  checks: SenderDomainChecks;
  systemFrom?: string;
}): string {
  const systemFrom = args.systemFrom?.trim() || SYSTEM_FROM_ADDRESS;
  const name = args.senderName?.trim();
  const verified = isCustomSenderDomainVerified({
    allowsCustomSender: args.allowsCustomSender,
    senderDomain: args.senderDomain,
    checks: args.checks,
  });
  if (verified) {
    const domain = normalizeSenderDomain(args.senderDomain)!;
    const display = name || "Reports";
    return `${display} <reports@${domain}>`;
  }
  if (args.allowsCustomSender && name) {
    const match = systemFrom.match(/<([^>]+)>/);
    const email = match?.[1] || `auth@${SYSTEM_SENDER_DOMAIN}`;
    return `${name} <${email}>`;
  }
  return systemFrom;
}

export function buildSenderDomainSnapshot(args: {
  allowsCustomSender: boolean;
  senderName?: string | null;
  senderDomain?: string | null;
  checks: SenderDomainChecks;
  verifiedAt?: Date | number | null;
  systemFrom?: string;
}): SenderDomainSnapshot {
  const senderDomain = normalizeSenderDomain(args.senderDomain);
  const verifiedAt =
    args.verifiedAt instanceof Date
      ? args.verifiedAt.toISOString()
      : typeof args.verifiedAt === "number"
        ? new Date(args.verifiedAt).toISOString()
        : null;
  const status = deriveSenderDomainStatus({
    allowsCustomSender: args.allowsCustomSender,
    senderDomain,
    checks: args.checks,
    verifiedAt: args.verifiedAt,
  });
  const customFromActive = isCustomSenderDomainVerified({
    allowsCustomSender: args.allowsCustomSender,
    senderDomain,
    checks: args.checks,
  });
  return {
    systemDomain: SYSTEM_SENDER_DOMAIN,
    systemFrom: SYSTEM_FROM_ADDRESS,
    allowsCustomSender: args.allowsCustomSender,
    senderName: args.senderName?.trim() || null,
    senderDomain,
    checks: args.checks,
    status,
    verifiedAt: customFromActive ? verifiedAt : null,
    customFromActive,
    previewFrom: previewSenderFrom({
      allowsCustomSender: args.allowsCustomSender,
      senderName: args.senderName,
      senderDomain,
      checks: args.checks,
      systemFrom: args.systemFrom,
    }),
  };
}

/** Manual Cloudflare Email Sending checklist shown in Settings → Domains. */
export const CUSTOM_DOMAIN_DNS_STEPS = [
  {
    id: "cf" as const,
    label: "Onboard in Cloudflare Email Sending",
    detail:
      "Ask CiteBrief support to onboard your hostname (or onboard it on the CiteBrief Cloudflare account). Email Sending requires Cloudflare DNS.",
  },
  {
    id: "spf" as const,
    label: "SPF on cf-bounce",
    detail:
      "Confirm TXT at cf-bounce.yourdomain.com includes include:_spf.mx.cloudflare.net (Cloudflare Email Sending creates this).",
  },
  {
    id: "dkim" as const,
    label: "DKIM selector",
    detail:
      "Confirm cf-bounce._domainkey.yourdomain.com TXT from Email Sending → Settings is present and Locked/valid.",
  },
  {
    id: "dmarc" as const,
    label: "DMARC policy",
    detail:
      "Confirm TXT at _dmarc.yourdomain.com (start with p=none, then quarantine). Cloudflare may add this on onboard.",
  },
] as const;

/** Ops checklist for the CiteBrief-owned getcitebrief.com sender. */
export const SYSTEM_DOMAIN_OPS_STEPS = [
  "Onboard getcitebrief.com in Cloudflare Email Sending (Compute → Email Service).",
  "Confirm SPF/DKIM/DMARC records Cloudflare creates on cf-bounce.getcitebrief.com and _dmarc.getcitebrief.com.",
  "Worker var CF_EMAIL_FROM = CiteBrief <auth@getcitebrief.com>; wrangler send_email binding name EMAIL.",
  "Send a magic-link and a Friday report to a real inbox and confirm they land outside spam.",
] as const;

export function checksFromWorkspace(row: {
  senderDomainSpfOk?: boolean | null;
  senderDomainDkimOk?: boolean | null;
  senderDomainDmarcOk?: boolean | null;
  senderDomainCfOk?: boolean | null;
}): SenderDomainChecks {
  return {
    spfOk: Boolean(row.senderDomainSpfOk),
    dkimOk: Boolean(row.senderDomainDkimOk),
    dmarcOk: Boolean(row.senderDomainDmarcOk),
    cfOk: Boolean(row.senderDomainCfOk),
  };
}
