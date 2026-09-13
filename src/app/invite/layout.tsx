import type { Metadata } from "next";
import { metadataPages } from "@/lib/seo";

export const metadata: Metadata = metadataPages.invite;

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
