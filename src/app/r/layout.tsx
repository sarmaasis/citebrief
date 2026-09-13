import type { Metadata } from "next";
import { clientReportRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Client report" },
  description: "Private client report link.",
  robots: clientReportRobots,
};

export default function ClientReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
