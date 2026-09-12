# Marketing pricing `/pricing`

Three plans. Agency is the recommended outline. Feature the $199 Agency plan.

## Layout hierarchy

```
Header (same as marketing home)
Main
  Page title + one line
  Billing toggle: Monthly | Annual (10 months)
  Plan cards × 3
    Starter $149 · Agency $199 (recommended) · Studio $399
  Add-ons note: Extra brand · Extra run
  FAQ accordion (5 objections)
  CTA: Start the first report
Footer
```

Cards: radius 12px, hairline `line`, surface white on paper bg. Agency card: 2px accent outline + "Recommended" pill.

## Components

- Billing interval toggle
- PlanCard: name, price, brands/prompts/cadence, feature list, CTA
- Recommended badge (accent-subtle bg, accent text)
- FAQ accordion (shadcn)
- Thin legal footnote on taxes / Dodo

## Plan snapshot (§11)

| Plan | Price | Brands | Prompts | Cadence |
|---|---|---|---|---|
| Starter | $149/mo | 3 | 20 | Monthly |
| Agency | $199/mo | 8 | 20 | Weekly |
| Studio | $399/mo | 20 | 30 | Weekly |

Trial: 14 days, 1 brand, 1 full run.

## States

| State | Behavior |
|---|---|
| Default | Three cards; Agency outlined; monthly selected |
| Loading | Skeleton cards; toggle disabled |
| Empty | N/A |
| Error | Inline: "Pricing could not load. Refresh or email support." |
| Partial | Show cached plan table if live checkout config fails |
| Success | After CTA → `/signup` or checkout |

## Copy examples (no em dashes)

- Title: **Simple pricing for agency retainers**
- Sub: White-label Friday PDFs. Not a $29 vanity score.
- Toggle: **Monthly** / **Annual (2 months free)**
- Agency badge: **Recommended**
- Agency CTA: **Start Agency trial**
- Starter / Studio CTA: **Start trial**
- FAQ examples:
  - **Can my client read the PDF without an account?** Yes. Share a client link or CC them on the Friday email.
  - **What if one engine fails?** We soft-fail. A three-engine report still ships.
  - **Is this a GEO optimizer?** No. CiteBrief is the report layer your account team already promises.
