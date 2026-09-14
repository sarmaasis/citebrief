import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUnverifiedSessionEmail } from "@/lib/session";
import { appMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = appMetadata;

export default async function AppRootLayout({ children }: { children: React.ReactNode }) {
  const unverifiedEmail = await getUnverifiedSessionEmail();
  if (unverifiedEmail) {
    redirect(`/verify?email=${encodeURIComponent(unverifiedEmail)}`);
  }
  return children;
}
