# App home `/app`

This week's runs, score change, needs-send queue.

## Layout hierarchy

```
Shell
  Page title: Home
  Primary action (top right): Run now / Send reports
  Summary row
    Brands active · Runs this week · Needs send (count)
  Needs send table (if any)
    Brand · Score · Period · [Send] [Copy link]
  This week
    Cards or table: Brand · Score X/20 · Δ vs last · Status · Next Friday
  Recent activity (optional, compact)
```

## Components

- Stat chips (mono numbers)
- Needs-send table (48px rows)
- Brand week cards (radius 12, hairline)
- Sparkline only if MoM data exists (Recharts, minimal)
- Status pills
- EmptyState when no brands

## States

| State | Behavior |
|---|---|
| Default | Summary + needs-send + this week list |
| Loading | Skeleton stats + 4 table rows |
| Empty | "Add a brand to start the first Friday report." + **Add a brand** |
| Error | "Could not load home. Retry." |
| Partial | Runs show Partial pill when 3/4 engines |
| Success | After send: row leaves needs-send; toast **Report sent** |

## Copy examples (no em dashes)

- Title: **Home**
- Stat: **Needs send · 2**
- Score: **14/20**
- Delta: **+2 vs last week**
- Row CTA: **Send** · **Copy link**
- Empty: **Add a brand to start the first Friday report.**
- Partial: **Partial · 3 engines**
