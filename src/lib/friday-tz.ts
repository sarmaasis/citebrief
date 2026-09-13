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

export function localDayOfMonth(timezone: string, now = new Date()): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      day: "numeric",
    }).formatToParts(now);
    const dayRaw = parts.find((part) => part.type === "day")?.value;
    const day = Number(dayRaw);
    return Number.isFinite(day) ? day : null;
  } catch {
    return null;
  }
}

/** First Friday of the month at 06:00 local — Starter monthly cadence. */
export function isLocalFirstFridaySix(timezone: string, now = new Date()): boolean {
  if (!isLocalFridaySix(timezone, now)) return false;
  const day = localDayOfMonth(timezone, now);
  return day != null && day <= 7;
}

export function isValidIanaTimeZone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
