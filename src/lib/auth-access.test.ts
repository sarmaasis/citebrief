import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isVerifiedAuthUser } from "./auth-access";

assert.equal(isVerifiedAuthUser({ emailVerified: true }), true);
assert.equal(isVerifiedAuthUser({ emailVerified: false }), false);
assert.equal(isVerifiedAuthUser({ emailVerified: null }), false);
assert.equal(isVerifiedAuthUser({}), false);
assert.equal(isVerifiedAuthUser(null), false);

const workspaceSrc = readFileSync(join(process.cwd(), "src/lib/workspace.ts"), "utf8");
assert.match(workspaceSrc, /isVerifiedAuthUser/);

const sessionSrc = readFileSync(join(process.cwd(), "src/lib/session.ts"), "utf8");
assert.match(sessionSrc, /isVerifiedAuthUser/);
assert.match(sessionSrc, /!isVerifiedAuthUser\(session\.user\)/);
assert.match(sessionSrc, /getUnverifiedSessionEmail/);

const authSrc = readFileSync(join(process.cwd(), "src/auth/index.ts"), "utf8");
assert.match(authSrc, /createAuthSecondaryStorage/);
assert.match(authSrc, /requireEmailVerification:\s*true/);
assert.match(authSrc, /emailOTP/);
assert.match(authSrc, /autoSignInAfterVerification:\s*true/);
assert.match(authSrc, /sendVerificationOnSignUp:\s*true/);
assert.match(authSrc, /overrideDefaultEmailVerification:\s*false/);
assert.match(authSrc, /logDevEmailOtp\(email,\s*otp/);
assert.match(authSrc, /sendOnSignUp:\s*false/);
assert.match(authSrc, /sendOnSignIn:\s*false/);
assert.match(authSrc, /logDevMagicLink\(email,\s*url/);
assert.match(authSrc, /googleLive/);

const authFormSrc = readFileSync(join(process.cwd(), "src/components/auth/auth-form.tsx"), "utf8");
assert.match(authFormSrc, /SHOW_GOOGLE_AUTH = false/);
assert.match(authFormSrc, /Email a magic link/);
assert.match(authFormSrc, /SHOW_GOOGLE_AUTH \?/);

console.log("auth-access.test.ts ok");
