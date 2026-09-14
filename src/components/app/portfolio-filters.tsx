"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PIPELINE_LABEL, RISK_LABEL, type PipelineStage } from "@/lib/command-center";
import { NativeSelect } from "@/components/ui/native-select";

const STAGES: PipelineStage[] = [
  "not_configured",
  "ready_to_run",
  "running",
  "needs_review",
  "ready_to_send",
  "sent",
];

const OPPORTUNITY_TYPES = [
  { value: "geo_package", label: "GEO package" },
  { value: "comparison_page", label: "Comparison page" },
  { value: "source_refresh", label: "Source refresh" },
  { value: "pr_placement", label: "PR/source placement" },
  { value: "technical_seo", label: "Technical SEO" },
];

export type PortfolioFilterField = "stage" | "owner" | "risk" | "brandId" | "sent" | "opportunityType";

export function PortfolioFilters({
  fields,
  owners,
  brands,
}: {
  fields: PortfolioFilterField[];
  owners: string[];
  brands: { id: string; name: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(search.toString());
    if (key === "stage") next.delete("pipeline");
    if (!value) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {fields.includes("stage") ? (
        <NativeSelect
          aria-label="Pipeline"
          className="w-full min-w-0 sm:w-auto sm:min-w-40"
          value={search.get("stage") || search.get("pipeline") || ""}
          onChange={(event) => setParam("stage", event.target.value)}
        >
          <option value="">All pipeline</option>
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {PIPELINE_LABEL[stage]}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      {fields.includes("risk") ? (
        <NativeSelect
          aria-label="Risk"
          className="w-full min-w-0 sm:w-auto sm:min-w-36"
          value={search.get("risk") || ""}
          onChange={(event) => setParam("risk", event.target.value)}
        >
          <option value="">All risk</option>
          <option value="at_risk">{RISK_LABEL.at_risk}</option>
          <option value="watch">{RISK_LABEL.watch}</option>
          <option value="stable">{RISK_LABEL.stable}</option>
        </NativeSelect>
      ) : null}
      {fields.includes("owner") && owners.length > 0 ? (
        <NativeSelect
          aria-label="Owner"
          className="w-full min-w-0 sm:w-auto sm:min-w-40"
          value={search.get("owner") || ""}
          onChange={(event) => setParam("owner", event.target.value)}
        >
          <option value="">All owners</option>
          {owners.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      {fields.includes("brandId") && brands.length > 1 ? (
        <NativeSelect
          aria-label="Brand"
          className="w-full min-w-0 sm:w-auto sm:min-w-40"
          value={search.get("brandId") || search.get("brand") || ""}
          onChange={(event) => setParam("brandId", event.target.value)}
        >
          <option value="">All brands</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      {fields.includes("sent") ? (
        <NativeSelect
          aria-label="Sent"
          className="w-full min-w-0 sm:w-auto sm:min-w-36"
          value={search.get("sent") || ""}
          onChange={(event) => setParam("sent", event.target.value)}
        >
          <option value="">Sent or not</option>
          <option value="1">Sent</option>
          <option value="0">Not sent</option>
        </NativeSelect>
      ) : null}
      {fields.includes("opportunityType") ? (
        <NativeSelect
          aria-label="Opportunity type"
          className="w-full min-w-0 sm:w-auto sm:min-w-44"
          value={search.get("opportunityType") || ""}
          onChange={(event) => setParam("opportunityType", event.target.value)}
        >
          <option value="">All types</option>
          {OPPORTUNITY_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </NativeSelect>
      ) : null}
    </div>
  );
}
