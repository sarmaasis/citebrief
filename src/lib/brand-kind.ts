export const BRAND_KIND = {
  client: "client",
  sample: "sample",
  pitch: "pitch",
} as const;

export type BrandKind = (typeof BRAND_KIND)[keyof typeof BRAND_KIND];

export const PITCH_TTL_MS = 48 * 60 * 60 * 1000;

export function parseBrandKind(value: string | null | undefined): BrandKind {
  if (value === "sample" || value === "pitch") return value;
  return "client";
}

export function isClientBrand(kind?: string | null) {
  return parseBrandKind(kind) === "client";
}

export function isSampleBrand(kind?: string | null) {
  return parseBrandKind(kind) === "sample";
}

export function isPitchBrand(kind?: string | null) {
  return parseBrandKind(kind) === "pitch";
}

/** Real retainers only. Sample + pitch never eat the plan slot. */
export function countsTowardBrandCap(kind?: string | null) {
  return isClientBrand(kind);
}

export function isPitchExpired(expiresAt: Date | string | number | null | undefined, now = Date.now()) {
  if (!expiresAt) return false;
  const ms = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return Number.isFinite(ms) && ms < now;
}
