# quote-slicer

SvelteKit 5 app (Svelte runes: `$state`, `$derived`, `$props`, `$bindable`).
`export const prerender = true` — no SSR, static output.
GSAP and its plugins are lazy-loaded inside `onMount`.

---

## Dev commands

```bash
npm run dev          # start dev server
npx tsc --noEmit    # type-check
npx vitest           # unit tests; two projects: client (*.svelte.spec.ts, jsdom, runes) + server (plain ts, node)
npx playwright test  # e2e tests
```

---

## Tools

| Tool key | User-facing name | What it does                                                                           |
| -------- | ---------------- | -------------------------------------------------------------------------------------- |
| `'text'` | Text entry       | Two textareas for raw source + target input                                            |
| `'link'` | Link tool        | Click tokens in both panels to create/edit mappings                                    |
| `'line'` | Line tool        | Split or merge line breaks in source and target text                                   |
| `'view'` | View tool        | Read-only display; hover/tap highlights a mapping across both panels (`ViewHighlight`) |

Tool state is held in `ToolContext` (`src/lib/context/tool.svelte.ts`).

> Not to be confused with **interaction medium** (mouse vs keyboard input
> tracking) — see Domain vocabulary below.

---

## Domain vocabulary

| Term                            | Code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **source text / source tokens** | Chinese input; `SourceToken[]` from `tokenizeSource()`                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **target text / target tokens** | English input; `TargetToken[]` from `tokenizeTarget()`                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **token**                       | One `SourceToken` or `TargetToken` — smallest selectable unit                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **mapping**                     | `Mapping` in `tokenState.ts` — links source token IDs to target token IDs, with color and pinyin                                                                                                                                                                                                                                                                                                                                                                                                 |
| **active mapping**              | `Alignment.activeMappingId` — the mapping currently selected for editing                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **split**                       | `splitAfterToken(tokens, afterIndex)` in `line.ts` — inserts a line break; only mutates `.line`                                                                                                                                                                                                                                                                                                                                                                                                  |
| **merge**                       | `mergeLines(tokens, lineN)` in `line.ts` — collapses line N+1 into line N                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **MappingView**                 | Derived read-only snapshot of a `Mapping` for display; never mutated by `Mapping.svelte`                                                                                                                                                                                                                                                                                                                                                                                                         |
| **whitespace bridging**         | Whitespace token inherits color when flanked on both sides by the same mapping — `findBridgeMapping()`                                                                                                                                                                                                                                                                                                                                                                                           |
| **boundary whitespace**         | Synthetic `{ text: ' ', type: 'whitespace' }` token appended between lines; merge affordance in line tool                                                                                                                                                                                                                                                                                                                                                                                        |
| **token ID**                    | `SourceToken.id` / `TargetToken.id` — stable integer, assigned once at tokenization; `Mapping` stores IDs, not indices                                                                                                                                                                                                                                                                                                                                                                           |
| **interaction medium**            | `"mouse"` \| `"keyboard"` \| `"touch"` — global `interactionMedium` singleton in `src/lib/context/interactionMedium.svelte.ts`; tracks last input device so hover- and focus-styles don't both apply at once                                                                                                                                                                                                                                                                                                      |
| **interaction medium tracking**  | `initInteractionMediumTracking()` — attaches global `mousemove` (→ mouse), `Tab` keydown (→ keyboard), and `touchstart` (→ touch) listeners; called once in `src/routes/+layout.svelte`. On each change, also writes `document.documentElement.dataset.interactionMedium` so CSS can gate `:hover`/`:focus-visible` via `:global(html[data-interaction-medium='mouse'\|'keyboard'])` — used by the line-tool split/merge zones in `LineDivisor.svelte` to prevent two simultaneously "hocused" divisors. |

> Before this change, `interactionMedium.current` existed as a `$state` singleton but nothing consumed it — `:hover` and `:focus-visible` divisor styles applied unconditionally, so a mouse-hovered split/merge zone and a Tab-focused one could both highlight at once. The fix wires the singleton to a `data-interaction-medium` attribute on `<html>` (set in `initInteractionMediumTracking`/`interactionMedium.set`), which CSS selectors gate on — no per-component imports needed.

---

## Docs

Start at [`docs/index.md`](docs/index.md). Pages:

- [`docs/overview.md`](docs/overview.md) — what the app does, the four tools, layout
- [`docs/data-model.md`](docs/data-model.md) — token types, `Mapping`, stable IDs, `TokenState`, `buildMappingIndex`, `MappingView`, export types
- [`docs/tokenization.md`](docs/tokenization.md) — tokenizers, source punctuation grouping, line stamping, whitespace strategy
- [`docs/token-store.md`](docs/token-store.md) — single token owner: text-keyed cache, pinyin overlay, the line-edit animation
- [`docs/link-tool.md`](docs/link-tool.md) — `Alignment`, click state machine, mapping lifecycle, canonical pinyin, bridging
- [`docs/line-tool.md`](docs/line-tool.md) — split/merge functions, line-tool affordances, two-tap touch, the edit animation
- [`docs/view-tool.md`](docs/view-tool.md) — read-only layer + `ViewHighlight` hover/tap mapping highlight
- [`docs/tool-transitions.md`](docs/tool-transitions.md) — arrow launch, seamless text→token handoff, persistent-DOM crossfade, sidebar slide
- [`docs/mediums-and-keyboard-navigation.md`](docs/mediums-and-keyboard-navigation.md) — `tokenGridNav`, the `gridDom` contract, visual-neighbour math, interaction-medium sensor
- [`docs/export.md`](docs/export.md) — export data shape, JSON pretty-printer, theme-aware Shiki recolor
- [`docs/mappings-list.md`](docs/mappings-list.md) — sidebar card GSAP Flip animations, swipe-to-delete, the `$state` re-entrancy rule
- [`docs/themes.md`](docs/themes.md) — no-flash prepaint, cross-tab theme controller, per-scheme palette, synchronized transitions
- [`docs/ui-architecture.md`](docs/ui-architecture.md) — component tree, context wiring, responsive layout, GSAP patterns
- [`docs/testing.md`](docs/testing.md) — the two vitest projects (client/server), load-bearing config, filename routing, e2e regression guards
- [`docs/build-and-deploy.md`](docs/build-and-deploy.md) — static prerender, base path, GitHub Pages, icons secret
- [`docs/file-map.md`](docs/file-map.md) — every file and its responsibility
- [`docs/future-features.md`](docs/future-features.md) — designed-but-unbuilt affordances (punctuation exclusion, paired marks, per-breakpoint line breaks)
- [`docs/implementation-notes/`](docs/implementation-notes/index.md) — running change log (parsed into the docs above; `old/` = already parsed)
