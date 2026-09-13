import type { Metadata } from "next";
import { appMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = appMetadata;

export default function AppRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
