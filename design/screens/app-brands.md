# Brands `/app/brands`

Scorecards by default. Table view optional (`?view=table`). Archive toggle via `?archived=1`.
Agency saved filters via `?saved=` (needs_attention / reports_due / recent_wins / competitor_threats).

## Layout

```
Title + Add a brand + Scorecards/Table toggle
Agency saved views (Agency+, not when showing archived)
Brand cap UpgradePrompt (page-level, max-w-xl) when at cap
Active count · trial badge when unpaid · count in view
Scorecard grid (md:2 xl:3) OR DataTable
```

## Scorecard fields

Brand, site, owner, risk pill, AI visibility score, Δ, recommended, competitor gap, winning/losing prompts, open opportunities, last run, next run, health label, pipeline.

## Cap behavior

- Trial: 1 brand. Add / Duplicate opens UpgradeDialog — never expands table rows.
- At cap: page-level UpgradePrompt; Add button hidden.

## Saved views

| View | Shows |
|---|---|
| All clients | Full portfolio |
| Needs attention | Watch / at risk / failed health |
| Reports due | Needs review, approved, or send overdue |
| Recent wins | Positive named Δ |
| Competitor threats | High competitor lead share or leader + non-stable risk |
