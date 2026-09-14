# Risks `/app/risks`

Agency portfolio risk rollups from stored reports.

## Layout

```
Title
PortfolioFilters: risk · owner · brand
DataTable
  Brand · Severity · What happened · Why it matters · Recommended fix
  First seen (when any row has firstSeenAt)
  Last seen
  Affected prompts (when populated)
  Engines (when populated)
```

Columns for first seen / prompts / engines appear only when at least one alert has data — no dead empty headers.

## Empty / locked

Trial/Starter → LockedModule. No Watch/At risk → muted one-liner.
