import assert from "node:assert/strict";
import {
  CUSTOM_DOMAIN_DNS_STEPS,
  SYSTEM_DOMAIN_OPS_STEPS,
  SYSTEM_FROM_ADDRESS,
  SYSTEM_SENDER_DOMAIN,
  allSenderDomainChecksOk,
  buildSenderDomainSnapshot,
  deriveSenderDomainStatus,
  isAllowedCustomSenderDomain,
  isCustomSenderDomainVerified,
  normalizeSenderDomain,
  previewSenderFrom,
} from "./sender-domain";
import { resolveFromAddress } from "./email";

assert.equal(SYSTEM_SENDER_DOMAIN, "getcitebrief.com");
assert.equal(SYSTEM_FROM_ADDRESS, "CiteBrief <auth@getcitebrief.com>");
assert.equal(CUSTOM_DOMAIN_DNS_STEPS.length, 4);
assert.ok(SYSTEM_DOMAIN_OPS_STEPS.length >= 3);

assert.equal(normalizeSenderDomain("https://Reports.Agency.com/path"), "reports.agency.com");
assert.equal(normalizeSenderDomain("  "), null);
assert.equal(isAllowedCustomSenderDomain("reports.agency.com"), true);
assert.equal(isAllowedCustomSenderDomain("getcitebrief.com"), false);
assert.equal(isAllowedCustomSenderDomain("mail.getcitebrief.com"), false);
assert.equal(isAllowedCustomSenderDomain("not a domain"), false);

const empty = { spfOk: false, dkimOk: false, dmarcOk: false, cfOk: false };
const full = { spfOk: true, dkimOk: true, dmarcOk: true, cfOk: true };
assert.equal(allSenderDomainChecksOk(empty), false);
assert.equal(allSenderDomainChecksOk(full), true);

assert.equal(
  deriveSenderDomainStatus({ allowsCustomSender: false, senderDomain: null, checks: empty }),
  "system",
);
assert.equal(
  deriveSenderDomainStatus({ allowsCustomSender: true, senderDomain: null, checks: empty }),
  "none",
);
assert.equal(
  deriveSenderDomainStatus({
    allowsCustomSender: true,
    senderDomain: "reports.agency.com",
    checks: empty,
  }),
  "pending",
);
assert.equal(
  deriveSenderDomainStatus({
    allowsCustomSender: true,
    senderDomain: "reports.agency.com",
    checks: full,
    verifiedAt: Date.now(),
  }),
  "verified",
);

assert.equal(
  isCustomSenderDomainVerified({
    allowsCustomSender: true,
    senderDomain: "reports.agency.com",
    checks: full,
  }),
  true,
);
assert.equal(
  isCustomSenderDomainVerified({
    allowsCustomSender: true,
    senderDomain: "reports.agency.com",
    checks: empty,
  }),
  false,
);

assert.equal(
  previewSenderFrom({
    allowsCustomSender: false,
    senderName: "Harbor",
    senderDomain: "reports.agency.com",
    checks: full,
  }),
  SYSTEM_FROM_ADDRESS,
);
assert.equal(
  previewSenderFrom({
    allowsCustomSender: true,
    senderName: "Harbor",
    senderDomain: "reports.agency.com",
    checks: empty,
  }),
  "Harbor <auth@getcitebrief.com>",
);
assert.equal(
  previewSenderFrom({
    allowsCustomSender: true,
    senderName: "Harbor",
    senderDomain: "reports.agency.com",
    checks: full,
  }),
  "Harbor <reports@reports.agency.com>",
);

const snap = buildSenderDomainSnapshot({
  allowsCustomSender: true,
  senderName: "Harbor",
  senderDomain: "Reports.Agency.com",
  checks: full,
  verifiedAt: new Date("2026-09-15T00:00:00.000Z"),
});
assert.equal(snap.status, "verified");
assert.equal(snap.customFromActive, true);
assert.equal(snap.senderDomain, "reports.agency.com");
assert.equal(snap.systemDomain, "getcitebrief.com");

assert.equal(
  resolveFromAddress({
    env: {},
    customSender: true,
    senderName: "Harbor",
    senderDomain: "reports.agency.com",
    domainVerified: false,
  }),
  "Harbor <auth@getcitebrief.com>",
);
assert.equal(
  resolveFromAddress({
    env: {},
    customSender: true,
    senderName: "Harbor",
    senderDomain: "reports.agency.com",
    domainVerified: true,
  }),
  "Harbor <reports@reports.agency.com>",
);
assert.equal(
  resolveFromAddress({
    env: {},
    customSender: false,
    senderName: "Harbor",
    senderDomain: "reports.agency.com",
    domainVerified: true,
  }),
  SYSTEM_FROM_ADDRESS,
);

console.log("sender-domain.test.ts ok");
