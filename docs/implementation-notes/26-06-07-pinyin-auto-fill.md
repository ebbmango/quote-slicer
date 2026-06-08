# Pinyin Auto-fill from pinyin-pro

> Commits: `cd220cc`
> Date: 2026-06-07

## Overview

When a source hanzi token is clicked to add it to a mapping, the corresponding pinyin slot is now automatically pre-populated using the `pinyin-pro` library. The value remains user-editable — the auto-fill is a suggestion, not a constraint.

## Motivation

Before this change, every new pinyin slot was initialised to an empty string. Users had to type pinyin manually for every character, even when the reading was unambiguous. For common single-character tokens with a single reading, this was pure friction.

## Implementation Details

The logic lives entirely in `link.svelte.ts`. A small helper, `tokenPinyin`, wraps the `pinyin-pro` call:

```ts
function tokenPinyin(token: RawSourceToken | undefined): string {
    if (!token || token.type !== 'character') return '';
    const { text } = token;
    return pinyin(text, { toneType: 'symbol', separator: ' ' });
}
```

The guard against non-`character` tokens ensures punctuation and whitespace tokens (which can end up in source indices in some edge flows) produce an empty string rather than a garbled reading.

`toneType: 'symbol'` produces diacritical tone marks (ā, é, ǐ, ò) rather than numeric suffixes (a1, e2, i3, o4), matching the typographic style used elsewhere in the interface.

`separator: ' '` applies to multi-character tokens: if a single source token contains more than one hanzi, pinyin-pro returns one syllable per character joined by the separator. The result is a space-separated string like `"zhōng guó"`.

The helper is called in all three code paths inside `addSourceToken` where a pinyin slot is created — shift-add to an existing mapping, creating a new mapping for an already-mapped token, and adding to a fresh active mapping. All three paths previously initialised with `''`; all three now call `tokenPinyin`.

## Design Decisions

**Context-aware disambiguation.** `pinyin-pro` performs context-sensitive reading for polyphonic characters (多音字) rather than always returning the most common reading. This is material for this app: source text is natural-language prose, and the "default" reading of a polyphonic character is often wrong in context. The library handles the disambiguation internally.

**Auto-fill is a default, not a lock.** The pinyin field is an `<input>` the user can freely edit. The auto-filled value is just the initial state of the slot, stored in `mapping.pinyin[i]`. Nothing downstream treats it as authoritative.

**Non-character tokens get empty string.** The alternative — skipping auto-fill for non-character tokens — would be indistinguishable from a failed lookup. An explicit empty string is cleaner: the user sees a blank field and knows they need to fill it in.
