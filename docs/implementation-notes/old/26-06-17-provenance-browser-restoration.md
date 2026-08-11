# Provenance Textarea: Suppressing Browser Form Restoration

> Commits: `4670950`
> Date: 2026-06-17

## Overview

`autocomplete="off"` was added to the provenance textarea to prevent the browser from restoring
its previous value on page reload. This is intentional — the attribute is not a convenience
hint but a structural fix for a DOM-lifecycle asymmetry.

## Motivation

On reload, the browser restores the content of persistent named form fields before JavaScript
finishes initializing. This caused the provenance field to briefly display the value from the
previous session while the source and target fields correctly showed their empty/placeholder
state.

The asymmetry is structural: source and target textareas live inside `{#if editing}` in
`QuoteWorkbench.svelte`, which means they are **unmounted** when the app is not in text tool
(e.g., after advancing to link tool). On a fresh page load they mount from scratch with no
prior DOM state for the browser to restore. The provenance textarea is **always in the DOM**
across all tools, so the browser does find a prior value for it and restores it — racing Svelte's
binding.

## Design Decision

`autocomplete="off"` suppresses the browser's form restoration for this field. It is the
correct tool here: the field's value is owned entirely by Svelte state (`$state('')` in
`+page.svelte`), and any externally injected value — whether autocomplete, autofill, or form
restoration — is unwanted.

This is not a hint to disable password or address suggestions. It is a declaration that the
browser should not touch this field's value at all, because the application owns its state.
Removing this attribute would re-expose the reload flicker.
