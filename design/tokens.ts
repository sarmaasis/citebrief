/**
 * CiteBrief design tokens (typed)
 * Mirrors design/tokens.css · PRODUCT.md §20.3–20.4
 */

export const colors = {
  bg: "#FAFAF8",
  surface: "#FFFFFF",
  line: "#E8E6E1",
  text: "#171717",
  muted: "#737373",
  accent: "#0B3D2E",
  named: "#0B3D2E",
  missing: "#9A3412",
  pending: "#B45309",
  accentHover: "#0A3428",
  accentSubtle: "#E8F0EC",
  danger: "#9A3412",
  onAccent: "#FFFFFF",
} as const;

export const radius = {
  control: 8,
  card: 12,
  panel: 16,
} as const;

export const space = {
  1: 8,
  2: 16,
  3: 24,
  4: 32,
  5: 64,
  6: 96,
} as const;

export const layout = {
  sidebarWidth: 240,
  tableRowHeight: 48,
  appContentPadding: { min: 24, max: 32 },
  marketingSectionPadding: { min: 64, max: 96 },
} as const;

export const motion = {
  durationMs: { min: 150, max: 200, default: 180 },
  ease: "ease-out",
  translateY: 4,
} as const;

export const elevation = {
  menu: "0 8px 24px rgba(0,0,0,.06)",
} as const;

export const typography = {
  marketingH1: {
    family: "Newsreader" as const,
    sizePx: { min: 56, max: 72 },
    maxWords: 10,
  },
  appBody: {
    family: "Geist" as const,
    sizePx: 14,
    tracking: "-0.2px",
  },
  score: {
    family: "Geist Mono" as const,
    sizePx: { min: 12, max: 28 },
    tabular: true,
  },
  pdfBody: {
    family: "Inter" as const,
    sizePx: { min: 11, max: 12 },
  },
} as const;

export const pdf = {
  page: "letter" as const,
  marginIn: 0.7,
  logoHeightPx: 24,
} as const;

export const cssVars = {
  bg: "--cb-bg",
  surface: "--cb-surface",
  line: "--cb-line",
  text: "--cb-text",
  muted: "--cb-muted",
  accent: "--cb-accent",
  named: "--cb-named",
  missing: "--cb-missing",
  pending: "--cb-pending",
  accentHover: "--cb-accent-hover",
  accentSubtle: "--cb-accent-subtle",
  danger: "--cb-danger",
  onAccent: "--cb-on-accent",
  radiusControl: "--cb-radius-control",
  radiusCard: "--cb-radius-card",
  radiusPanel: "--cb-radius-panel",
  shadowMenu: "--cb-shadow-menu",
  duration: "--cb-duration",
  ease: "--cb-ease",
  fontSans: "--cb-font-sans",
  fontSerif: "--cb-font-serif",
  fontMono: "--cb-font-mono",
  sidebarWidth: "--cb-sidebar-width",
  tableRowHeight: "--cb-table-row-height",
} as const;

export type CbColor = keyof typeof colors;
export type CbStatus = "named" | "missing" | "pending" | "failed";

export const statusColor: Record<CbStatus, string> = {
  named: colors.named,
  missing: colors.missing,
  pending: colors.pending,
  failed: colors.missing,
};

const tokens = {
  colors,
  radius,
  space,
  layout,
  motion,
  elevation,
  typography,
  pdf,
  cssVars,
  statusColor,
} as const;

export default tokens;
