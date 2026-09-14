import assert from "node:assert/strict";
import { formatDevEmailOtpLine, formatDevMagicLinkLine, logDevEmailOtp, shouldLogDevEmailOtp } from "@/lib/auth-otp";

assert.equal(formatDevEmailOtpLine("you@agency.com", "123456"), "[citebrief] Email OTP for you@agency.com: 123456");
assert.equal(
  formatDevMagicLinkLine("you@agency.com", "https://getcitebrief.com/api/auth/magic-link/verify?token=abc"),
  "[citebrief] Magic link for you@agency.com: https://getcitebrief.com/api/auth/magic-link/verify?token=abc",
);
assert.equal(shouldLogDevEmailOtp({ NEXTJS_ENV: "development" }), true);

const lines: unknown[][] = [];
const original = console.log;
console.log = (...args: unknown[]) => {
  lines.push(args);
};
try {
  logDevEmailOtp("you@agency.com", "654321", { NEXTJS_ENV: "development" });
} finally {
  console.log = original;
}
assert.equal(lines.length, 1);
assert.equal(lines[0]?.[0], "[citebrief] Email OTP for you@agency.com: 654321");

console.log("auth-otp.test.ts ok");
