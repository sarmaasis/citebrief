import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { ArchiveButton } from "@/components/brands/archive-button";
import { Button } from "@/components/ui/button";
import { getAppContext } from "@/lib/session";
import { listWorkspaceBrands } from "@/server/workspace-data";

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    return <EmptyState line="Sign in to add a brand." cta="Sign in" href="/login" />;
  }

  const { archived } = await searchParams;
  const includeArchived = archived === "1";
  const rows = await listWorkspaceBrands(ctx, includeArchived);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Brands</h1>
          <p className="mt-1 text-sm text-cb-muted">Logo, site, competitors, vertical. Archive when a retainer ends.</p>
        </div>
        <Button asChild>
          <Link href="/app/onboarding">Add a brand</Link>
        </Button>
      </div>

      <p className="mb-4 text-sm">
        {includeArchived ? (
          <Link href="/app/brands" className="text-cb-accent">
            Hide archived
          </Link>
        ) : (
          <Link href="/app/brands?archived=1" className="text-cb-accent">
            Show archived
          </Link>
        )}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          line="Add a brand to start the first Friday report."
          cta="Add a brand"
          href="/app/onboarding"
        />
      ) : (
        <div className="overflow-hidden rounded-cb-card border border-cb-line bg-cb-surface">
          {rows.map((brand) => (
            <div
              key={brand.id}
              className="flex h-12 items-center justify-between border-b border-cb-line px-4 last:border-0"
            >
              <Link href={`/app/brands/${brand.id}`} className="flex items-center gap-3 text-sm">
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt="" className="h-6 w-6 rounded object-contain" />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-cb-accent-subtle text-xs text-cb-accent">
                    {brand.name.slice(0, 1)}
                  </span>
                )}
                <span className="font-medium">{brand.name}</span>
                <span className="text-cb-muted">{brand.siteUrl || brand.vertical || brand.category}</span>
              </Link>
              <ArchiveButton brandId={brand.id} archived={Boolean(brand.archivedAt)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
