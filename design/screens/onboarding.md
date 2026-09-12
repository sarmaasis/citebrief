# Onboarding (3 steps, one column)

Time to first PDF under 8 minutes. One column. No wizard carnival.

## Layout hierarchy

```
Minimal chrome (logo + Sign out)
Progress: 1 Brand · 2 Prompts · 3 Report
Step body (max-width ~560px, centered)
Footer actions: Back · Continue / Run
```

### Step 1 - Brand
Fields: Brand name, Site URL, Category, Buyer, Incumbent(s), Competitors, Must-have constraint (6 fields → prompt pack).

### Step 2 - Prompts
Generated 20, editable list. Lock mix 4+4+4+4+4. Reject vanity prompts inline.

### Step 3 - Running → PDF
Live engine status (4). Then open report viewer / download.

## Components

- Stepper (text, not candy)
- Form fields (8px radius)
- Prompt list editor (reorder optional later)
- Mix meter: Discovery 4 · Comparison 4 · Job 4 · Switch 4 · Incumbent 4
- Engine status list
- Success → PDF actions

## States

| State | Behavior |
|---|---|
| Default | Current step form |
| Loading | Step 2: generating prompts skeleton. Step 3: per-engine Running pills |
| Empty | Step 2 before generate: **Generate 20 prompts** |
| Error | Field errors inline; step 3 engine Failed with **Retry engine** |
| Partial | Step 3: 3/4 complete → enable **Open report** with Partial note |
| Success | **Report ready** · [Open report] [Download PDF] |

## Copy examples (no em dashes)

- Step 1 title: **Add the brand**
- Step 1 help: **Buyer questions only. No vanity "does ChatGPT mention us" prompts.**
- Step 2 title: **Confirm twenty buyer questions**
- Vanity reject: **That reads like SEO, not a buyer. Try a comparison or job question.**
- Step 3 title: **Running this week's report**
- Engine line: **Perplexity · Running**
- Success: **CiteBrief finished the first PDF.**
- CTA: **Open report**
