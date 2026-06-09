# Svelte 5 Diagnostic Session: Writable Derived State, Custom Action Events, and ARIA Roles

> Commits: `c24d212`, `29c60c1`  
> Date: 2026-06-09

## Overview

A focused session resolving all `svelte-check` errors and ESLint diagnostics accumulated after the line-editing mode landed. Three of the fixes are non-trivial: they each expose a constraint of Svelte 5's type or reactivity system that required a real redesign rather than a type cast or suppression comment.

## Text-Keyed Cache for Writable Derived Token State

### The Problem

After `tokenizeSource` and `tokenizeTargetSeparate` were introduced, `QuoteWorkbench` wired them up with the pattern:

```svelte
let sourceTokens = $state(tokenizeSource(sourceText));
$effect(() => { sourceTokens = tokenizeSource(sourceText); });
```

The ESLint rule `svelte/prefer-writable-derived` flagged this. The rule's point is correct: `$effect` runs *after* the DOM update, so there is a brief render frame where `sourceTokens` still holds the old value while `sourceText` has already changed. `$derived` would be synchronous, but `$derived` is read-only — and `sourceTokens` also needs to be writable so that split/merge operations in line editing mode can modify the token array.

### The Solution: Cache Keyed by Text Identity

The core insight is that the only time we want fresh tokenization is when the text changes, and split/merge state should survive as long as the text hasn't changed. This maps cleanly onto a text-keyed cache:

```svelte
let sourceTokensCache = $state<{ text: string; tokens: RawSourceToken[] } | null>(null);

let sourceTokens = $derived(
    sourceTokensCache !== null && sourceTokensCache.text === sourceText
        ? sourceTokensCache.tokens
        : tokenizeSource(sourceText)
);
```

`sourceTokens` is now a pure `$derived` — no effects involved, updates synchronously. Split and merge write back through the cache, stamping the current text string as the key:

```svelte
function splitSource(i: number) {
    sourceTokensCache = { text: sourceText, tokens: splitAfterToken(sourceTokens, i) };
}
```

When `sourceText` changes, the key comparison fails and `$derived` falls through to fresh tokenization automatically. No explicit reset effect is needed.

### Why This Avoids the Lint Rule

The `prefer-writable-derived` rule fires when a `$state` variable is initialized with a derived expression *and* an `$effect` re-derives it from the same dependency. Here, `sourceTokensCache` is initialized to `null` (not derived from `sourceText`), so the rule doesn't apply. The cache is just mutable state that happens to be checked inside a `$derived`.

## Longpress Callback via Action Options

### The Problem

The `longpress` action originally dispatched a `CustomEvent('longpress')` on the node, and the consumer wrote:

```svelte
use:longpress={{ duration: 500 }}
onlongpress={() => link.clickSource(i, true)}
```

In Svelte 5, inline event handler attributes (the `on*` form) are typed against the element's `HTMLElementEventMap`. Custom events dispatched by actions don't appear there unless you augment the global interface — and that augmentation would need to live in `app.d.ts` and apply globally to all elements, which is too broad for a single action's side effect.

### The Solution

Move the callback into `LongpressOptions` and call it directly:

```typescript
type LongpressOptions = {
    duration?: number;
    onlongpress?: () => void;
};
```

The consumer passes it through the action's options object instead:

```svelte
use:longpress={{ duration: 500, onlongpress: () => link.clickSource(i, true) }}
```

The `click` suppression that follows a long press (to swallow the click event fired after `pointerup`) was preserved as-is — the `fired` flag still works correctly even though we no longer dispatch the custom event.

## Dead Whitespace Guards in InteractiveSourceText

`RawSourceToken.type` is the union `'character' | 'punctuation' | 'number' | 'symbol'`. Source tokens are never typed `'whitespace'` — that variant only exists on `RawTargetToken`. Two guards in `InteractiveSourceText` compared against it anyway:

```svelte
{@const interactive = isLinkMode && token.type !== 'whitespace' && token.type !== 'punctuation'}
class={token.type === 'whitespace' ? 'whitespace-pre' : ...}
```

TypeScript reported these as "comparison appears unintentional because the types have no overlap." Both were removed. The `whitespace-pre` class branch was dead code — source tokens never hit it.

This was likely a copy-paste artefact from target token handling, where `'whitespace'` *is* a valid type.

## ARIA Role: `grid` Instead of `application`

The token workspace container in `QuoteWorkbench` — the `<div>` that intercepts keyboard events and holds the source and target token listboxes — needed a `tabindex="0"` to be reachable by Tab, and keyboard event handlers for the Alt+Arrow navigation scheme. Svelte's a11y checker flagged both on a plain `<div>`.

An initial attempt used `role="application"`. This is wrong because `application` is a *landmark* role in the ARIA/aria-query taxonomy (alongside `main`, `navigation`, etc.), not a *widget* role. Svelte's a11y checker considers only widget roles interactive, so it still flagged the element.

`role="grid"` is the correct fit. ARIA defines a grid as:

> A composite widget containing a collection of one or more rows with one or more cells where some or all cells in the grid are focusable by using methods of two-dimensional navigation.

The token container is exactly that: Alt+Up/Down navigates rows of tokens visually, Alt+Left/Right navigates within a row, and Alt+Enter jumps between the source and target zones. Grid is in Svelte's recognized interactive roles list, so both warnings resolve.

## Areas to Be Careful

The text-keyed cache has one implicit assumption: `sourceText` and `targetText` are stable string references between edits. This holds because they are bound to textarea values, which only update on user input events. If text were ever mutated in-place (same reference, different content), the cache would not invalidate and the user would see stale tokens. This scenario cannot happen with the current binding model but would be a subtle bug to diagnose if the data flow changed.
