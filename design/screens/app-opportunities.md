# Opportunities `/app/opportunities`

Action queue from stored Friday reports. Agency unlocks full multi-client queue with status workflow.

## Layout

```
Title + short supporting line
PortfolioFilters (full queue): opportunity type · owner · brand
Opportunity cards
  Title · brand · status pill · impact · effort · priority (Studio+)
  Suggested action · reason · suggested page · related prompt/engine · owner
  Actions: Open report · Copy · OpportunityStatusControl
```

## Status workflow

Select control posts to `/api/opportunities/planned` with `status`:

- open
- planned
- in_progress
- done
- dismissed

After save: optimistic label + `router.refresh()`.

Trial / Starter: basic list (first 3), no status control — upgrade via LockedModule when module off.

## Empty

No brands → EmptyState. Filter miss → “No opportunities in this filter.”
