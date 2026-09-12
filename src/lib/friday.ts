export function nextFriday(from = new Date()): Date {
  const date = new Date(from);
  const day = date.getDay();
  const delta = (5 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + delta);
  date.setHours(6, 0, 0, 0);
  return date;
}

export function formatWeekOf(date = new Date()): string {
  const copy = new Date(date);
  const day = copy.getDay();
  const mondayDelta = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + mondayDelta);
  return copy.toISOString().slice(0, 10);
}

export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
