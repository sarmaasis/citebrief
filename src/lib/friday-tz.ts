/**
 * Tenant-timezone helpers for Friday 06:00 local enqueue.
 */

export function localWeekdayAndHour(timezone: string, now = new Date()): { weekday: string; hour: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      hourCycle: "h23",
    }).formatToParts(now);
    const weekday = parts.find((part) => part.type === "weekday")?.value;
    const hourRaw = parts.find((part) => part.type === "hour")?.value;
    if (!weekday || hourRaw == null) return null;
    const hour = Number(hourRaw);
    if (!Number.isFinite(hour)) return null;
    return { weekday, hour };
  } catch {
    return null;
  }
}

/** True when `now` is Friday 06:00-06:59 in the given IANA timezone. */
export function isLocalFridaySix(timezone: string, now = new Date()): boolean {
  const local = localWeekdayAndHour(timezone || "America/New_York", now);
  if (!local) return false;
  return local.weekday === "Fri" && local.hour === 6;
}
