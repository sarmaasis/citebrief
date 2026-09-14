# App overview `/app`

Executive command center after login. Answers: improving or declining, who is winning, what changed, what to do next.

## Layout hierarchy

```
Shell
  Page title: Overview
  Primary action (top right): Add a brand · Portfolio export (Studio+)
  Agency saved views (Agency+)
    All clients · Needs attention · Reports due · Recent wins · Competitor threats
    Query: ?view=
  Suggested next action (accent border card) when an action exists
  KPI strip
    AI visibility · Movement · Brands · Prompts tracked · Engines · Competitor wins
  Secondary KPIs (Agency+)
    At risk · Opportunities · Reports ready · Reports sent · Run success · Rechecks left / Failed-partial
  Pipeline strip → /app/reports?stage= (same saved view as portfolio)
  Finish first report (single brand, no report yet)
  This week’s actions table (same saved view)
  Client risk table (Agency+)
  Revenue opportunities cards (Agency+)
    Status select: open / planned / in_progress / done / dismissed
    Related prompt · engine when present
  Agency ROI (Agency+, same saved view)
  This week portfolio table (filtered by saved view)
    Brand · Owner · Risk · Named · Rec · Change · Competitor · Pipeline · Next
```

## Trial / Starter (light home)

Same Overview title. Fewer KPIs. No risk/opportunity rollups or saved views. Links to Prompt performance and Competitors still work for the one brand.

## Components

- AgencySavedViews
- Stat chips (mono numbers, optional link)
- Suggested next action card
- PipelineStrip
- DataTable (48px rows, sticky header, overflow-x)
- Brand week table with competitor leader column
- Opportunity cards + CopyRecommendation + OpportunityStatusControl
- EmptyState when no brands

## States

| State | Behavior |
|---|---|
| Default | KPIs + actions + this week |
| Loading | Shell skeletons |
| Empty | Add a brand to start the first Friday report |
| Trial / Starter | Light home; upgrade prompts on Risks / Opportunities / Reports |
| Agency+ | Full command center + saved views |
| Saved view empty | “No clients in this saved view.” |

## Copy examples (no em dashes)

- Title: **Overview**
- Next action: **Acme: Send report**
- Empty: **Start the first Friday report.**
- Competitor cell: **ClickUp · 4**
- Status control: **Open** · **Planned** · **In progress** · **Done** · **Dismissed**
