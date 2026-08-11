---
title: Durable ledger
category: current-state
updated: 2026-08-11
summary: Dated durable facts and their source anchors
nav_order: 130
sources: [".codex/harness-memory.json", "README.md", "package.json", "next.config.mjs", "docs.json", "_migration/tools/lib/shared.mjs", "components/brand/products.ts", "public/logo.svg"]
---

# Durable ledger


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
node ~/.codex/skills/harness-memory/scripts/audit-repo.mjs --repo .
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
