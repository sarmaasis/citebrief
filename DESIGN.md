# CiteBrief Design Brief

Version 1.0 · aligned to PRODUCT.md §18–§20 · Domain: citebrief.xyz

Quiet instrument for agencies. Paper + ink, not neon cockpit. Show the actual PDF.

---

## 1. Personality

CiteBrief is a **paper + ink** product: Linear / Vercel / Swiss editorial, not generic AI slop.

| Do | Do not |
|---|---|
| Warm paper backgrounds | Purple-blue gradients |
| Hairline borders | Glassmorphism |
| One serif on marketing H1 only | Floating 3D dashboards |
| One sans family in the app | Glow blobs / orb backgrounds |
| Real PDF in the hero | Fake neon cockpit UI |
| Specific, plain English | "Unlock / Supercharge / Seamless" |

**Marketing** may use a dark option later; **app is light**. Clients print these reports.

**Brand name:** CiteBrief only. Canonical domain `citebrief.xyz`; stretch `citebrief.com`.

---

## 2. Color tokens (§20.3)

CSS variables live in `design/tokens.css`. No purple. No gradient mesh. Accent is agency-replaceable on PDFs and client links.

| Token | CSS var | Hex | Role |
|---|---|---|---|
| bg | `--nw-bg` | `#FAFAF8` | Warm paper page background (not `#FFF`) |
| surface | `--nw-surface` | `#FFFFFF` | Cards, panels, inputs |
| line | `--nw-line` | `#E8E6E1` | Hairline borders, dividers, table rules |
| text | `--nw-text` | `#171717` | Primary copy |
| muted | `--nw-muted` | `#737373` | Secondary copy, captions, placeholders |
| accent | `--nw-accent` | `#0B3D2E` | Ink green CTAs, focus, links |
| named | `--nw-named` | `#0B3D2E` | Status: brand was named |
| missing | `--nw-missing` | `#9A3412` | Status: not named (rust, not candy red) |
| pending | `--nw-pending` | `#B45309` | Status: running / waiting |

Derived (not in PRD table; keep tonal, no new hues):

| Token | CSS var | Value | Role |
|---|---|---|---|
| accent-hover | `--nw-accent-hover` | `#0A3428` | Pressed / hover accent |
| accent-subtle | `--nw-accent-subtle` | `#E8F0EC` | Soft accent wash for pills / selected rows |
| danger | `--nw-danger` | `#9A3412` | Alias of missing for form errors |
| shadow-menu | `--nw-shadow-menu` | `0 8px 24px rgba(0,0,0,.06)` | Floating menus only |

---

## 3. Typography (§20.2)

| Use | Face | Size | Tracking / notes |
|---|---|---|---|
| Marketing H1 | Newsreader or Instrument Serif | 56–72px | Max ~10 words |
| Marketing sub | Inter / Geist | 18–20px | Muted, one sentence |
| App UI | Inter or Geist | 14px body | `-0.2px` letter-spacing; never mix 4 fonts |
| App H2 / page title | Inter / Geist | 20–24px | Semibold |
| Numbers / score | Geist Mono or IBM Plex Mono | 12–28px | Tabular nums |
| PDF body | Inter | 11–12px | Print-safe |
| Caption / meta | Inter / Geist | 12px | Muted |

Stack: `next/font` with **Geist + Newsreader**. Mono for scores only.

---

## 4. Radius, space, motion (§20.4)

### Radius
| Element | Value | Token |
|---|---|---|
| Controls (inputs, buttons) | 8px | `--nw-radius-control` |
| Cards | 12px | `--nw-radius-card` |
| Marketing panels | 16px | `--nw-radius-panel` |

Not 24px pills everywhere.

### Space (8px grid)
| Context | Padding |
|---|---|
| Marketing sections | 64–96px vertical |
| App content | 24–32px |
| Card inner | 16–24px |
| Stack gap (tight) | 8px |
| Stack gap (default) | 16px |
| Stack gap (loose) | 24–32px |

### Motion
- Duration: **150–200ms**
- Easing: **ease-out**
- Properties: opacity + 4px translate
- No bounce, no page-wide parallax

### Elevation
- Prefer **hairline borders** (`1px solid var(--nw-line)`) over shadows
- Shadow only on floating menus: `0 8px 24px rgba(0,0,0,.06)`

---

## 5. Component inventory (§20.5)

### Marketing
- **Nav:** logo left; Pricing + Sample report + Sign in; CTA "Send a Friday report" right
- **Hero:** serif headline, one sentence, two CTAs (start trial / view sample PDF); right side = **real PDF page**, not a fake dashboard
- **Logo row:** only if logos are real
- **Bento 2×2:** Named / Who won / Next action / Friday send - each cell one artifact
- **Pricing cards:** 3 plans; Agency outlined as recommended; monthly/annual toggle
- **FAQ accordion:** 5 objections
- **Footer:** thin; legal + status

### App shell
- **Sidebar:** 240px, persistent. Logo, Home, Brands, Settings. Bottom: workspace + avatar
- **Top bar:** brand switcher, "Run now", user
- **Primary action:** top right always
- **Tables:** row height 48px, sticky header, mono scores
- **Status pills:** Named / Missing / Running / Failed - color + word, not icon-only
- **Empty states:** one line + CTA ("Add a brand", "Generate 20 prompts")
- **Toasts:** bottom, 3s, no stack of 6
- **Command palette:** later (`⌘K` jump to brand)

