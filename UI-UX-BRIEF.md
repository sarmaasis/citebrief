# CiteBrief UI/UX Brief
**Diagnosis + fixes. No speculation, all grounded in current code.**

---

## The single problem: too many things asking for attention at once

The app has good design tokens (`design/tokens.css`) and correct Tailwind wiring. The clutter is not visual — it's structural. Too many nav items, too many stat tiles on one screen, and an Overview page that tries to be every page at once.

---

## 1. Sidebar — 9 items is too many

**Current:** Overview · Brands · Prompts · Competitors · Opportunities · Risks · Reports · Activity · Settings

**Problem:** Prompts, Competitors, and Activity are not destinations — they're tools inside a brand. A new user sees 9 equal options and doesn't know where to start.

**Fix:**

```
Overview
Brands          ← contains prompts, history, competitors per brand
Reports         ← pipeline + send queue
Settings
```

Move Prompts → `/app/brands/[id]/prompts` (already exists, just remove top-level nav link).  
Move Competitors → tab inside brand page.  
Merge Opportunities + Risks → single "Insights" page, or keep as sub-sections of Overview only.  
Delete Activity from nav (move to Settings or remove entirely — agencies don't come to CiteBrief to audit their own activity log).

**Diff:** Remove 5 `nav` entries from `src/components/app/sidebar.tsx`. Zero new code.

---

## 2. Overview page — 12 stat tiles, 3 tables, and 2 card sections

**Current structure (in order):**
1. Header + subtitle + action button
2. Saved views tabs
3. "Suggested next action" card
4. **6 stat tiles** (visibility, movement, brands, prompts, engines, competitor wins)
5. **6 more stat tiles** (at risk, opportunities, reports ready, reports sent, run success, rechecks)
6. Pipeline strip
7. "Finish first report" card
8. "This week's actions" table
9. "Client risk" table
10. "Revenue opportunities" cards
11. **5 Agency ROI stats** (brands monitored, reports generated, reports sent, opportunities, hours saved)
12. "This week" table (9 columns, all brands)

This is the entire product on one page. No user reads 12 tiles, 3 tables, and 2 card sections. Their eye lands nowhere.

**Fix — three zones, strict:**

**Zone 1: The number that matters** (top, full width)
One big mono number: `Named in X/20 questions this week` (or portfolio average). This is the product's core claim.

**Zone 2: The action** (below the number)
One card: the single most important thing to do right now. Already exists as "Suggested next action" — just make it the only thing above the fold.

**Zone 3: The table** (below the fold)
The "This week" brand table — it already has everything (brand, score, change, competitor, pipeline, next). Keep it. Remove the redundant stat rows above it; the table contains the same data in context.

**Delete entirely:**
- Second stat grid (at risk, opportunities, etc.) → available in the table rows
- Agency ROI section → belongs in Settings/Billing as "Your impact"
- Pipeline strip → redundant with Pipeline column in the table
- Saved views tabs → keep, but move below the action card, not above it

**Result:** Above the fold: 1 number + 1 action. Below the fold: 1 table. Everything else is a drill-down page.

---

## 3. Top bar — native `<select>` is the wrong component

**Current:**
```tsx
<NativeSelect value={current?.id} onChange={...}>
  {brands.map(brand => <option ...>)}
</NativeSelect>
```

A `<select>` in a dark-mode-adjacent app looks native/OS-styled and breaks the visual rhythm. It also has no visual connection to the "Run Now" button next to it.

**Fix option A (cheapest):** Style the `NativeSelect` to match the button: same height (h-9), same border-radius (`rounded-cb-control`), `appearance-none` with a custom chevron icon overlaid. One CSS change, no new components.

**Fix option B (correct):** Replace with a `<button>` that shows the current brand name + a `ChevronDown` icon, opening a Radix `<DropdownMenu>`. Already have Radix installed. ~30 lines replacing the `<NativeSelect>`.

Use option A now. Upgrade to B when you have a design handoff.

---

## 4. The "LightHome" vs full command center split

`src/app/app/(workspace)/page.tsx` has two complete homepage implementations: `LightHome` (trial/starter) and the full command center (agency+). They diverge and duplicate. 

The `LightHome` version is already cleaner — fewer stat rows, same "This week" table. The full version is the one that's cluttered.

**Fix:** Apply the Zone 1/2/3 structure above to the full command center only. LightHome is close enough to leave alone.

---

## 5. Brand page — no clear primary action

Looking at the nav structure, `/app/brands/[id]` is the most important page (it's where you run a report). But the top bar's "Run Now" button fires for whatever brand is selected in the dropdown — a global action that's easy to misfire.

**Fix:** Make "Run now" live on the brand page itself as a prominent button, not in the top bar. Remove it from the top bar. The top bar should be chrome only (brand switcher + user menu).

---

## 6. What not to change

- **Design tokens** — correct, don't touch.
- **Table component** — `DataTable` with sticky header and 48px rows is right.
- **Typography** — Geist + Newsreader, 14px body, mono scores. All correct per PRODUCT.md §20.
- **Color palette** — no purple, ink green accent, rust for missing. Correct.
- **Motion** — 180ms ease-out. Already specified in tokens, good.
- **Sidebar styling** — the individual link styles (active state, hover) are clean.

---

## Priority order

| # | Change | Files | Effort |
|---|--------|-------|--------|
| 1 | Remove 5 sidebar links | `sidebar.tsx` | 10 min |
| 2 | Delete Agency ROI section from Overview | `page.tsx` | 5 min |
| 3 | Collapse two stat grids into one (4 tiles max) | `page.tsx` | 15 min |
| 4 | Move "Run now" to brand page, remove from top bar | `top-bar.tsx`, brand page | 30 min |
| 5 | Style `NativeSelect` to match button height/radius | `globals.css` or component | 15 min |
| 6 | Delete Pipeline strip from Overview | `page.tsx` | 5 min |

Total: ~80 minutes of deletions and moves. No new components needed.

---

## The one-sentence test

After changes: a new agency owner should land on Overview, see their portfolio score and one action, and know exactly what to do next — without scrolling.
