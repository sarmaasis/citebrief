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
  bg: "--nw-bg",
  surface: "--nw-surface",
  line: "--nw-line",
  text: "--nw-text",
  muted: "--nw-muted",
  accent: "--nw-accent",
  named: "--nw-named",
  missing: "--nw-missing",
  pending: "--nw-pending",
  accentHover: "--nw-accent-hover",
  accentSubtle: "--nw-accent-subtle",
  danger: "--nw-danger",
  onAccent: "--nw-on-accent",
  radiusControl: "--nw-radius-control",
  radiusCard: "--nw-radius-card",
  radiusPanel: "--nw-radius-panel",
  shadowMenu: "--nw-shadow-menu",
  duration: "--nw-duration",
  ease: "--nw-ease",
  fontSans: "--nw-font-sans",
  fontSerif: "--nw-font-serif",
  fontMono: "--nw-font-mono",
  sidebarWidth: "--nw-sidebar-width",
  tableRowHeight: "--nw-table-row-height",
} as const;

export type NwColor = keyof typeof colors;
export type NwStatus = "named" | "missing" | "pending" | "failed";

export const statusColor: Record<NwStatus, string> = {
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
