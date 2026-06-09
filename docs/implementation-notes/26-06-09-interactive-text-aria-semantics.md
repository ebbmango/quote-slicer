# Interactive Token Components: ARIA Semantics

> Commits: `dd461ab`  
> Date: 2026-06-09

## Overview

Three separate accessibility problems were fixed in `InteractiveSourceText.svelte` and `InteractiveTargetText.svelte`: missing `{#each}` keys, a focusability gap on the listbox containers, and a token rendering structure that Svelte's a11y analyser couldn't statically verify. The last problem prompted the most design discussion — the fix chosen was the only one that's semantically honest.

## The Three Problems

**Missing `{#each}` keys.** Both line-mode renderers iterated `lineGroups` and their inner `group` arrays without keys. Svelte needs keys to reconcile DOM nodes efficiently and correctly across updates. The natural keys were already in scope: `lineNum` for the outer loop, `globalIndex` (each token's position in the full flat token array) for the inner.

**Listbox not focusable.** The link-mode container (`role="listbox"`) had no `tabindex`. ARIA requires that any element with an interactive role be programmatically focusable — the role alone doesn't make it so. Without `tabindex`, keyboard and AT users can't reach the container. Since focus within the listbox is managed by the parent grid via custom arrow-key navigation (tokens use `tabindex="-1"` and are focused programmatically), `tabindex="-1"` is the right value: the listbox is reachable by script but not inserted into the natural tab order.

**Conditional role and tabindex on token spans.** Previously, each token was a single `<span>` with role and tabindex set by ternary expressions:

```svelte
role={interactive ? 'option' : undefined}
tabindex={interactive ? -1 : undefined}
```

Svelte's static analyser evaluates attributes independently, not as a pair. It sees a `<span>` (non-interactive by default) that *might* have a tabindex, and cannot prove a role is always present when tabindex is. This triggered `a11y_no_noninteractive_tabindex`.

## Design Decision: `{#if interactive}` Split

Two alternatives were considered before settling on the split:

**Always set `role="option"` regardless of mode.** This would make the role static and satisfy the analyser. It was rejected because `role="option"` is a promise to assistive technology that the item is selectable. In view mode, tokens are not selectable — announcing them as options and then not responding to interaction is a real AT regression, not a minor semantic impurity.

**Suppress the warning.** The warning is technically a false positive (the code is correct; the analyser just can't prove it). But suppression was explicitly ruled out: it masks the class of problem rather than solving it, and makes future genuine a11y regressions invisible in that file.

The `{#if interactive}` split makes the static structure unambiguous. The interactive branch always has `role="option"` and `tabindex="-1"`; the non-interactive branch has neither. The duplication is real but minimal — a text node and a few stable attributes — and it reflects a genuine semantic distinction: these are two different kinds of elements, not one element with toggled attributes.

A side effect of the split: the `&& interactive` guards inside handler expressions (`onclick={(e) => interactive && handleClick(e, i)}`) were removed. In the interactive branch, they're provably unnecessary; in the non-interactive branch, there are no handlers at all.

## Line-Mode Container Handlers Removed

The line-mode container divs previously carried `onkeydown` and `onclick` handlers that called `link.deselect()`. These handlers exist to deselect the active mapping on Escape or background click — but in line mode, no mapping is active. The handlers were shared from link-mode logic and had no observable effect in line mode. Removing them resolved the remaining `a11y_no_noninteractive_element_interactions` warning without any behavioral change, and made the line-mode container a pure layout element.
