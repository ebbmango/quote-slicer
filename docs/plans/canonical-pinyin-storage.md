# Plan: Canonical numbered-pinyin storage + diacritic display

## What

Change the `pinyin` field on `SourceToken` (and the exported JSON) from a
free-text string that *happens* to contain diacritic pinyin (`zhī`) to a
**canonical numbered-pinyin string** (`zhi1`). The Mapping UI continues to
*display* and *accept input* in diacritic pinyin (`zhī`) — only the
stored/exported representation changes.

This is groundwork for eventually supporting other transliteration systems
(Wade-Giles, Zhuyin) as alternate *display* modes, without changing the
underlying data shape again.

## Why

Diacritic pinyin (`zhī`) is hard to programmatically transliterate into
other systems (Wade-Giles, Zhuyin) and hard to compare/search. Numbered
pinyin (`zhi1`) is the standard canonical form most conversion libraries
and tables key off. Storing canonical form now means:

- JSON export becomes a stable, system-agnostic representation.
- Future "view in Wade-Giles/Zhuyin" features only need a converter from
  `zhi1`, not from `zhī` (which requires its own diacritic-parsing step
  every time).

## Key facts established during design

- `pinyin` is **one syllable per hanzi token** — `tokenPinyin()`
  ([alignment.svelte.ts:25-29](../../src/lib/context/alignment.svelte.ts))
  calls `pinyin(text, {...})` on a single character. No multi-syllable
  strings to worry about.
- `pinyin-pro` (already a dependency, v3.28.1) supports
  `toneType: 'num'` directly — `zhī` ↔ `zhi1` conversion needs no new
  library for plain pinyin.
- Export is **one-way** (JSON out only). There is no JSON re-import
  feature, so there's no old-data migration concern — every session
  starts from fresh tokenization.
- The pinyin field is currently **free-text and user-editable**
  ([Mapping.svelte:111-124](../../src/lib/components/Mapping.svelte)) —
  users can type arbitrary notes, not just pinyin. This permissiveness
  must be preserved.

## Design decisions

1. **Auto-detect input system on blur.** The single input box stays as-is
   (no mode toggle, no separate fields). On blur/commit, attempt to parse
   the typed text as pinyin (diacritic or numbered form). If it parses,
   convert + store canonical `zhi1`. If not, store the raw text as-is
   (current behavior — preserves free-text notes use case).

2. **One input box per hanzi token, unchanged.** No structural change to
   `MappingView.sourceEntries` or the `{#each}` loop in `Mapping.svelte`.

3. **Storage shape unchanged: single `string | null | undefined` field.**
   Only the *convention* of its contents changes (canonical numbered
   pinyin instead of diacritic). No split into `{initial, final, tone}`
   — avoids touching `tokenStore`, `exportFormat`, and type definitions
   across the codebase.

4. **Permissive validation (NOTE: flagged for future revisit).**
   Unparseable input is stored raw, unchanged. **This is provisional** —
   we may want stricter validation/feedback later (e.g. visually flag
   "this won't transliterate"). Revisit once usage patterns are clearer.

5. **Convert on blur, not per-keystroke.** While typing, the input shows
   the user's raw text untouched (current `oninput` → `setPinyin` keeps
   writing raw text to a "live edit buffer"). On blur:
   - Parse the final value.
   - If parseable as pinyin → store canonical `zhi1` in `pinyin`.
   - If not → store raw text in `pinyin` (current behavior).
   - Re-render the box from the *display* derivation (canonical → `zhī`,
     or raw text passthrough if unparseable).

   Per-keystroke conversion was rejected: most partial input ("zh", "zhi")
   is unparseable mid-type, and rewriting the displayed value while the
   user is typing risks cursor-jump/flicker.

6. **Scope: storage + display conversion only, no display-system
   selector.** The Mapping UI always shows diacritic pinyin, same as
   today. A future toggle to view Zhuyin/Wade-Giles is enabled by this
   change but **not built now**.

