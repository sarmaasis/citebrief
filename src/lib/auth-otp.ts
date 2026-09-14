export const LOCAL_OTP_HINT =
  "We sent a 6-digit code. In local dev it is printed in the terminal running next dev.";

type OtpEnv = {
  NEXTJS_ENV?: string;
};

/**
 * `next dev` must always print the code. Do not gate on EMAIL — a dummy
 * binding still leaves the inbox empty. Production Workers never log OTPs.
 */
export function shouldLogDevEmailOtp(env?: OtpEnv | null): boolean {
  if (env?.NEXTJS_ENV === "development") return true;
  return process.env.NODE_ENV !== "production";
}

export function formatDevEmailOtpLine(email: string, otp: string): string {
  return `[citebrief] Email OTP for ${email}: ${otp}`;
}

export function formatDevMagicLinkLine(email: string, url: string): string {
  return `[citebrief] Magic link for ${email}: ${url}`;
}

/** Single `console.log` line so the next-dev terminal shows the code. */
export function logDevEmailOtp(email: string, otp: string, env?: OtpEnv | null): void {
  if (!shouldLogDevEmailOtp(env)) return;
  console.log(formatDevEmailOtpLine(email, otp));
}

export function logDevMagicLink(email: string, url: string, env?: OtpEnv | null): void {
  if (!shouldLogDevEmailOtp(env)) return;
  console.log(formatDevMagicLinkLine(email, url));
}
