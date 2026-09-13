import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { UpgradePrompt, UPGRADE_COPY } from "@/components/billing/upgrade-prompt";
import { ArchiveButton } from "@/components/brands/archive-button";
import { DuplicateBrandButton } from "@/components/brands/duplicate-brand-button";
import { Button } from "@/components/ui/button";
import { upgradeHintForBrandCap, workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
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
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const brandLimit = ent.brandLimit;
  const activeCount = includeArchived ? rows.filter((brand) => !brand.archivedAt).length : rows.length;
  const atCap = activeCount >= brandLimit;
  const needsAgency = !ent.paid || ent.plan === "starter";

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Brands</h1>
          <p className="mt-1 text-sm text-cb-muted">
            Logo, site, competitors, vertical. Duplicate a live client. Archive when a retainer ends.
          </p>
        </div>
        {atCap || rows.length === 0 ? null : (
          <Button asChild>
            <Link href="/app/onboarding">Add a brand</Link>
          </Button>
        )}
      </div>

      {atCap ? (
        <div className="mb-6">
          <UpgradePrompt
            title={
              needsAgency
                ? UPGRADE_COPY.fourthBrand.title
                : ent.plan === "studio"
                  ? "You hit the Studio brand cap"
                  : UPGRADE_COPY.extraBrandAgency.title
            }
            body={upgradeHintForBrandCap(ent)}
            cta={needsAgency ? UPGRADE_COPY.fourthBrand.cta : UPGRADE_COPY.extraBrandAgency.cta}
          />
        </div>
      ) : null}

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
        <span className="ml-3 text-cb-muted">
          {activeCount}/{brandLimit} active
        </span>
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="No brands yet"
          line="Start the first Friday report."
          cta="Add a brand"
          href="/app/onboarding"
        />
      ) : (
        <div className="overflow-hidden rounded-cb-card border border-cb-line bg-cb-surface">
          <table className="w-full text-sm">
            <thead className="bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <th className="px-4 font-medium">Brand</th>
                <th className="px-4 font-medium">Site / vertical</th>
                <th className="px-4 font-medium">Client owner</th>
                <th className="px-4 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((brand) => (
                <tr key={brand.id} className="h-12 border-b border-cb-line last:border-0">
                  <td className="px-4">
                    <Link href={`/app/brands/${brand.id}`} className="flex items-center gap-3">
                      {brand.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={brand.logoUrl} alt="" className="h-6 w-6 rounded object-contain" />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-cb-accent-subtle text-xs text-cb-accent">
                          {brand.name.slice(0, 1)}
                        </span>
                      )}
                      <span className="font-medium">
                        {brand.name}
                        {brand.archivedAt ? <span className="ml-2 text-xs text-cb-muted">Archived</span> : null}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 text-cb-muted">{brand.siteUrl || brand.vertical || brand.category || "—"}</td>
                  <td className="px-4 text-cb-muted">{brand.clientOwner || brand.buyer || "—"}</td>
                  <td className="px-4">
                    <div className="flex justify-end gap-2">
                      {brand.archivedAt ? null : <DuplicateBrandButton brandId={brand.id} />}
                      <ArchiveButton brandId={brand.id} archived={Boolean(brand.archivedAt)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