### Report viewer
- Full-bleed paper on `#FAFAF8`
- Left thumbnails, right page
- Top actions: Download PDF · Copy client link · CC client
- Score as a big mono number, not a gauge chart

### Onboarding (3 steps, one column)
1. Brand, URL, incumbents
2. Generated 20, editable
3. Running… then PDF

### PDF
- Letter, 0.7" margin
- Agency logo 24px height
- Cover score huge
- Prompt blocks with 1px rules, not cards
- Footer: "Prepared by {agency} · {date}"

### Shared UI stack (§20.6)
- Next.js App Router + Tailwind v4
- shadcn/ui (Button, Dialog, Dropdown, Table, Tabs, Toast, Form)
- Base UI / Radix underneath
- Lucide icons, 16–18px, 1.5 stroke
- Recharts only for MoM sparkline (no 3D)
- PDF preview: react-pdf or page images from Worker

---

## 6. Copy voice + anti-patterns (§20.8–20.9)

### Voice
Specific. No "unlock AI search".

| Context | Example |
|---|---|
| Headline | The Friday PDF your client actually reads. |
| CTA primary | Start the first report |
| CTA secondary | View a sample |
| In-app buttons | Run, Send, Copy link |
| Score line | Named in 12 of 20 buyer questions this week. |
| Empty | Add a brand to start the first Friday report. |

Verbs on buttons. Plain English a CMO can read. No GEO / AEO / LLM jargon in client-facing copy.

### Anti-patterns (ban)
- Purple-blue gradient
- Glass cards
- Floating 3D dashboard in hero
- Orb / blob backgrounds
- 5-column feature grids
- "Seamless / Supercharge / Next-gen"
- Dark app with neon charts
- Custom cursor
- Auto-playing hero video

---

## 7. Screen map (§19 + §18.1–18.2)

### Public / marketing
| Route | Spec file |
|---|---|
| `/` | `design/screens/marketing-home.md` |
| `/pricing` | `design/screens/marketing-pricing.md` |
| `/report` (sample) | `design/screens/marketing-sample-report.md` |
| `/r/[token]` | Public client report (see report-viewer + client link notes) |
| `/signup` `/login` | Covered in onboarding / app shell auth states |
| `/legal/privacy` `/legal/terms` | Thin legal pages; same tokens, no special art |

### App
| Route | Spec file |
|---|---|
| `/app` | `design/screens/app-home.md` |
| Shell (all `/app/*`) | `design/screens/app-shell.md` |
| Onboarding | `design/screens/onboarding.md` |
| Report viewer | `design/screens/report-viewer.md` |
| PDF layout | `design/screens/pdf-layout.md` |

Other app areas (brands, prompts, runs, history, settings, billing, members, brand kit) inherit shell + tokens; detailed specs can extend this pack later.

---

## 8. Quality bar (§20.10)

- Lighthouse marketing **> 90**
- Mobile landing works
- App can be **desktop-first (1280+)**
- PDF readable printed **B&W**
- Every screen has: Default · Loading (skeleton, not spinner wall) · Empty · Error · Partial (3/4 engines) · Success (§20.7)

---

## 9. How tokens map to Tailwind v4

Use CSS-first `@theme` (Tailwind v4) so utilities reference CiteBrief vars.

```css
/* app/globals.css or design/tokens.css */
@import "tailwindcss";
@import "./design/tokens.css";

@theme {
  --color-nw-bg: var(--nw-bg);
  --color-nw-surface: var(--nw-surface);
  --color-nw-line: var(--nw-line);
  --color-nw-text: var(--nw-text);
  --color-nw-muted: var(--nw-muted);
  --color-nw-accent: var(--nw-accent);
  --color-nw-named: var(--nw-named);
  --color-nw-missing: var(--nw-missing);
  --color-nw-pending: var(--nw-pending);

  --radius-nw-control: var(--nw-radius-control);
  --radius-nw-card: var(--nw-radius-card);
  --radius-nw-panel: var(--nw-radius-panel);

  --shadow-nw-menu: var(--nw-shadow-menu);

  --font-sans: var(--nw-font-sans);
  --font-serif: var(--nw-font-serif);
  --font-mono: var(--nw-font-mono);
}
```

Example utilities:

```html
<body class="bg-nw-bg text-nw-text font-sans">
  <button class="rounded-nw-control bg-nw-accent text-white">
    Start the first report
  </button>
  <div class="rounded-nw-card border border-nw-line bg-nw-surface shadow-nw-menu">
    …
  </div>
</body>
```

shadcn/ui: map `--primary` to `--nw-accent`, `--background` to `--nw-bg`, `--border` to `--nw-line`, `--muted-foreground` to `--nw-muted`. Do not introduce purple shadcn defaults.

---

## 10. Deliverable index

| Path | Purpose |
|---|---|
| `DESIGN.md` | This brief |
| `design/tokens.css` | CSS variables |
| `design/tokens.ts` | Typed export |
| `design/README.md` | Design folder index |
| `design/screens/*.md` | Per-screen specs |

Local only until Principal Designer lands via PR. Do not invent purple, gradients, or glass.
