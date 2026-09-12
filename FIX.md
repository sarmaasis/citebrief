# CiteBrief design-fix pack (post Phase 3-5 merge)

Apply onto main. Addresses blockers that shipped in #10.

1. History MoM: remove invented `recommended = mentioned * 0.6`; chart is mentioned-only
2. `writeReport` + `run-processor`: pass brand-kit `accentColor` + `logoUrl` into HTML
3. History list: em dash → hyphen
4. Bonus: hide placeholder thumbnail rail in report viewer until real page thumbs exist

## Files
- src/app/app/(workspace)/brands/[id]/history/page.tsx
- src/components/history/mom-chart.tsx
- src/lib/report-writer.ts
- src/lib/run-processor.ts
- src/components/reports/report-viewer.tsx
