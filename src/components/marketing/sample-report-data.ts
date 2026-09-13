/** Anonymized sample used on `/` and `/report`. Not live engine output. */
export const SAMPLE_REPORT = {
  agency: "Northline Agency",
  brand: "Northstar",
  period: "Week of 8 Sep 2026",
  prepared: "Prepared by Northline Agency · 12 Sep 2026",
  named: 12,
  recommended: 7,
  total: 20,
  summary:
    "Northstar was named in 12 of 20 buyer questions this week and recommended in 7. The biggest hole is Asana alternatives for agencies, where ClickUp still wins the shortlist. Comparison and switch questions keep sending demand to incumbents. Fix the Asana comparison page first.",
  rows: [
    {
      prompt: "best project management software for agencies 2026",
      named: true,
      winner: "Northstar",
      action: "Publish a best project management for agencies page with pricing table",
    },
    {
      prompt: "Asana alternatives for agencies 2026",
      named: false,
      winner: "ClickUp",
      action: "Write a comparison page for Asana vs Northstar",
    },
    {
      prompt: "Northstar vs ClickUp for client work",
      named: true,
      winner: "Northstar",
      action: "Keep the comparison page current with retainer pricing",
    },
    {
      prompt: "Monday.com vs Northstar which is better for client retainers",
      named: false,
      winner: "Monday.com",
      action: "Publish a Monday.com vs Northstar page for agencies",
    },
    {
      prompt: "is Asana worth it for a small agency",
      named: false,
      winner: "Asana",
      action: "Write a switch guide from Asana for 12-person agencies",
    },
    {
      prompt: "ClickUp vs Asana vs Northstar",
      named: true,
      winner: "ClickUp",
      action: "Earn a mention on the roundups that keep naming ClickUp",
    },
  ],
  priorities: [
    {
      rank: "1",
      question: "Asana alternatives for agencies 2026",
      why: "High-intent shortlist. Northstar is missing and ClickUp wins.",
      action: "Write a comparison page for Asana vs Northstar",
      owner: "content",
    },
    {
      rank: "2",
      question: "ClickUp vs Asana vs Northstar",
      why: "ClickUp appears repeatedly on comparison questions.",
      action: "Earn a mention on the roundups that keep naming ClickUp",
      owner: "PR",
    },
    {
      rank: "3",
      question: "Monday.com vs Northstar which is better for client retainers",
      why: "Fixable in ten days on the site, not a new campaign.",
      action: "Fix the pricing and integrations section on the Northstar site",
      owner: "site",
    },
  ],
} as const;
