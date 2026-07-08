# Line-Tool Redistribution Cross-Row Animation Fix

> Commits: `a83a715`, `34b50d8`
> Date: 2026-06-17

## Overview

Split/merge divisors in line tool spread apart on hover to create a visual affordance. This spread is driven by a CSS custom property `--rd-x` set by the `redistribute` Svelte action. When a hovered divisor crossed a visual row boundary (i.e., the previously-spread divisors were on a different row than the newly-spread ones), the old row snapped back and the new row jumped open instead of both easing. Two commits fixed this by registering `--rd-x` as a typed CSS property and clearing stale values before applying new ones.

## Motivation

CSS transitions on `transform: translateX(var(--rd-x))` only interpolate smoothly when **both** transition endpoints are concrete values. When `--rd-x` is not set on an element, `var(--rd-x)` resolves to the CSS custom property default (empty / invalid), which is not a length the transition engine can interpolate from. The result: the old row's `--rd-x` collapses from an explicit value to a fallback (snap), and the new row's `--rd-x` opens from a fallback to an explicit value (also snap).

This was fine as long as the hovered divisor stayed on the same visual row, where all affected tokens already had an explicit `--rd-x` set. It broke on row changes.

## Fix

**`@property` registration** (`InteractiveSourceText.svelte`, `InteractiveTargetText.svelte`):

```css
@property --rd-x {
	syntax: '<length>';
	initial-value: 0px;
	inherits: true;
}
```

Declaring `--rd-x` as a typed `<length>` property gives it a concrete `0px` initial value on every element, even those where the `redistribute` action has never written it. Both transition endpoints are now explicit `<length>` values — the transition engine can interpolate them regardless of which visual row is involved.

`inherits: true` is necessary because tokens read `--rd-x` via inheritance from their zone container (set once on the zone, propagated down).

**Stale-value clear** (`redistribute.ts`): Before writing new `--rd-x` values for the hovered row, the action now clears `--rd-x` on all previously-spread tokens. Without this, tokens from the old row would retain their spread value even after the hover moved away, producing a ghost spread on the previous row alongside the new one.

## Areas to Be Careful

`@property` registration is scoped to the component's `<style>` block, so it must be present in both `InteractiveSourceText.svelte` and `InteractiveTargetText.svelte` separately — one registration does not cover the other zone.
