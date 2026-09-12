export function splitNames(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
