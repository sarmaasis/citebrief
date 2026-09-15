import { redirect } from "next/navigation";

export default async function OpportunitiesRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const text = Array.isArray(value) ? value[0] : value;
    if (text) next.set(key, text);
  }
  const qs = next.toString();
  redirect(qs ? `/app/insights?${qs}#opportunities` : "/app/insights#opportunities");
}
