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

/** Most recent Friday 06:00–06:59 in `timezone`, walking back hour-by-hour. */
export function lastLocalFridaySix(timezone: string, now = new Date()): Date | null {
  const zone = timezone || "America/New_York";
  const cursor = new Date(now.getTime());
  for (let i = 0; i < 8 * 24; i += 1) {
    const local = localWeekdayAndHour(zone, cursor);
    if (local?.weekday === "Fri" && local.hour === 6) return cursor;
    cursor.setTime(cursor.getTime() - 60 * 60 * 1000);
  }
  return null;
}

/** Most recent first-Friday 06:00–06:59 (day of month ≤ 7) in `timezone`. */
export function lastLocalFirstFridaySix(timezone: string, now = new Date()): Date | null {
  const zone = timezone || "America/New_York";
  const cursor = new Date(now.getTime());
  for (let i = 0; i < 40 * 24; i += 1) {
    const local = localWeekdayAndHour(zone, cursor);
    const day = localDayOfMonth(zone, cursor);
    if (local?.weekday === "Fri" && local.hour === 6 && day != null && day <= 7) return cursor;
    cursor.setTime(cursor.getTime() - 60 * 60 * 1000);
  }
  return null;
}

/** Unsent report created before the last scheduled send window. */
export function isSendOverdue(args: {
  sentAt?: Date | string | null;
  reportCreatedAt?: Date | string | null;
  timezone: string;
  weekly: boolean;
  now?: Date;
}): boolean {
  if (args.sentAt || !args.reportCreatedAt) return false;
  const created = new Date(args.reportCreatedAt);
  if (Number.isNaN(created.getTime())) return false;
  const last = args.weekly
    ? lastLocalFridaySix(args.timezone, args.now)
    : lastLocalFirstFridaySix(args.timezone, args.now);
  return last != null && created.getTime() < last.getTime();
}

/** Next Friday 06:00 local (weekly) or next first-Friday 06:00 (monthly). */
export function nextScheduledRunAt(args: {
  timezone: string;
  weekly: boolean;
  now?: Date;
}): Date | null {
  const zone = args.timezone || "America/New_York";
  const cursor = new Date((args.now ?? new Date()).getTime());
  // Walk forward hour-by-hour up to ~6 weeks.
  for (let i = 0; i < 45 * 24; i += 1) {
    cursor.setTime(cursor.getTime() + 60 * 60 * 1000);
    if (args.weekly) {
      if (isLocalFridaySix(zone, cursor)) return cursor;
    } else if (isLocalFirstFridaySix(zone, cursor)) {
      return cursor;
    }
  }
  return null;
}
