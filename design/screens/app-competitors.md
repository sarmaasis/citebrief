# Competitors `/app/competitors`

Competitor intelligence from stored latest-run rows. No new model calls.

## Tabs

- Leaderboard (default)
- By prompt (`?tab=prompts`)

Brand chip filter: `?brandId=`

## Sections

1. Leaderboard — competitor, client, top choice, mentions, citations, **why winning**, **movement**, prompts won, engines
2. By prompt — prompt text, competitor, client, why winning, movement, engines
3. Cited pages — URL, competitor, client (advanced intel)
4. Engine breakdown — ChatGPT / Gemini / Grok / AI Overviews
   - Mention rate, citation rate, avg visibility, reliability
   - Top competitors
   - **Top cited URLs** (linked list; empty → muted one-liner)

## Empty

No brands → EmptyState Add a brand. No wins yet → muted one-liner.