7. **Pinyin-only conversion for v1** (numbered ↔ diacritic, both via
   `pinyin-pro`'s `toneType` option).
   **IMPORTANT FOLLOW-UP (flagged as high priority by user):** Wade-Giles
   and Zhuyin input detection + conversion tables are explicitly **out of
   scope for this change** but are the actual long-term goal. Building
   those tables is nontrivial — Wade-Giles has irregular/ambiguous
   romanizations (apostrophes, multiple spellings for the same syllable)
   and Zhuyin uses a dedicated glyph set (easy to *detect*, harder to
   *convert* completely). When tackled, the permissive-fallback design
   here means typing Wade-Giles/Zhuyin today just stores raw text — no
   regression, and no rework needed to the storage shape when conversion
   tables are added later.

8. **No data migration needed.** Export is one-way; no re-import exists.

## Where

- [tokenize.ts:9](../../src/lib/tokenize.ts) — `pinyin?: string | null`
  field on `SourceToken`. Update doc comment to describe new convention:
  canonical numbered pinyin (`zhi1`) when parseable, raw text otherwise.

- [alignment.svelte.ts:25-29](../../src/lib/context/alignment.svelte.ts) —
  `tokenPinyin()`, the auto-generation path. Change
  `pinyin(text, { toneType: 'symbol', separator: ' ' })` to
  `pinyin(text, { toneType: 'num' })` so freshly-tokenized tokens get
  canonical form directly.

- [alignment.svelte.ts:18-23](../../src/lib/context/alignment.svelte.ts) —
  `MappingView.sourceEntries[].pinyin` — currently passes the stored
  value straight through. Needs to pass it through a **display
  converter** (canonical → diacritic, or passthrough if unparseable)
  before reaching the UI.

- [Mapping.svelte:111-124](../../src/lib/components/Mapping.svelte) —
  input box:
  - `value={...entry?.pinyin}` → use the display-converted (diacritic)
    value.
  - `oninput` → keep writing raw text to a live buffer (as today, via
    `alignment.setPinyin`).
  - Add `onblur` → parse the current raw value:
    - If valid pinyin (diacritic or numbered) → convert to canonical
      `zhi1`, call `alignment.setPinyin` with canonical form.
    - Else → leave raw text as stored value (no change needed, already
      written by `oninput`).

- **New module**, e.g. `src/lib/pinyinConvert.ts`:
  - `toCanonical(input: string): string | null` — attempt parse of
    diacritic or numbered pinyin syllable → return `zhi1` form, or `null`
    if unparseable.
  - `toDisplay(canonical: string): string` — `zhi1` → `zhī`. If input
    doesn't match canonical numbered-pinyin shape (e.g. it's raw
    free-text from the permissive fallback), return it unchanged.

  Both can be thin wrappers around `pinyin-pro`'s conversion utilities
  (`toneType: 'num'` vs `toneType: 'symbol'`) plus a regex check for
  "is this already canonical numbered pinyin" (`/^[a-z]+[1-5]?$/` roughly
  — refine against the actual syllable set if needed).

- `exportFormat.ts` — **no change**. Already dumps the `pinyin` field
  verbatim; it'll just contain canonical strings now.

## Out of scope / future work

- Wade-Giles and Zhuyin input parsing + conversion tables (point 7 above)
  — the actual end goal motivating this change, deliberately deferred.
- Display-system selector (toggle between pinyin/Zhuyin/Wade-Giles views
  in the Mapping UI).
- Stricter validation / UI feedback for unparseable pinyin input (point
  4 above).
- JSON re-import (not currently a feature; if added later, canonical
  storage makes it easier, no special-casing needed).

## Verification

- `npx tsc --noEmit`
- `npx vitest` — add unit tests for `pinyinConvert.ts`:
  `toCanonical`/`toDisplay` round-trip for all tones (1-5, incl. neutral),
  and unparseable-input passthrough.
- Manual: in dev, type diacritic pinyin, numbered pinyin, and a free-text
  note into a pinyin box; blur each; confirm display stays/becomes
  diacritic for the two valid cases and the note stays unchanged. Check
  sidebar JSON export shows canonical numbered form.
