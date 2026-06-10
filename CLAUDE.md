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

---

## Docs

- [`docs/overview.md`](docs/overview.md) — what the app does, modes, layout
- [`docs/data-model.md`](docs/data-model.md) — token types, `Mapping`, stable IDs, `TokenState`, `MappingView`
- [`docs/tokenization.md`](docs/tokenization.md) — tokenizers, line stamping, whitespace strategy
- [`docs/link-mode.md`](docs/link-mode.md) — click state machine, `LinkContext`, mapping lifecycle, pinyin, keyboard scheme
- [`docs/line-mode.md`](docs/line-mode.md) — split/merge, text-keyed cache, animation
- [`docs/ui-architecture.md`](docs/ui-architecture.md) — component tree, responsibilities, GSAP patterns, context wiring
- [`docs/file-map.md`](docs/file-map.md) — every file and its responsibility
