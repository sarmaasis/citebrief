import { PLANS, PUBLIC_PLAN_IDS } from "@/lib/billing";

/** Three public checkout plans. Amounts and limits come from PLANS in billing.ts. */
export const PUBLIC_PLAN_OFFERS = PUBLIC_PLAN_IDS.map((id) => ({
  id,
  name: PLANS[id].name,
  price: PLANS[id].amountUsd,
  brands: PLANS[id].brands,
  prompts: PLANS[id].prompts,
  cadence: PLANS[id].cadence === "weekly" ? "Weekly Friday reports" : "Monthly reports",
}));
