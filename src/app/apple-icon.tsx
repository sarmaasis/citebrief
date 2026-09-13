import { ImageResponse } from "next/og";
import { MarkPx } from "@/components/brand/mark-px";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<MarkPx size={180} radius={40} />, { ...size });
}
