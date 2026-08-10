# Design

## Source of truth

- **Status:** Active
- **Last refreshed:** 2026-08-08
- **Primary product surfaces:** Cross-product documentation hub (`/getting-started`), product landing pages, technical documentation pages, changelog.
- **Evidence reviewed:** `app/global.css`, `app/layout.tsx`, `components/home/product-grid.tsx`, `components/brand/hub-hero.tsx`, `components/docs-content-page.tsx`, `components/docs-search-dialog.tsx`, `components/page-feedback.tsx`, `getting-started.mdx`, `_mockups/shared.css`, `docs/wiki/current-state.md`, `docs/wiki/architecture.md`, and local browser checks of `/getting-started` and `/routeshift/api/overview` at desktop and 390px widths.
- **Decision record:** The approved balanced premium polish scope is documented in `docs/superpowers/specs/2026-08-08-balanced-premium-polish-design.md`.

## Brand

- **Personality:** Precise, calm, instrument-like, technically credible, quietly premium.
- **Trust signals:** Truthful product-specific routes, clear product identity, evidence-backed product previews, changelog visibility, copyable markdown/code, explicit external-link semantics, and restrained motion.
- **Avoid:** Generic SaaS gradients, noisy dashboard decoration, excessive glow, marketing language that outpaces the documentation, tiny action targets, and competing navigation trees.

## Product goals

- **Goals:** Help a reader choose the right product quickly; make first actions obvious; support deep technical work with reliable search, copy, navigation, and feedback; make the docs feel like a maintained product.
- **Non-goals:** Replace Fumadocs; create a separate marketing homepage; rewrite product content; add a second design system; change routes, analytics, or generated-content boundaries.
- **Success signals:** Faster product/guide selection [inferred]; clearer primary CTA recognition [inferred]; comfortable mobile and keyboard interaction [confirmed requirement]; no regression in technical-page reading flow [confirmed requirement].

## Personas and jobs

- **Primary personas:** Developers integrating APIs; operators and researchers evaluating product surfaces; returning readers checking what changed.
- **User jobs:** Find the correct product guide, make a first request or configuration change, inspect API examples and evidence, copy content into an assistant, and understand recent releases.
- **Key contexts of use:** Desktop technical work, narrow mobile reference checks, keyboard-first search/navigation, and AI-assisted documentation workflows.

## Information architecture

- **Primary navigation:** Fumadocs product/sidebar navigation plus the compact Axiom product bar; the product bar is a utility and does not replace docs navigation.
- **Core routes/screens:** `/getting-started`, six product roots and their nested docs, `/changelog`, `/llms.txt`, per-page markdown routes, and search.
- **Content hierarchy:** Hub hero/orientation → product selection → metrics → latest changelog → platform tools → questions; technical page title/actions → body → feedback → adjacent-page navigation.

## Design principles

1. **Signal before spectacle:** Use one clear action and one clear hierarchy before adding visual effects.
2. **Instrument, do not decorate:** Surfaces should help readers measure, decide, and act; every visual treatment needs a wayfinding or trust purpose.
3. **Product identity, shared system:** Product accents differentiate products while shared tokens keep the platform coherent.
4. **Parity across input modes:** Pointer, keyboard, touch, reduced-motion, and screen-reader users receive equivalent information and affordances.
5. **Preserve technical flow:** The hub may feel premium, but technical pages prioritize scanability, code access, and route stability.

## Visual language

- **Color:** Dark void by default; paper-like light theme; cyan signal for shared interactions; product accents for product identity; neutral borders for structure.
- **Typography:** Inter for body/UI and JetBrains Mono for code/data; Playfair Display only for display/title moments.
- **Spacing/layout rhythm:** Deliberate section rhythm, readable content width, compact but comfortable controls, and cards with clear primary/secondary hierarchy.
- **Shape/radius/elevation:** Restrained rounded surfaces, hairline borders, one accent edge, and shallow layered elevation; avoid black shadows that disappear into the void.
- **Motion:** Ambient constellation and reveal motion are optional decoration; interactions are short, purposeful, and disabled/minimized under reduced motion.
- **Imagery/iconography:** Evidence-backed product screenshots, Lucide/product identity marks, and accent dots used as semantic identity cues rather than ornament.

