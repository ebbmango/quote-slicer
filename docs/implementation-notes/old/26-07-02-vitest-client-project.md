# Vitest client project: unit-testing runes modules

> Commits: `4832b58`, `84b20c6`
> Date: 2026-07-02

## Overview

The unit-test suite was split into two vitest projects — **client** (jsdom, the
browser Svelte runtime) and **server** (plain node) — so that class-based rune
state like `Alignment` and `ViewHighlight` can finally be unit-tested. The same
session then used the new setup to backfill coverage for the line split/merge
math, the source tokenizer's grouping state machine, and the token store.

## Motivation

Until now the unit suite was a single node-environment project holding two
template-era specs in `vitest-examples/`. Everything interesting in the app —
the mapping lifecycle, the click state machine, the view-tool highlight —
lives in `*.svelte.ts` classes built on `$state`/`$derived`, and none of it was
testable: under the **server-compiled** Svelte runtime, `$derived` is
compute-once, so a test that mutates state and re-reads a derived value sees a
stale snapshot. The modules need the *client* runtime, which needs a browser-ish
environment.

## Implementation Details

Two things in `vite.config.ts` make the client project work, and both are
load-bearing:

- `resolve: { conditions: ['browser'] }` — this, not jsdom, is what selects the
  client Svelte runtime with live `$derived` recomputation. jsdom alone would
  still load the server runtime and reproduce the stale-value problem silently.
- `environment: 'jsdom'` plus `vitest-setup-client.ts`, which stubs
  `window.matchMedia` — the theme controller queries it at module init, so the
  stub must exist before any test file's import graph pulls in
  `systemTheme.ts`.

Routing between the projects is purely by filename convention:
`*.svelte.{test,spec}.ts` runs in the client project, plain `*.spec.ts` in
node. The first specs written against the client project are
`alignment.svelte.spec.ts` (mapping lifecycle, toggle semantics, pinyin
commit) and `viewHighlight.svelte.spec.ts`, both using a mock token store
rather than the real context wiring.

The follow-up coverage commit (`84b20c6`) deliberately stayed in the **server**
project: `line.ts` split/merge (immutability, and the out-of-range throw, now
documented as a precondition comment on `splitAfterToken`), every branch of the
`groupSourceTokens` state machine including line-boundary orphaning, and the
token store's text-keyed cache and pinyin overlay — testable under node because
`onMount` is a no-op there.

## Areas to Be Careful

The filename convention is the *only* router. A runes module accidentally
tested from a plain `.spec.ts` file will load the server runtime and get
compute-once `$derived` — tests may pass against stale values or fail
mysteriously, with no error pointing at the real cause. If a rune-dependent
test behaves nonsensically, check which project it ran in first.
