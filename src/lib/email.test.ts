import assert from "node:assert/strict";
import { fridayReportEmail, inviteEmail, magicLinkEmail, verifyEmail } from "../emails";
import {
  DEFAULT_FROM,
  emailSendDecision,
  isEmailBindingReady,
  parseFromAddress,
  resolveFromAddress,
  sendTransactionalEmail,
} from "./email";

assert.equal(isEmailBindingReady({}), false);
assert.equal(isEmailBindingReady({ EMAIL: { send: async () => ({}) } }), true);

assert.equal(emailSendDecision({ NEXTJS_ENV: "production" }).action, "fail");
assert.match(emailSendDecision({ NEXTJS_ENV: "production" }).error || "", /missing in production/);
assert.equal(emailSendDecision({ NEXTJS_ENV: "development" }).action, "stub");
assert.equal(
  emailSendDecision({
    NEXTJS_ENV: "production",
    EMAIL: { send: async () => ({ messageId: "msg_1" }) },
  }).action,
  "send",
);

assert.equal(parseFromAddress("CiteBrief <auth@getcitebrief.com>").email, "auth@getcitebrief.com");
assert.equal(parseFromAddress("CiteBrief <auth@getcitebrief.com>").name, "CiteBrief");
assert.equal(resolveFromAddress({ env: {} }), DEFAULT_FROM);
assert.equal(
  resolveFromAddress({
    env: { CF_EMAIL_FROM: "CiteBrief <reports@getcitebrief.com>" },
    customSender: true,
    senderName: "Northstar Agency",
    senderDomain: "reports.agency.com",
  }),
  "Northstar Agency <reports@reports.agency.com>",
);

const invite = inviteEmail({
  workspaceName: "Northstar",
  role: "member",
  acceptUrl: "https://getcitebrief.com/invite/abc",
});
assert.match(invite.subject, /Northstar/);
assert.match(invite.html, /CiteBrief/);
assert.match(invite.html, /#0B3D2E/);
assert.match(invite.html, /Accept invite/);
assert.match(invite.html, /https:\/\/getcitebrief.com\/invite\/abc/);
assert.match(invite.text, /Northstar/);

const friday = fridayReportEmail({
  brandName: "Northstar",
  summary: "ClickUp still wins the shortlist.",
  shareUrl: "https://getcitebrief.com/r/token",
});
assert.match(friday.subject, /Friday report/);
assert.match(friday.html, /CiteBrief/);
assert.match(friday.html, /ClickUp still wins/);
assert.match(friday.html, /Open the report/);
assert.match(friday.html, /https:\/\/getcitebrief.com\/r\/token/);
assert.match(friday.text, /Northstar/);

const client = fridayReportEmail({
  brandName: "Northstar",
  agencyName: "Harbor & Co",
  body: "Named in 12 of 20 buyer questions this week.",
  shareUrl: "https://getcitebrief.com/r/token",
  clientFacing: true,
  kit: {
    preparedBy: "Harbor & Co",
    accentColor: "#123456",
    footerText: "Confidential client work",
    logoUrl: "https://cdn.example.com/harbor.png",
  },
});
assert.match(client.subject, /visibility report/);
assert.match(client.html, /Harbor &amp; Co logo/);
assert.match(client.html, /#123456/);
assert.match(client.html, /Confidential client work/);
assert.match(client.html, /Prepared by Harbor &amp; Co/);
assert.match(client.html, /Open the report/);
assert.doesNotMatch(client.html, /CiteBrief/);
assert.doesNotMatch(client.text, /CiteBrief/);
assert.match(client.text, /Prepared by Harbor & Co/);

const verify = verifyEmail({ url: "https://getcitebrief.com/verify" });
assert.match(verify.subject, /Verify/);
assert.match(verify.html, /Verify email/);
const magic = magicLinkEmail({ url: "https://getcitebrief.com/magic" });
assert.match(magic.subject, /Sign in/);
assert.match(magic.html, /Sign in/);
assert.match(magic.html, /https:\/\/getcitebrief.com\/magic/);

function runAsync() {
  return Promise.resolve()
    .then(() =>
      sendTransactionalEmail({
        to: "owner@example.com",
        subject: "x",
        html: "<p>x</p>",
        env: { NEXTJS_ENV: "production" },
      }).then(
        () => {
          throw new Error("production send should fail");
        },
        (error: unknown) => {
          assert.match(String(error), /missing in production/);
        },
      ),
    )
    .then(() =>
      sendTransactionalEmail({
        to: "owner@example.com",
        subject: "x",
        html: "<p>x</p>",
        env: { NEXTJS_ENV: "development" },
      }),
    )
    .then((stubbed) => {
      assert.equal(stubbed.stubbed, true);
    });
}

runAsync()
  .then(() => {
    console.log("email.test.ts ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
