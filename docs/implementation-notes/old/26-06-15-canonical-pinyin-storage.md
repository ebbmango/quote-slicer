# Canonical numbered pinyin storage

> Commits: `96ada2f`, `2c98dae`
> Date: 2026-06-15

## Overview

`SourceToken.pinyin` now stores canonical *numbered* pinyin (`"zhi1"`) instead
of diacritic pinyin (`"zhī"`). Diacritic form is derived for display only. This
makes the stored/exported representation system-agnostic and sets up future
transliteration support (Wade-Giles, Zhuyin) without parsing diacritics back
out.

## Motivation

Diacritic pinyin is convenient to read but awkward to manipulate: tone marks
sit on different vowels depending on the syllable, and converting diacritic →
other systems means re-deriving the tone number first. Storing the numbered
form up front (the shape `pinyin-pro` emits with `toneType: 'num'`) makes the
stored value the system-agnostic source of truth; diacritic is just one display
option.

See `docs/plans/canonical-pinyin-storage.md` (now removed — plan completed) and
`docs/implementation-notes/canonical-pinyin-storage-review.md` for the design
discussion and review trail.

## Architecture

- **`pinyinConvert.ts`** (new) — `toCanonical()` / `toDisplay()` plus a
  407-syllable table of every valid toneless Mandarin pinyin syllable. The
  table exists to distinguish toneless pinyin (`"zhi"` → gets a neutral tone)
  from free-text annotation notes (`"river"` → left untouched) when
  canonicalizing user input.
- **`alignment.svelte.ts`** — single owner of canonicalization. `tokenPinyin()`
  now requests `toneType: 'num'` from `pinyin-pro` directly (was `'symbol'`).
  `setPinyin()` converts user input to canonical form before writing to the
  token store; the UI never canonicalizes.
- **`PinyinInput.svelte`** (new) — replaces a raw `<input>` in `Mapping.svelte`.
  Holds a local edit buffer while focused so canonical input like `"zhi1"`
  doesn't get reformatted to `"zhī"` mid-keystroke; the buffer commits to
  `onCommit` on blur.

## Implementation Details

- `MappingView.sourceEntries` gained a `tokenId` field alongside `tokenIndex` —
  needed because pinyin lookups now go through a separate memoized array keyed
  in parallel with `sourceTokens`, and `tokenId` is the stable identity across
  edits.
- A new `sourceDisplayPinyin` derived array in `Alignment` maps each source
  token's canonical `pinyin` to its diacritic display form via `toDisplay()`.
  This is memoized separately from `sortedMappingViews` (see Design Decisions).
- `setPinyin(id, position, value)`: blank input clears the token's pinyin to
  `undefined` (so export omits the field, rather than storing `""`).
  Unparseable input (text that doesn't match a pinyin syllable + tone) is
  stored as-is — this is how free-text annotations survive.

## Design Decisions

- **Memoization split**: `toDisplay()` (regex match + `pinyin-pro` convert) was
  initially called inline inside `sortedMappingViews`, which recomputes on
  every mapping add/remove/select — far more often than `sourceTokens`
  actually changes. `2c98dae` pulled it into its own `$derived` keyed only on
  `sourceTokens`, addressing review findings #1 and #5 in
  `canonical-pinyin-storage-review.md`.
- **Storage vs. display separation**: chosen specifically so future
  transliteration systems are additive — they only need their own `toDisplay`-
  equivalent, no change to storage or `setPinyin`.
- Review items #2 and #5 in `canonical-pinyin-storage-review.md` (around
  `PinyinInput` naming/abstraction) were explicitly deferred, not resolved.

## Future Considerations

`setPinyin(id, position, value)` indexes by `position` into `sourceTokenIds`
rather than by stable `tokenId` directly. If pinyin edits ever commit to the
wrong token after a reorder/split/merge, this is the first place to look —
switching to `tokenId` would be more robust.
