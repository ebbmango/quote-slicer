# Testing

Unit tests run under vitest in **two projects**, configured in `vite.config.ts`:

| Project    | Environment | Runs                                            | For                                        |
| ---------- | ----------- | ----------------------------------------------- | ------------------------------------------ |
| **client** | jsdom       | `src/**/*.svelte.{test,spec}.ts`                | rune-based classes (`*.svelte.ts` modules) |
| **server** | node        | every other `src/**/*.{test,spec}.ts`           | framework-free logic                       |

End-to-end coverage is Playwright (`npx playwright test`, specs in
`src/routes/*.e2e.ts`).

## Why two projects

Everything interesting in the app's state layer — the mapping lifecycle, the click
state machine, the view-tool highlight — lives in `*.svelte.ts` classes built on
`$state`/`$derived`. Under the **server-compiled** Svelte runtime, `$derived` is
compute-once: a test that mutates state and re-reads a derived value sees a stale
snapshot. Those modules need the **client** runtime, which needs a browser-ish
environment — hence a second project. Pure logic (tokenizers, line math, formatters)
stays in the plain node project, which is faster and needs no DOM.

## The two load-bearing config lines

Both live in the client project's block in `vite.config.ts`, and both are required:

- **`resolve: { conditions: ['browser'] }`** — this, **not jsdom**, is what selects
  the client Svelte runtime with live `$derived` recomputation. jsdom alone would
  still load the server runtime and silently reproduce the stale-value problem.
- **`environment: 'jsdom'` + `setupFiles: ['./vitest-setup-client.ts']`** — the setup
  file stubs `window.matchMedia`, which jsdom does not implement. The theme controller
  (`src/lib/theme/systemTheme.ts`) queries it at module init, so the stub must exist
  before any test file's import graph pulls in the theme module.

## Routing is by filename convention — and only by filename

`*.svelte.{test,spec}.ts` runs in the client project; plain `*.spec.ts` runs in node.
There is no other router.

> **The trap:** a runes module accidentally tested from a plain `.spec.ts` file loads
> the server runtime and gets compute-once `$derived` — tests may pass against stale
> values or fail mysteriously, with no error pointing at the real cause. If a
> rune-dependent test behaves nonsensically, check which project it ran in first.

## What runs where

The spec-by-spec table lives in the [File Map](file-map.md#tests). The shape of it:

- **Client project** — `alignment.svelte.spec.ts` (mapping lifecycle, toggle
  semantics, the token-ID-keyed pinyin commit, export, highlight wiring) and
  `viewHighlight.svelte.spec.ts` (the cold/warm/grace timers, with fake timers).
  Both use a mock token store rather than the real context wiring.
- **Server project** — everything else, including two files that look like they might
  need a browser but don't: `tokenStore.spec.ts` exercises the text-keyed cache and
  pinyin overlay under node because `onMount` is a no-op there, and `line.spec.ts`
  covers split/merge immutability plus the out-of-range throw (documented as a
  precondition comment on `splitAfterToken`).

Specs are **colocated** beside their sources (`tokenize.spec.ts` next to
`tokenize.ts`, etc.); there is no separate test tree.

## E2E notes

Playwright specs live in `src/routes/*.e2e.ts`. Three are regression guards for
specific engineering episodes: `line-split-overflow.e2e.ts` (the
[constrained/overflow line-edit regime](adr/0001-line-edit-dual-scroll-regime.md)),
`rapid-click.e2e.ts` (the [mappings-list re-entrancy
freeze](mappings-list.md#the-re-entrancy-freeze-bug-and-the-rule-it-established)),
and `theme-lockstep.e2e.ts` (the [theme-flip synchronization
invariants](themes.md#synchronized-transitions): no resting colour transition on
the text fields, opacity included in the card bottom-bar transition, live
`color-scheme` landing on `<body>` and never on the root).

> One measured caveat from the placeholder work: Playwright's bundled Chromium does
> **not** reproduce the dark-OS `::placeholder` staleness bug — only the real Chrome
> binary (`launch({ channel: 'chrome' })` with `colorScheme: 'dark'` emulation) does.
> Any future placeholder-colour work must be verified on `channel: 'chrome'`. See
> [Themes → traps](themes.md#traps-that-reintroduce-the-bug-all-fixed-keep-them-fixed).
