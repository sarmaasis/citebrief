# App shell `/app/*`

Light app. Desktop-first 1280+. Sidebar 240px persistent. Main content `min-w-0` + `overflow-x-hidden` so tables never blow out the shell.

## Layout hierarchy

```
┌─────────────┬──────────────────────────────────────┐
│ Sidebar     │ Top bar                              │
│ 240px       │ Menu · Brand switcher · Recheck hint │
│ Logo        │ User                                 │
│ Overview    ├──────────────────────────────────────┤
│ Brands      │ Main (24–32px padding, min-w-0)      │
│ Reports     │ Primary action on the page (Run now  │
│ Insights    │ lives on the brand page)             │
│ Settings    │                                      │
│ ─────────   │ Upgrade locks open as Dialog         │
│ Workspace   │                                      │
│ Avatar      │                                      │
└─────────────┴──────────────────────────────────────┘
Toasts: bottom, 3s, single stack
```

## Components

- Sidebar nav (Lucide 16–18, 1.5 stroke): Overview · Brands · Reports · Insights · Settings
- Top bar: brand switcher, recheck credit hint (paid/trial), user menu. Chrome only.
- NativeSelect: h-9, rounded-cb-control, appearance-none + chevron
- UpgradeDialog for Extra run / brand cap (never inline inside tables)
- OpportunityStatusControl on Opportunities
- AgencySavedViews on Overview (`?view=`) and Brands (`?saved=`)
- ClientReportingCenter on Reports
- DataTable wrapper: overflow-x-auto, truncated cells
- Status pills: Named / Missing / Running / Failed
- LockedModule for Agency-gated pages on trial/Starter
- EmptyState: one line + CTA

Prompts, Competitors, and Activity stay as URLs. They are not sidebar destinations. Activity is linked from Settings.

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

- Nav: **Overview** · **Brands** · **Reports** · **Insights** · **Settings**
- Brand page action: **Run now**
- Recheck hint: **2 monthly rechecks included** / **Trial · 1 report · 1 brand**
