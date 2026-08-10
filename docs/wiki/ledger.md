---
title: Durable ledger
category: current-state
updated: 2026-08-10
summary: Dated durable facts and their source anchors
nav_order: 130
sources: [".codex/harness-memory.json", "README.md", "package.json", "next.config.mjs", "docs.json", "_migration/tools/lib/shared.mjs", "components/brand/products.ts", "public/logo.svg"]
---

# Durable ledger

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
