/** PRODUCT: only a verified email may open the workspace / start the trial. */
export function isVerifiedAuthUser(user: { emailVerified?: boolean | null } | null | undefined): boolean {
  return user?.emailVerified === true;
}
