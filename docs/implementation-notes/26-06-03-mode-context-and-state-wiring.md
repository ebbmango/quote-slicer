# Mode Context and Workbench State Wiring

> Commits: `57c681f`, `67ce723`, `1d0cdac`
> Date: 2026-06-03

## Overview

`mode` — the string that governs which view the workbench is in (`'text' | 'link' | 'line' | 'view'`) — was moved from a local `$state` in `+page.svelte` into a Svelte context so any descendant component can read and mutate it without prop drilling. The same batch of work fixed a silent data-loss bug where the workbench's text fields were not propagating their values back to the parent, and added fallback content that fills empty fields when the user advances past the text input step.

## Motivation

As the workbench grows more components, passing `mode` through an ever-lengthening prop chain would be unworkable. Svelte context is the idiomatic solution: set once at the root, consumed anywhere in the tree.

The data-loss bug was subtle. `QuoteWorkbench` received `sourceText`, `targetText`, and `authorship` as ordinary props and used `bind:value` on its textareas. In Svelte 5 runes mode, props are read-only by default — `bind:value` on a prop variable updates the local copy but does not propagate back to the parent. The result: the parent's `$state` variables stayed empty no matter what the user typed. This became visible only when the fallback logic tried to check `if (!anyFilled)` — it was always true.

## Architecture

`src/lib/context/mode.svelte.ts` defines a `ModeContext` class with a single reactive field `current = $state<Mode>('text')`. Two exported functions, `setModeContext()` and `getModeContext()`, wrap Svelte's `setContext`/`getContext` using a module-scoped `Symbol` as the key. The class-based approach (rather than a plain reactive object) keeps the reactive state encapsulated and avoids the need to pass the state object by reference.

`+page.svelte` calls `setModeContext()` at component initialisation, storing the context for the whole tree. `QuoteWorkbench` calls `getModeContext()` to read the current mode and derive `editing = $derived(mode.current === 'text')`.

## Implementation Details

**`$bindable()` props:** Making `sourceText`, `targetText`, and `authorship` bindable (`$bindable()` in the `$props()` destructuring) opts them into two-way binding. The parent then uses `bind:sourceText` etc. on the `<QuoteWorkbench>` element. This is the Svelte 5 equivalent of the old `bind:prop` pattern on components.

**Example fallback:** When the user clicks the proceed button, `+page.svelte` checks `anyFilled = sourceText || targetText || authorship`. If all three are empty, all three are populated with a complete sample quote (Chinese proverb, English translation, attribution). If at least one is filled, only the empty fields are populated — with their placeholder text (`"空"`, `"Use this box to enter your translated text."`, `"Source"`) rather than fragments of the sample quote. Mixing a real user entry with parts of the example proverb would produce nonsense.

**`autosize` on window resize:** The `autosize` action in `+page.svelte` previously only ran on `input` events, leaving textarea heights stale after a window resize. A `window.addEventListener('resize', resize)` was added with matching cleanup in the `destroy` callback.

## Design Decisions

**Class over plain object for context:** A `ModeContext` class with `$state` fields produces a stable reactive object that survives being passed through context without losing reactivity. A plain `{ current: $state('text') }` object literal would also work in Svelte 5, but the class form makes the type explicit and signals intent.

**`$bindable` is opt-in:** Svelte 5 requires explicit `$bindable()` declarations rather than inferring two-way binding from `bind:` usage at the call site. This is intentional — it makes the component's API explicit about which props flow back to the parent.

## Areas to Be Careful

The `anyFilled` check in the proceed handler reads the parent's `$state` variables. These are now correctly kept in sync via `$bindable`, but any future refactor that moves the text state into `QuoteWorkbench` itself (the more natural home for it) would break this check unless the logic moves with the state.

## Future Considerations

- The `mode` type includes `'link'` and `'view'` states that are not yet wired to any UI or component behaviour.
- The `autosize` action is still defined in `+page.svelte` and passed as a prop to `QuoteWorkbench`. Once the interactive token views fully replace the textareas on mode advance, this dependency can be cleaned up.
