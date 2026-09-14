# Reports `/app/reports`

Friday send pipeline plus client reporting center (Agency+ with email send).

## Layout

```
Title · Portfolio export (Studio+)
PipelineStrip
PortfolioFilters: stage · owner · risk · brand · sent
ReportsQueue (approve / send / bulk)
Client reporting center (when module.clientReportingCenter)
  Per brand card:
    Monthly summary bullets
    Before / after named + recommended + movement label
    What improved / declined · competitor leader
    Notes & recommendations
    Completed since last report (done opportunities)
    Open report link
```

## Locked

Trial/Starter without weekly send queue → LockedModule.

## Copy

- Section: **Client reporting center**
- Empty reporting: **Monthly summaries appear after the first sent-ready report.**
