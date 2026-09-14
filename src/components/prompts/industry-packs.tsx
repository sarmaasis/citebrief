"use client";

import { Button } from "@/components/ui/button";
import { generatePromptPack, promptSetHint, type PromptDraft } from "@/lib/prompts";

const PACKS = [
  {
    id: "saas",
    label: "Agency SaaS",
    category: "project management",
    buyer: "agencies",
    vertical: "marketing agencies",
    job: "client work and time tracking",
    incumbent: "Asana",
    competitors: ["ClickUp", "Monday.com"],
    constraint: "no 3-month setup",
  },
  {
    id: "ecom",
    label: "Ecom returns",
    category: "returns software",
    buyer: "DTC brands",
    vertical: "ecommerce",
    job: "returns and exchanges",
    incumbent: "Loop",
    competitors: ["Returnly", "Happy Returns"],
    constraint: "works with Shopify",
  },
  {
    id: "field",
    label: "Field service",
    category: "field service software",
    buyer: "home service companies",
    vertical: "HVAC",
    job: "scheduling and invoicing",
    incumbent: "Jobber",
    competitors: ["ServiceTitan", "Housecall Pro"],
    constraint: "for a 12-person crew",
  },
  {
    id: "crm",
    label: "CRM",
    category: "CRM",
    buyer: "B2B sales teams",
    vertical: "B2B SaaS",
    job: "pipeline and follow-up",
    incumbent: "HubSpot",
    competitors: ["Salesforce", "Pipedrive"],
    constraint: "with SOC2",
  },
] as const;

export function IndustryPacks({
  brandName,
  promptCap,
  onApply,
}: {
  brandName: string;
  promptCap: number;
  onApply: (prompts: PromptDraft[]) => void;
}) {
  return (
    <div>
      <p className="text-xs text-cb-muted">
        Industry packs. {promptSetHint(promptCap)} Edit names after you apply.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PACKS.map((pack) => (
          <Button
            key={pack.id}
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onApply(
                generatePromptPack(
                  {
                    brand: brandName || "the brand",
                    category: pack.category,
                    buyer: pack.buyer,
                    vertical: pack.vertical,
                    job: pack.job,
                    incumbent: pack.incumbent,
                    competitors: [...pack.competitors],
                    constraint: pack.constraint,
                  },
                  { count: promptCap },
                ),
              )
            }
          >
            {pack.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
