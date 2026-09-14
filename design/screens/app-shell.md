# App shell `/app/*`

Light app. Desktop-first 1280+. Sidebar 240px persistent. Main content `min-w-0` + `overflow-x-hidden` so tables never blow out the shell.

## Layout hierarchy

```
┌─────────────┬──────────────────────────────────────┐
│ Sidebar     │ Top bar                              │
│ 240px       │ Menu · Brand switcher · Recheck hint │
│ Logo        │ Run now · User                       │
│ Overview    ├──────────────────────────────────────┤
│ Brands      │ Main (24–32px padding, min-w-0)      │
│ Prompts     │ Primary action always top-right      │
│ Competitors │ Upgrade locks open as Dialog         │
│ Opportunities│                                     │
│ Risks       │                                      │
│ Reports     │                                      │
│ Activity    │                                      │
│ Settings    │                                      │
│ ─────────   │                                      │
│ Workspace   │                                      │
│ Avatar      │                                      │
└─────────────┴──────────────────────────────────────┘
Toasts: bottom, 3s, single stack
```

## Components

- Sidebar nav (Lucide 16–18, 1.5 stroke)
- Top bar: brand switcher, recheck credit hint (paid/trial), **Run now**, user menu
- UpgradeDialog for Extra run / brand cap (never inline inside tables)
- OpportunityStatusControl (open → dismissed) on Overview + Opportunities
- AgencySavedViews on Overview (`?view=`) and Brands (`?saved=`)
- Overview saved views filter KPIs, pipeline strip, this week’s actions, ROI, portfolio table, opportunities, and risks together
- ClientReportingCenter on Reports
- DataTable wrapper: overflow-x-auto, truncated cells
- Status pills: Named / Missing / Running / Failed
- LockedModule for Agency-gated pages on trial/Starter
- EmptyState: one line + CTA

## Empty / locked states

| Surface | Line | CTA |
|---|---|---|
| No brands | Start the first Friday report. | **Add a brand** |
| No prompts | Generate twenty buyer questions for this brand. | **Generate 20 prompts** |
| Extra run 402 | This run is outside the included cap. | **See usage** (Dialog) |
| Brand cap 402 | Need a third client brand? | **Upgrade to Agency** (Dialog) |
| Risks / Opportunities / Reports on trial | Module locked; lighter Home only. | **Upgrade to Agency** |

## States

| State | Behavior |
|---|---|
| Default | Sidebar + top bar + content |
| Loading | Content region skeletons; chrome stays |
| Empty | EmptyState in main |
| Error | Banner under top bar + retry |
| Cap lock | Dialog — layout does not reflow |

## Copy examples (no em dashes)

- Nav: **Overview** · **Brands** · **Prompts** · **Competitors** · **Opportunities** · **Risks** · **Reports** · **Activity** · **Settings**
- Top action: **Run now**
- Recheck hint: **2 monthly rechecks included** / **Trial · 1 report · 1 brand**
