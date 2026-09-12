# Marketing sample report `/report`

Public, anonymized sample PDF viewer. Hero of the product is the PDF.

## Layout hierarchy

```
Header (marketing)
Main (full-bleed paper #FAFAF8)
  Top bar: Sample report · brand label (anonymized) · [Start the first report]
  Viewer
    Left: page thumbnails
    Right: active page (letter)
  Below fold (optional): short "What you get" three bullets
Footer
```

No glass overlay. No gauge charts. Score = big mono number.

## Components

- Report chrome (shared with in-app viewer, marketing CTAs)
- Thumbnail rail
- Page stage
- Score callout (Geist Mono)
- Primary CTA sticky on mobile

## States

| State | Behavior |
|---|---|
| Default | Page 1 cover with score; thumbs for remaining pages |
| Loading | Skeleton thumbs + paper page shimmer |
| Empty | "Sample unavailable" + link to pricing |
| Error | "Could not load sample. Try again." + retry |
| Partial | Show available pages if one image missing |
| Success | User scrolled / downloaded intent → reinforce trial CTA |

## Copy examples (no em dashes)

- Top: **Sample Friday report**
- Score: **Named in 12 of 20 buyer questions this week.**
- CTA: **Start the first report**
- Bullets:
  - Who won each answer
  - One next action per gap
  - Agency logo on the cover
