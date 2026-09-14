# PDF layout

The weekly artifact. Letter. Print-safe B&W. Agency kit replaces accent on cover/footer.

## Page geometry

- Size: US Letter
- Margin: **0.7"**
- Logo height: **24px**
- Body: Inter 11–12px
- Rules: 1px (`line` / black at low opacity for print)
- No cards, no gradients, no purple

## Hierarchy

### Cover
```
Agency logo (24px)
Client / Brand
Period (week of …)
Score: huge mono "12/20" or "Named in 12 of 20"
One paragraph (max 80 words) for the CMO
Prepared by {agency} · {date}
```

### Prompt pages
For each of 20 prompts (stacked with 1px rules, not cards):
```
Prompt text
Named? Y/N per source (ChatGPT · Gemini · Grok · AI Overviews)
Cited URL (if any)
Who won
20-word sentence
One next action (from allowed vocabulary)
```

### Close
```
Three priorities
  Buyer question we lose
  Why it matters
  Action
  Owner suggestion: content / site / PR
Footer on every page: Prepared by {agency} · {date}
```

## Components (print)

- Cover score block
- Engine mention row
- Prompt block + hairline rule
- Priority list (numbered)
- Footer running

## States (generation)

| State | Behavior |
|---|---|
| Default | Full 4-engine data |
| Loading | N/A in file; UI shows generating |
| Empty | N/A |
| Error | Do not ship empty PDF; surface error in app |
| Partial | Omit failed engine column or mark "-"; still ship if ≥3 engines |
| Success | Stored on R2 `reports/{workspace}/{brand}/{yyyy-mm-dd}.pdf` |

## Copy examples (no em dashes)

- Score line: **Named in 12 of 20 buyer questions this week.**
- Sentence: **Northstar appears in two answers; ClickUp leads agency shortlists.**
- Next action: **Write a comparison page for Asana vs Northstar**
- Priority: **Fix the pricing section on northstar.example/pricing**
- Footer: **Prepared by Northline Agency · 12 Sep 2026**
- Jargon ban on PDF: no GEO, AEO, LLM, prompt, engine, citation graph in client prose (engine labels in the table are OK as product UI)
