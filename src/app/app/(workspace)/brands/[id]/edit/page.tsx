import { notFound } from "next/navigation";
import { BrandForm } from "@/components/brands/brand-form";
import { getAppContext } from "@/lib/session";
import { getBrandBundle } from "@/server/workspace-data";

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) {
    notFound();
  }
  const { id } = await params;
  const bundle = await getBrandBundle(ctx, id);
  if (!bundle) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">Edit {bundle.brand.name}</h1>
      <BrandForm
        brandId={bundle.brand.id}
        initial={{
          name: bundle.brand.name,
          siteUrl: bundle.brand.siteUrl ?? "",
          logoUrl: bundle.brand.logoUrl ?? "",
          category: bundle.brand.category ?? "",
          vertical: bundle.brand.vertical ?? "",
          market: bundle.brand.market ?? "US",
          buyer: bundle.brand.buyer ?? "",
          job: bundle.brand.job ?? "",
          incumbent: bundle.brand.incumbent ?? "",
          competitors: bundle.competitors.map((row) => row.name).join(", "),
          constraintNote: bundle.brand.constraintNote ?? "",
          clientOwner: bundle.brand.clientOwner ?? "",
          clientNotes: bundle.brand.clientNotes ?? "",
        }}
      />
    </div>
  );
}
