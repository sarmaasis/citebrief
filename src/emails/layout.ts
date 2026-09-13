import { CANONICAL_ORIGIN } from "@/lib/seo";
import { escapeHtml, htmlToText, safeHttpUrl, sanitizeAccent } from "./escape";

export const CITEBRIEF_INK = "#0B3D2E";
export const CITEBRIEF_PAPER = "#FAFAF8";
export const CITEBRIEF_LINE = "#E8E6E1";
export const CITEBRIEF_TEXT = "#171717";
export const CITEBRIEF_MUTED = "#737373";

export type AgencyKit = {
  preparedBy?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
  footerText?: string | null;
};

function buttonInk(accent: string) {
  const n = Number.parseInt(accent.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65 ? CITEBRIEF_TEXT : CITEBRIEF_PAPER;
}

/** Forest-green paper-brief mark as table cells — email-safe, no SVG. */
function markHtml() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
  <tr>
    <td width="32" height="32" bgcolor="${CITEBRIEF_INK}" style="width:32px;height:32px;background:${CITEBRIEF_INK};border-radius:7px;text-align:center;vertical-align:middle">
      <span style="display:inline-block;width:16px;height:20px;background:${CITEBRIEF_PAPER};border-radius:2px;border-right:6px solid #C5D4CE"></span>
    </td>
  </tr>
</table>`;
}

function citebriefHeader() {
  return `<table role="presentation" cellpadding="0" cellspacing="0">
  <tr>
    <td style="vertical-align:middle">${markHtml()}</td>
    <td style="vertical-align:middle;padding-left:12px;font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:16px;font-weight:600;letter-spacing:-0.02em;color:${CITEBRIEF_INK}">CiteBrief</td>
  </tr>
</table>`;
}

function agencyHeader(kit: AgencyKit, accent: string) {
  const name = kit.preparedBy?.trim() || "Your agency";
  const logo = safeHttpUrl(kit.logoUrl);
  const inner = logo
    ? `<img src="${escapeHtml(logo)}" height="24" alt="${escapeHtml(name)} logo" style="display:block;border:0;height:24px;max-width:180px" />`
    : `<span style="font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:16px;font-weight:600;color:${accent}">${escapeHtml(name)}</span>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td>${inner}</td></tr></table>`;
}

function ctaTable(href: string, label: string, accent: string) {
  const ink = buttonInk(accent);
  const safeHref = escapeHtml(href);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 12px">
  <tr>
    <td bgcolor="${accent}" style="background:${accent};border-radius:8px">
      <a href="${safeHref}" style="display:inline-block;padding:12px 20px;font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:14px;font-weight:600;line-height:20px;color:${ink};text-decoration:none">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>
<p style="margin:0 0 8px;font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:12px;line-height:18px;color:${CITEBRIEF_MUTED}">If the button does not open, paste this link:<br /><a href="${safeHref}" style="color:${accent};word-break:break-all">${safeHref}</a></p>`;
}

export function renderEmailLayout(args: {
  preheader?: string;
  eyebrow?: string;
  title: string;
  bodyHtml: string;
  cta?: { href: string; label: string };
  footerNote?: string;
  /** CiteBrief chrome for ops/auth. Agency chrome for client-facing report mail. */
  brand?: "citebrief" | "agency";
  kit?: AgencyKit;
}) {
  const agency = args.brand === "agency";
  const accent = sanitizeAccent(agency ? args.kit?.accentColor : CITEBRIEF_INK);
  const preheader = args.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(args.preheader)}</div><div style="display:none;max-height:0;overflow:hidden;opacity:0">&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>`
    : "";
  const eyebrow = args.eyebrow
    ? `<p style="margin:0 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${accent}">${escapeHtml(args.eyebrow)}</p>`
    : "";
  const href = args.cta ? safeHttpUrl(args.cta.href) : null;
  const cta = href && args.cta ? ctaTable(href, args.cta.label, accent) : "";
  const prepared = args.kit?.preparedBy?.trim() || "Your agency";
  const kitFooter = args.kit?.footerText?.trim();
  const footer = agency
    ? args.footerNote || `${kitFooter ? `${kitFooter} · ` : ""}Prepared by ${prepared}`
    : args.footerNote || "CiteBrief — the Friday report agencies send to clients.";
  const header = agency ? agencyHeader(args.kit || {}, accent) : citebriefHeader();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(args.title)}</title>
</head>
<body style="margin:0;padding:0;background:${CITEBRIEF_PAPER};color:${CITEBRIEF_TEXT};font-family:Inter,ui-sans-serif,system-ui,sans-serif">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CITEBRIEF_PAPER}">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid ${CITEBRIEF_LINE};border-radius:12px">
          <tr>
            <td style="padding:28px 32px 8px">${header}</td>
          </tr>
          <tr>
            <td style="padding:16px 32px 32px;font-size:15px;line-height:1.55;color:${CITEBRIEF_TEXT}">
              ${eyebrow}
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;letter-spacing:-0.03em;color:${CITEBRIEF_TEXT}">${escapeHtml(args.title)}</h1>
              ${args.bodyHtml}
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px;border-top:1px solid ${CITEBRIEF_LINE};font-size:12px;line-height:1.5;color:${CITEBRIEF_MUTED}">
              ${escapeHtml(footer)}${agency ? "" : `<br /><a href="${CANONICAL_ORIGIN}" style="color:${CITEBRIEF_INK};text-decoration:none">getcitebrief.com</a>`}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text: htmlToText(html) };
}
