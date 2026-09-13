import { ImageResponse } from "next/og";
import { MarkPx } from "@/components/brand/mark-px";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<MarkPx size={32} radius={7} />, { ...size });
}
