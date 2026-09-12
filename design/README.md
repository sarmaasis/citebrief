# CiteBrief design

Local design deliverable pack for CiteBrief (PRODUCT.md §18–§20). Paper + ink. Linear / Vercel / Swiss editorial.

## Files

| Path | What |
|---|---|
| [`../DESIGN.md`](../DESIGN.md) | Full design brief: personality, tokens, type, components, copy, screen map, quality bar, Tailwind v4 mapping |
| [`tokens.css`](./tokens.css) | CSS custom properties (`--cb-*`) |
| [`tokens.ts`](./tokens.ts) | Typed token export for app code |
| [`screens/`](./screens/) | Per-screen layout, components, states, copy |

## Screen specs

| File | Route / surface |
|---|---|
| `screens/marketing-home.md` | `/` |
| `screens/marketing-pricing.md` | `/pricing` |
| `screens/marketing-sample-report.md` | `/report` |
| `screens/app-shell.md` | `/app/*` chrome + empty states |
| `screens/app-home.md` | `/app` |
| `screens/onboarding.md` | First-run 3 steps |
| `screens/report-viewer.md` | In-app + public client report |
| `screens/pdf-layout.md` | Letter PDF artifact |

## Hard constraints

- Brand: **CiteBrief** only
- Colors: bg `#FAFAF8`, accent `#0B3D2E`, etc. from §20.3
- **No** purple, gradients, or glass
- **No** em dashes in copy
- States on every screen: Default / Loading / Empty / Error / Partial / Success

## Tailwind v4

Import `tokens.css`, then map into `@theme` as documented in `DESIGN.md` §9. Point shadcn `--primary` at `--cb-accent`.

## Ownership

Drafted for Principal Designer to land via PR. This folder is local until then.
