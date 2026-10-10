---
title: Durable ledger
category: current-state
updated: 2026-10-10
summary: Dated durable facts and their source anchors
nav_order: 130
sources: [".codex/harness-memory.json", "README.md", "package.json", "next.config.mjs", "docs.json", "app/layout.tsx", "_migration/tools/lib/shared.mjs", "components/brand/products.ts", "public/logo.svg", "pipeline/docs-agent.mjs", "pipeline/docs-agent.yml", "pipeline/test/regression.test.mjs", "menuwright/index.mdx", "menuwright/menu-matrix.mdx", "menuwright/csv-import.mdx", "menuwright/getting-started.mdx", "menuwright/reports.mdx", "menuwright/faq.mdx", "menuwright/billing.mdx", "menuwright/square.mdx", "menuwright/insights-trends.mdx", "menuwright/account-branding.mdx"]
---

# Durable ledger

## 2026-10-10 — MenuWright report and Square sync boundaries

The standalone reports, billing, FAQ, Square, getting-started, and CSV
guides were aligned to pinned product source at [MenuMakeover
`669272490209f0b81a85f0596f97de443e354b83`](https://github.com/smynkr/MenuMakeover/tree/669272490209f0b81a85f0596f97de443e354b83).
These are documentation corrections only; they do not prove that a scheduler,
worker, report delivery, or production Square approval is active.

- Report payloads limit plans not explicitly paid to one recommendation when
  any are available; pending items are preferred before other statuses, then
  estimated-impact availability and amount, priority, and recency. Paid plans
  pass the full recommendation list to the templates, but the weekly digest
  displays at most three while the monthly PDF renders the full supplied list.
  Provider acceptance is not inbox delivery. [report task](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/tasks/reports.py) · [weekly template](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/templates/weekly_digest.html) · [PDF template](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/templates/report.html)
- Celery Beat source config schedules daily Square sync and hourly report
  dispatchers; report tasks check each restaurant's local 8 AM window. This
  is configured backend behavior, not evidence of an active scheduler or
  worker. [schedule](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/celery_app.py) · [report tasks](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/tasks/reports.py)
- The Square sync task writes `POSSyncLog` entries; CSV sales and cost imports
  return import results but do not create sync-log records.
  [Square sync](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/tasks/sync.py) · [sales importer](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/api/sales.py) · [cost importer](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/api/menu_items.py)

Separately, the docs shell requests Inter as a variable font through Next's Google-font loader (`app/layout.tsx`); this is a site-build configuration change, not a MenuWright behavior change.

## 2026-10-09 — MenuWright standalone guide alignment

The standalone MenuWright guides and canonical matrix methodology were
aligned to pinned product source at [MenuMakeover
`669272490209f0b81a85f0596f97de443e354b83`](https://github.com/smynkr/MenuMakeover/tree/669272490209f0b81a85f0596f97de443e354b83).
The landing page adds discovery for the existing Menu Scan guide, and its
screenshot alt text accurately describes the supplied image. The matrix,
cost-entry, import-history, billing, and report guides distinguish true
contribution margins from provisional/proxy signals, file imports from POS
sync history, and scheduled report tasks from observed email delivery.
These are editorial corrections only; they do not change product behavior
or establish a Square production launch. The Square integration remains
described as sandbox-only pending production app review.

- When a sales record has positive quantity and revenue, the engine derives
  effective unit price from gross revenue divided by quantity; otherwise it
  uses menu price. Partial-cost items without food costs receive provisional
  revenue-share classifications. In no-cost mode, revenue share is the
  profitability proxy and the cutoff is the quantity-weighted average of those
  shares, not a contribution-margin threshold
  ([analysis engine](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/services/analysis.py#L52-L100),
  [classification paths](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/services/analysis.py#L132-L353)).
- Dashboard quadrant names are product-facing aliases; they do not rename the
  analysis engine's underlying labels
  ([dashboard labels](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/frontend/src/components/menu-matrix.tsx#L31-L49)).
- File imports and POS sync are separate paths: `import_sales_csv` writes sales records with source `csv_import` and returns import counts/unmatched names, while `upload_costs` updates matched menu items and returns matched/unmatched counts. Neither path writes a `POSSyncLog` row. [Sales importer](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/api/sales.py) · [cost importer](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/api/menu_items.py).
- In no-cost mode, `run_analysis` returns no true average or per-item contribution margin. The report task treats missing item margins as zero in its quantity-weighted aggregate and divides by all item quantities; the templates render absent averages and PDF item margins/food costs as `$0.00`. Partial-cost reports also count uncoded item margins as zero. These are fallback/display values, not measured zero margins or costs. [analysis](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/services/analysis.py) · [report task](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/tasks/reports.py) · [weekly template](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/templates/weekly_digest.html) · [PDF template](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/templates/report.html).
- Hourly beat tasks check each restaurant's local 8 AM window (the monthly task also requires the first day), completed analysis, and an active owner email. `send_report_email` treats Resend HTTP 200 as provider acceptance, not inbox delivery. [schedule](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/celery_app.py) · [report tasks](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/tasks/reports.py) · [email service](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/services/email.py). The code establishes a scheduled path, not observed report delivery.
- The report payload caps a non-paid plan at one recommendation preview when available; paid plans retain the full set. The weekly template displays up to three supplied recommendations, while the PDF renders the supplied list. The PDF generator fails rather than sending HTML as a `.pdf` if WeasyPrint cannot load. [report task](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/tasks/reports.py) · [weekly template](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/templates/weekly_digest.html) · [PDF template](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/templates/report.html) · [PDF service](https://github.com/smynkr/MenuMakeover/blob/669272490209f0b81a85f0596f97de443e354b83/backend/app/services/reports.py).

These are source-alignment, cost-coverage, import-history, and report-delivery
corrections, not a product release; the product changelog remains unchanged.
[[current-state]] remains the repository topology summary.

## 2026-08-28 — Docs-agent Cloudflare controls shipped

- `menuwright-docs` PR #27 added optional `DOCS_AGENT_GLM_REASONING_EFFORT` and
  `DOCS_AGENT_GLM_GATEWAY_ID` support to the generic HTTP backend.
- Gateway routing adds `cf-aig-gateway-id` and disables prompt/response payload
  retention while preserving metadata. Invalid reasoning-effort values fail
  closed; unset options preserve the previous payload byte-for-byte.
- The reusable workflow template maps both optional repository variables.
- Verification: 35 Node pipeline tests pass; canonical-memory and Vercel gates
  were green at merge. Crossreview reached its three-round cap with all
  verified P2/P3 findings fixed.

Re-establish with:

```bash
node --test pipeline/test/regression.test.mjs
npm run memory:check
```

## 2026-08-11 — Harness-memory conformance (audit FAIL → PASS)

- Added `docs/wiki/_schema.md` (schema + routing + capture contract; group_id
  boundary, content-boundary section, memory gates, Hindsight/Mem Palace
  fully-archived marker). The wiki previously had only index/current-state/
  ledger and failed the harness-memory audit on the missing schema and the
  missing archived-memory marker.
- AGENTS.md: added the Hindsight and Mem Palace fully-archived marker to
  Memory routing.
- Regenerated `docs/AGENT_SOT.md` + `docs/wiki/_sources.json`
  (`npm run memory:generate`); `npm run memory:check` passes and
  `audit-repo.mjs` reports PASS.

Re-establish with:

```bash
npm run memory:check
```


## 2026-08-11 — Review-lane fixes: fail-closed memory gate, T9, generated meta

- pipeline/docs-agent.mjs: a failed `memory:generate` after canonical edits
  now aborts the draft (previously logged and shipped a PR whose memory gate
  would reject it). T9 rewritten to assert the fail-closed contract (no PR,
  non-zero exit, diagnostic); T9b unchanged. 33 pipeline tests pass.
- content/docs regenerated: meta.json title is now MenuWright (llms.txt and
  search breadcrumbs were still "Axiomancer Labs").
- FocusDeadEndHeading span -> div (valid HTML); cyan comments -> purple.

Re-establish with:

```bash
npm run memory:check
npm run test:pipeline
```


## 2026-08-11 — docs.json asset-path fix

- `favicon` and `logo` in docs.json pointed at `/images/favicon.svg` and
  `/images/logo-{light,dark}.svg`, which do not exist in `public/` (the nav
  renders `/logo.svg` via NavTitle, so nothing was visibly broken).
  Corrected to the real paths (`/favicon.svg`, `/logo.svg`), matching the
  TileTactician reference.

Re-establish with:

```bash
npm run memory:check
npm run test:links
npm run links:check
npm run types:check
npm run build
```


## 2026-08-11 — Dark-first MenuWright brand theme pass

- fd theme tokens replaced the template cyan with the MenuWright purple
  family: dark `#5D3EFB` on the `#0A0A0A` void, light `#3B1FD8` on paper
  (AA-accessible), ring/accent/glow aligned, `.ax-glow` and constellation
  recolored to purple, dead Axiom CSS utilities removed.
- Dark is now the presentation default (`RootProvider theme={{ defaultTheme: 'dark' }}`).
- docs.json identity: name MenuWright, brand colors, logo href to
  menuwright.com.
- OG card and 404 rebranded to the utensil mark and the menu voice; per-page
  siteName fixed to MenuWright Docs.
- Verified: gates green, dark default + toggle, OG render; deployed via PR #5.

Re-establish with:

```bash
npm run test:links
npm run links:check
npm run types:check
npm run build
npm run memory:check
```

## 2026-08-10 — Standalone MenuWright docs site established

- Scoped from the axiom-docs Fumadocs stack as a single-product site:
  canonical flat MDX under `menuwright/`, generated `content/docs/`, contract
  tests, related-guide wayfinding, and the docs-agent pipeline. All Axiom
  product content, hub components, changelog, Notion mirror, and weekly-recap
  machinery were removed.
- Brand: MenuWright accent `#5D3EFB` (from the live landing capture), custom
  crossed-utensils mark (`public/logo.svg`), favicon tile
  (`public/favicon.svg`); no Axiom identity anywhere in the chrome.
- Clean URLs: `/` and `/getting-started` … `/faq` rewrite onto the
  `menuwright/*` canonical routes (`next.config.mjs`).
- DNS `docs.menuwright.com` already pointed at Vercel anycast
  (76.76.21.21); domain attached to the Vercel project during launch.
- Automation: `pipeline/docs-agent.yml` template adapted for
  `smynkr/menuwright-docs`; the `MenuMakeover` repo receives the workflow
  with `DOCS_AGENT_PRODUCT: menuwright`.

Re-establish with:

```bash
node _migration/tools/run-migration.mjs
npm run test:links
npm run links:check
npm run types:check
npm run build
npm run memory:check
```

## Related

- [[current-state]] — current repository-owned topology
