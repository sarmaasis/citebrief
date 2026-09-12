# CiteBrief design polish pack

Drop onto repo root / matching paths, then open a PR against main.

## Items
1. StatusPill subtle tokens: `--cb-missing-subtle`, `--cb-pending-subtle` (no raw hex)
2. CTA rename: Open report → Brand home (onboarding + run status)
3. `/report` sample route + header/home links
4. `/legal/privacy` + `/legal/terms` + footer links
5. Neutral muted: `--cb-muted-bg`; shadcn `--color-muted` maps to it (not accent-subtle)
6. Stronger letter-style `PdfPreview` for hero + sample page

## Files
- DESIGN.md
- POLISH.md (do not commit unless useful; optional)
- design/tokens.css
- design/tokens.ts
- src/app/globals.css
- src/app/page.tsx
- src/app/report/page.tsx
- src/app/legal/privacy/page.tsx
- src/app/legal/terms/page.tsx
- src/components/ui/status-pill.tsx
- src/components/onboarding/onboarding-flow.tsx
- src/components/runs/run-status.tsx
- src/components/marketing/header.tsx
- src/components/marketing/footer.tsx
- src/components/marketing/pdf-preview.tsx

## Notes
- Download PDF / Copy client link on `/report` are disabled stubs until Phase 3
- No Phase 3 engine/PDF backend
- No purple / gradients / glass / `--nw-*`
