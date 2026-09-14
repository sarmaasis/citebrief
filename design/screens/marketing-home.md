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

- H1: **The Friday AI-search report your client actually reads.**
- Sub: Track buyer questions across ChatGPT, Gemini, Grok, and AI Overviews. Send a white-label PDF. On Agency, the command center shows whether you are improving, who is beating you, what changed, and what to do this week.
- Primary CTA: **Send a Friday report**
- Secondary CTA: **View sample report**
- Nav CTA: **Send a Friday report**
- Trial line: **14-day trial. 1 brand. 5 buyer questions. 1 full report on ChatGPT + Gemini.**
- Bento Named: **Named in 12 of 20**
- Bento Who won: **ClickUp won "Asana alternatives for agencies"**
- Bento Next action: **Write a comparison page for Asana vs Northstar**
- Bento Friday: **In the inbox before standup**
