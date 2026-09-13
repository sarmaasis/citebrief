import { escapeHtml, plainToParagraphs } from "./escape";
import { renderEmailLayout, type AgencyKit } from "./layout";

function paragraphsHtml(blocks: string[]) {
  return blocks
    .map(
      (block, index) =>
        `<p style="margin:${index === blocks.length - 1 ? "0" : "0 0 12px"}">${escapeHtml(block)}</p>`,
    )
    .join("");
}

export function fridayReportEmail(args: {
  brandName: string;
  agencyName?: string;
  subject?: string | null;
  summary?: string | null;
  body?: string | null;
  shareUrl?: string;
  clientFacing?: boolean;
  kit?: AgencyKit;
}) {
  const kit: AgencyKit = {
    preparedBy: args.kit?.preparedBy || args.agencyName || "Your agency",
    logoUrl: args.kit?.logoUrl,
    accentColor: args.kit?.accentColor,
    footerText: args.kit?.footerText,
  };
  const agency = kit.preparedBy?.trim() || "Your agency";
  const body = args.body?.trim();
  const summary = args.summary?.trim();
  const blocks = body
    ? plainToParagraphs(body)
    : args.clientFacing
      ? [`Prepared for you by ${agency}.`, summary].filter((item): item is string => Boolean(item))
      : [`This week’s visibility report for ${args.brandName} is ready.`, summary].filter(
          (item): item is string => Boolean(item),
        );

  return {
    subject:
      args.subject?.trim() ||
      (args.clientFacing ? `${args.brandName}: this week's visibility report` : `${args.brandName}: Friday report`),
    ...renderEmailLayout({
      brand: args.clientFacing ? "agency" : "citebrief",
      kit,
      preheader: args.clientFacing
        ? `${args.brandName} visibility report from ${agency}.`
        : `${args.brandName} Friday report is ready to send.`,
      eyebrow: args.clientFacing ? undefined : "Friday report",
      title: args.clientFacing ? args.brandName : `${args.brandName} Friday report`,
      bodyHtml: paragraphsHtml(blocks.length ? blocks : [`The ${args.brandName} report is ready.`]),
      cta: args.shareUrl ? { href: args.shareUrl, label: "Open the report" } : undefined,
      footerNote: args.clientFacing
        ? `${kit.footerText?.trim() ? `${kit.footerText.trim()} · ` : ""}Prepared by ${agency}`
        : undefined,
    }),
  };
}

export function fridayQueuedEmail(args: {
  brandName: string;
  workspaceName: string;
  timezone: string;
  runId?: string;
  url?: string;
}) {
  return {
    subject: `${args.brandName} Friday report queued`,
    ...renderEmailLayout({
      preheader: `Friday 06:00 queued ${args.brandName}.`,
      eyebrow: "Friday 06:00",
      title: `${args.brandName} is in the queue`,
      bodyHtml: `<p style="margin:0 0 12px">Friday 06:00 (${escapeHtml(args.timezone)}) queued <strong>${escapeHtml(args.brandName)}</strong> for ${escapeHtml(args.workspaceName)}.</p>${
        args.runId
          ? `<p style="margin:0;font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#737373">runId=${escapeHtml(args.runId)}</p>`
          : ""
      }`,
      cta: args.url ? { href: args.url, label: "Open brand" } : undefined,
    }),
  };
}

export function reportReadyEmail(args: {
  brandName: string;
  summary?: string | null;
  named?: number | null;
  total?: number | null;
  url?: string;
}) {
  const score =
    args.named != null && args.total != null ? `Named in ${args.named} of ${args.total} buyer questions.` : "";
  const summary = args.summary?.trim();
  return {
    subject: `${args.brandName}: Friday report ready`,
    ...renderEmailLayout({
      preheader: score || `The ${args.brandName} report is ready to review.`,
      eyebrow: "Report ready",
      title: `${args.brandName} is ready`,
      bodyHtml: paragraphsHtml(
        [
          `The Friday report for ${args.brandName} is ready to review.`,
          summary,
          score,
        ].filter((item): item is string => Boolean(item)),
      ),
      cta: args.url ? { href: args.url, label: "Open report" } : undefined,
    }),
  };
}
