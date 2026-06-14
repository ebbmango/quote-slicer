# quote-slicer

SvelteKit 5 app (Svelte runes: `$state`, `$derived`, `$props`, `$bindable`).
`export const prerender = true` — no SSR, static output.
GSAP and its plugins are lazy-loaded inside `onMount`.

---

## Dev commands

```bash
npm run dev          # start dev server
npx tsc --noEmit    # type-check
npx vitest           # unit tests (src/lib/vitest-examples/)
npx playwright test  # e2e tests
```

---

## Modes

| Mode key | User-facing name | What it does |
|----------|-----------------|--------------|
| `'text'` | Text entry | Two textareas for raw source + target input |
| `'link'` | Link mode | Click tokens in both panels to create/edit mappings |
| `'line'` | Line tool | Split or merge line breaks in source and target text |
| `'view'` | View | Read-only display (not yet built) |

Mode held in `ModeContext` (`src/lib/context/mode.svelte.ts`).

> Not to be confused with **interaction mode** (mouse vs keyboard input
> tracking) — see Domain vocabulary below.

---

## Domain vocabulary

| Term | Code |
|------|------|
| **source text / source tokens** | Chinese input; `SourceToken[]` from `tokenizeSource()` |
| **target text / target tokens** | English input; `TargetToken[]` from `tokenizeTargetSeparate()` |
| **token** | One `SourceToken` or `TargetToken` — smallest selectable unit |
| **mapping** | `Mapping` in `tokenState.ts` — links source token IDs to target token IDs, with color and pinyin |
| **active mapping** | `LinkContext.activeMappingId` — the mapping currently selected for editing |
| **split** | `splitAfterToken(tokens, afterIndex)` in `line.ts` — inserts a line break; only mutates `.line` |
| **merge** | `mergeLines(tokens, lineN)` in `line.ts` — collapses line N+1 into line N |
| **MappingView** | Derived read-only snapshot of a `Mapping` for display; never mutated by `Mapping.svelte` |
| **whitespace bridging** | Whitespace token inherits color when flanked on both sides by the same mapping — `findBridgeMappingId()` |
| **boundary whitespace** | Synthetic `{ text: ' ', type: 'whitespace' }` token appended between lines; merge affordance in line mode |
| **token ID** | `SourceToken.id` / `TargetToken.id` — stable integer, assigned once at tokenization; `Mapping` stores IDs, not indices |
| **interaction mode** | `"mouse"` \| `"keyboard"` — global `interactionMode` singleton in `src/lib/context/interactionMode.svelte.ts`; tracks last input device so hover- and focus-styles don't both apply at once |
| **mode tracking** | `initModeTracking()` — attaches global `mousemove` (→ mouse) and `Tab` keydown (→ keyboard) listeners; called once in `src/routes/+layout.svelte`. On each change, also writes `document.documentElement.dataset.interaction` so CSS can gate `:hover`/`:focus-visible` via `:global(html[data-interaction='mouse'\|'keyboard'])` — used by the line-mode split/merge zones in `InteractiveSourceText.svelte` / `InteractiveTargetText.svelte` to prevent two simultaneously "hocused" divisors. |

> Before this change, `interactionMode.current` existed as a `$state` singleton but nothing consumed it — `:hover` and `:focus-visible` divisor styles applied unconditionally, so a mouse-hovered split/merge zone and a Tab-focused one could both highlight at once. The fix wires the singleton to a `data-interaction` attribute on `<html>` (set in `initModeTracking`/`interactionMode.set`), which CSS selectors gate on — no per-component imports needed.

---

## Docs

Start at [`docs/index.md`](docs/index.md). Pages:

- [`docs/overview.md`](docs/overview.md) — what the app does, the four modes, layout
- [`docs/data-model.md`](docs/data-model.md) — token types, `Mapping`, stable IDs, `TokenState`, `MappingView`, export types
- [`docs/tokenization.md`](docs/tokenization.md) — tokenizers, line stamping, whitespace strategy
- [`docs/token-store.md`](docs/token-store.md) — single token owner: text-keyed cache, pinyin overlay, unified Flip
- [`docs/link-mode.md`](docs/link-mode.md) — `Alignment`, click state machine, mapping lifecycle, pinyin, bridging
- [`docs/line-mode.md`](docs/line-mode.md) — split/merge functions, line-tool affordances, the edit animation
- [`docs/mode-transitions.md`](docs/mode-transitions.md) — arrow launch, persistent-DOM crossfade, sidebar slide
- [`docs/keyboard-navigation.md`](docs/keyboard-navigation.md) — `tokenGridNav`, visual-neighbour math, interaction-mode sensor
- [`docs/export.md`](docs/export.md) — export data shape, JSON pretty-printer, Shiki recolor
- [`docs/ui-architecture.md`](docs/ui-architecture.md) — component tree, context wiring, responsive layout, GSAP patterns
- [`docs/build-and-deploy.md`](docs/build-and-deploy.md) — static prerender, base path, GitHub Pages, icons secret
- [`docs/file-map.md`](docs/file-map.md) — every file and its responsibility
- [`docs/implementation-notes/`](docs/implementation-notes/index.md) — running change log (parsed into the docs above; `old/` = already parsed)
