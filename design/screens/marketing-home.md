# Marketing home `/`

Personality: paper + ink. Hero shows a real PDF page, not a fake dashboard.

## Layout hierarchy

```
Header (sticky)
  Logo | Pricing · Sample report · Sign in | [Send a Friday report]
Main
  Hero
    Left: serif H1 · one sentence · [Start the first report] [View a sample]
    Right: real PDF page preview (letter crop on paper bg)
  Logo row (optional, real logos only)
  Bento 2×2
    Named | Who won
    Next action | Friday send
  Short proof strip (one metric line or quote, optional)
  CTA band → pricing / trial
Footer
  Legal · Status · getcitebrief.com
```

Section padding: 64–96px. Panel radius 16px. Hairline borders on `#FAFAF8`.

## Components

- Marketing nav (§20.5)
- Serif H1 (Newsreader / Instrument Serif, 56–72, max ~10 words)
- Primary + secondary CTAs (accent fill / outline)
- PDF page frame (surface + line border; no glass, no glow)
- Bento cells: one artifact each (score chip, who-won line, next-action card, email mock)
- Thin footer

## States

| State | Behavior |
|---|---|
| Default | Full hero + bento; PDF preview loaded |
| Loading | Skeleton for PDF frame + bento cells; nav solid |
| Empty | N/A (static marketing) |
| Error | PDF preview fallback: static cover image + "View a sample" link |
| Partial | N/A |
| Success | N/A (conversion is signup) |

## Copy examples (no em dashes)

- H1: **The Friday PDF your client actually reads.**
- Sub: Agencies track twenty buyer questions across ChatGPT, Perplexity, Gemini, and AI Overviews. Every Friday, CiteBrief emails a white-label report.
- Primary CTA: **Start the first report**
- Secondary CTA: **View a sample**
- Nav CTA: **Send a Friday report**
- Bento Named: **Named in 12 of 20**
- Bento Who won: **ClickUp won "Asana alternatives for agencies"**
- Bento Next action: **Write a comparison page for Asana vs Northstar**
- Bento Friday: **In the inbox before standup**