## Components

- **Existing components to reuse:** `ProductGrid`, `HubHero`, `ProductPreview`, `ProcessFlow`, `AxiomBar`, `DocsContentPage`, Fumadocs page actions, `DocsSearchDialog`, `PageFeedback`, and existing `fd-*` theme variables.
- **New/changed components:** Refine `ProductGrid` card semantics and action states; refine `HubHero` hierarchy; optionally align `DocsContentPage` action grouping; extend shared CSS motion/accessibility rules.
- **Variants and states:** Rest, hover, focus-visible, touch, reduced-motion, empty/error behavior inherited from existing components.
- **Token/component ownership:** Shared visual rules belong in `app/global.css`; product identity remains canonical in `components/brand/products.ts`; content and routes remain in canonical flat MDX and `docs.json`.

## Accessibility

- **Target standard:** WCAG 2.2 AA intent for contrast, keyboard access, semantics, and target sizing.
- **Keyboard/focus behavior:** Visible `focus-visible` rings; focus-within card parity; no hover-only actions; preserve search/sidebar/page-action keyboard flows.
- **Contrast/readability:** Cyan and product accents must not be the only state signal; muted copy remains readable against both themes; code and tables retain scanability.
- **Screen-reader semantics:** Use semantic articles/labels where they improve card navigation; preserve descriptive external-link labels and live feedback announcements.
- **Reduced motion and sensory considerations:** Disable/minimize decorative animation and utility-class transforms when `prefers-reduced-motion: reduce` is active.

## Responsive behavior

- **Supported breakpoints/devices:** Desktop documentation layouts and narrow mobile widths including 390px; existing Fumadocs mobile drawer behavior remains authoritative.
- **Layout adaptations:** Product cards stack on narrow screens; hero legend wraps; compact links use comfortable touch targets; action controls remain grouped without overflow.
- **Touch/hover differences:** Touch must not require hover to reveal meaning; hover/focus can add restrained motion where supported.

## Interaction states

- **Loading:** Preserve existing Fumadocs/search loading behavior and prevent false no-results flashes.
- **Empty:** Preserve search product-guide fallback and empty changelog behavior.
- **Error:** Preserve fail-closed route/link and generated-content checks; do not hide broken destinations.
- **Success:** Primary actions visibly respond; page feedback announces confirmation and preserves focus.
- **Disabled:** Avoid disabled-looking links for unavailable documentation; use explicit availability copy where already present, such as Invest private preview.
- **Offline/slow network:** Server-rendered docs and static content remain readable; search may show its existing searching state.

## Content voice

- **Tone:** Direct, evidence-first, calm, and operationally credible.
- **Terminology:** Use product names exactly as defined by the canonical product identity source; distinguish documentation links from product-site links.
- **Microcopy rules:** One clear action label per card; secondary links use concise nouns; avoid empty superlatives and claims unsupported by product documentation.

## Implementation constraints

- **Framework/styling system:** Next.js App Router, React, Fumadocs, Tailwind utilities, and `app/global.css`.
- **Design-token constraints:** Reuse `fd-*` variables and current product accent values; do not add a parallel token system.
- **Performance constraints:** Keep decorative canvas bounded and pause behavior intact; avoid new client-side state or heavyweight dependencies for presentational polish.
- **Compatibility constraints:** Canonical flat MDX sources remain authoritative; `content/docs/` is generated; `docs.json` remains navigation source of truth.
- **Test/screenshot expectations:** Run migration, links, types, and production build; inspect desktop/mobile browser states and reduced motion before completion.

## Open questions

None for the approved balanced premium polish scope.
