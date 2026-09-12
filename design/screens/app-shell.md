# App shell `/app/*`

Light app. Desktop-first 1280+. Sidebar 240px persistent.

## Layout hierarchy

```
┌─────────────┬──────────────────────────────────────┐
│ Sidebar     │ Top bar                              │
│ 240px       │ Brand switcher · Run now · User      │
│ Logo        ├──────────────────────────────────────┤
│ Home        │                                      │
│ Brands      │ Main (24–32px padding)               │
│ Settings    │ Primary action always top-right      │
│             │                                      │
│ ─────────   │                                      │
│ Workspace   │                                      │
│ Avatar      │                                      │
└─────────────┴──────────────────────────────────────┘
Toasts: bottom, 3s, single stack
```

## Components

- Sidebar nav (Lucide 16–18, 1.5 stroke)
- Workspace switcher / label + avatar
- Top bar: brand switcher, **Run now**, user menu
- Tables: row height 48px, sticky header, mono scores
- Status pills: Named / Missing / Running / Failed (color + word)
- EmptyState: one line + CTA
- Toast (bottom)
- Dialog / Dropdown / Form (shadcn)
- Command palette later (`⌘K`)

## Empty states (shell-level)

| Surface | Line | CTA |
|---|---|---|
| No brands | Add a brand to start the first Friday report. | **Add a brand** |
| No prompts | Generate twenty buyer questions for this brand. | **Generate 20 prompts** |
| No runs | Run the engines for this week's report. | **Run now** |
| No members | Invite an account manager (Agency and up). | **Invite member** |
| Billing lapsed | Subscription needs attention before the next run. | **Open billing** |

## States

| State | Behavior |
|---|---|
| Default | Sidebar + top bar + content |
| Loading | Content region skeletons; chrome stays |
| Empty | EmptyState in main |
| Error | Banner under top bar + retry |
| Partial | Soft-fail badge when run is 3/4 engines |
| Success | Toast: "Report ready" / "Link copied" |

## Copy examples (no em dashes)

- Nav: **Home** · **Brands** · **Settings**
- Top action: **Run now**
- Toast: **Client link copied**
- Toast: **Report sent**
- Status pills: **Named** · **Missing** · **Running** · **Failed**
- Partial banner: **3 of 4 engines returned. PDF still ships.**
