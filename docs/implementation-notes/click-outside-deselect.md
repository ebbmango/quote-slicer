# Click-outside-to-deselect (a11y_click_events_have_key_events)

`InteractiveSourceText.svelte` and `InteractiveTargetText.svelte` each have a
`role="listbox"` container with `onclick={handleContainerClick}`: clicking
empty space inside the listbox (i.e. `e.target === e.currentTarget`) calls
`alignment.deselect()`.

The svelte a11y linter flags this as a click handler with no local keyboard
handler. We're not adding one, and not restructuring the component, because:

- This is a click-outside-to-dismiss gesture, which has no direct 1:1
  keyboard equivalent (there's no keyboard analog to "click on nothing").
- The keyboard path already exists: `Escape` calls `alignment.deselect()` via
  `tokenGridNav`'s `onEscape` callback, wired on the ancestor
  `tokenContainer` in `QuoteWorkbench.svelte`. Both gestures call the same
  `alignment.deselect()` — same source of truth, two independent UI entry
  points (mouse vs. keyboard), same as a modal's close button and Escape key.
- Lifting click-outside detection up to `QuoteWorkbench` to co-locate it with
  the Escape handler would require threading bounding-box/ref info from the
  child listboxes to the parent, adding coupling for no behavioral gain.

The warning is suppressed locally with a comment pointing here.
