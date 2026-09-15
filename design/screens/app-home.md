# App overview `/app`

Executive command center after login. Above the fold: one portfolio number and one action. Below: this week’s table.

## Layout hierarchy

```
Shell
  Page title: Overview
  Primary action (top right): Add a brand · Portfolio export (Studio+)
  Zone 1: Named in X/20 questions this week (mono, full width)
  Zone 2: Suggested next action (accent border card), or Finish first report
  Agency saved views (Agency+)
    All clients · Needs attention · Reports due · Recent wins · Competitor threats
    Query: ?view=
  Zone 3: This week portfolio table (filtered by saved view)
    Brand · Owner · Risk · Named · Rec · Change · Competitor · Pipeline · Next
```

## Trial / Starter (light home)

Same three zones: named score, one action, this week table. No saved views. Prompts and Competitors link into the brand page.

## Components

- AgencySavedViews (below the action card)
- Suggested next action card
- DataTable (48px rows, sticky header, overflow-x)
- Brand week table with competitor leader column
- EmptyState when no brands

## States

| State | Behavior |
|---|---|
| Default | Number + action + this week |
| Loading | Shell skeletons |
| Empty | Add a brand to start the first Friday report |
| Trial / Starter | Same three zones; upgrade prompts on Insights / Reports |
| Agency+ | Three-zone command center + saved views |
| Saved view empty | “No clients in this saved view.” |

## Copy examples (no em dashes)

- Title: **Overview**
- Number: **12/20** · Named in 12/20 questions this week
- Next action: **Acme: Send report**
- Empty: **Start the first Friday report.**
- Competitor cell: **ClickUp · 4**
