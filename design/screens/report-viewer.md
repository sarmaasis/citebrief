# Report viewer

In-app: `/app/brands/[id]/reports/[reportId]`  
Public client link: `/r/[token]` (agency-branded, no login, 90-day expiry)

## Layout hierarchy

```
Top bar
  Brand · Period · Score (mono)
  Actions: Download PDF · Copy client link · CC client · Sources
Body (#FAFAF8 full-bleed)
  Single-column page stage (letter), centered max width
Sources / Audit drawer (in-app only)
  Right sheet over the stage, closed by default
```

Public `/r/[token]`: same single-column viewer, agency logo, no app sidebar, no billing chrome, no Sources / Audit drawer.

## Components

- Action bar (Sources in-app only)
- Page stage (single column letter)
- Big mono score (not a gauge)
- CC client dialog (email field)
- Share link copy feedback toast
- Partial run notice when applicable
- Sources / Audit right sheet (StatusPill Named / Missing / Pending)

## States

| State | Behavior |
|---|---|
| Default | Cover / HTML page stage; actions enabled |
| Loading | Skeleton page stage |
| Empty | "No report for this period yet." + **Run now** |
| Error | "Report failed to load." + retry; expired token: "This client link expired." |
| Partial | Banner: **3 of 4 engines returned. Numbers reflect available engines.** |
| Success | Toast after copy/CC/download |

## Copy examples (no em dashes)

- Score: **Named in 12 of 20 buyer questions this week.**
- Actions: **Download PDF** · **Copy client link** · **CC client** · **Sources**
- Toast: **Client link copied**
- CC dialog: **Send this report to your client**
- Expired: **This client link expired. Ask your agency for a new one.**
- Empty: **No report for this period yet.**

## Sources / Audit drawer (in-app only)

Action bar includes **Sources**. Opens a right sheet (paper surface, hairline border). Closed by default.

Per prompt × engine:
- Named / Missing / Pending via StatusPill (match app)
- Timestamp
- Source URLs
- View raw
- Muted confidence + gateway request id

Public `/r/[token]` does **not** get the audit drawer. No CiteBrief auth chrome on client links.
