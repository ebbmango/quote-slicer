# Canonical pinyin storage — implementation + code reviews

## Ask

Implement [`docs/plans/canonical-pinyin-storage.md`](../plans/canonical-pinyin-storage.md):
switch `SourceToken.pinyin` storage from diacritic (`zhī`) to canonical
numbered pinyin (`zhi1`), while the Mapping UI continues to display/accept
diacritic.

## Done

- New [`pinyinConvert.ts`](../../src/lib/pinyinConvert.ts): `toCanonical()` /
  `toDisplay()`, backed by 407-syllable table derived from `pinyin-pro`.
- [`tokenize.ts`](../../src/lib/tokenize.ts): doc comment updated for `pinyin`
  field convention.
- [`alignment.svelte.ts`](../../src/lib/context/alignment.svelte.ts):
  `tokenPinyin()` → `toneType: 'num'`; `sourceEntries[].pinyin` →
  `toDisplay(...)`.
- New [`PinyinInput.svelte`](../../src/lib/components/PinyinInput.svelte):
  local edit buffer, commits via `onCommit` on blur (no mid-type
  reformatting).
- [`Mapping.svelte`](../../src/lib/components/Mapping.svelte): swapped raw
  `<input>` for `PinyinInput`; commit handler passes raw text to
  `alignment.setPinyin`, which owns canonicalization (see Session 3 below).
- [`pinyinConvert.spec.ts`](../../src/lib/vitest-examples/pinyinConvert.spec.ts):
  12 tests, all pass. `tsc`/`svelte-check` clean (only pre-existing unrelated
  error at `alignment.svelte.ts:199`).

Bug found during testing: toneless input ("zhi") wasn't getting tone "0"
appended — fixed by adding the `PINYIN_SYLLABLES` table + `canonicalize()`
helper (user chose "syllable table" approach over alternatives).

---

## Code review #1 (after initial implementation + toneless-tone fix)

Findings, ranked:

1. `pinyinConvert.ts:73` — `CANONICAL.test(s)` on already-numbered input had
   no syllable-table validation (e.g. `"abc1"` passed through as canonical).
2. `pinyinConvert.ts:76-80` — v/u→ü normalization only applied in toneless
   branch; numbered/diacritic branches with `v` (e.g. `"lve2"`) mis-rendered
   (`"lvé"` instead of `"lüè"`).
3. `Mapping.svelte:111-123` (old inline input) — typing canonical numbered
   pinyin directly (e.g. `"zhi1"`) caused the bound `value` to snap to
   diacritic (`"zhī"`) mid-edit while still focused — cursor jump/UX glitch.
4. `Mapping.svelte:124-130` (old onblur) — canonical-conversion logic lives
   in the component's `onblur`/`onCommit` rather than in
   `alignment.svelte.ts`/tokenState (the "single token owner" per
   [`docs/token-store.md`](../token-store.md)).
5. `alignment.svelte.ts:134` — `toDisplay()` (regex test + pinyin-pro
   `convert()`) runs unmemoized for every `sourceEntry` inside
   `buildMappingView`, part of a `$derived` (`sortedMappingViews`) recomputed
   on broad state changes.

### Resolution

- **#1 + #2 — SOLVED.** Fixed together via unified `canonicalize(syllable,
  tone)` helper: normalizes `v`→`ü` and validates against
  `PINYIN_SYLLABLES` across all three input branches (numbered / diacritic /
  toneless). Verified via unit tests.
- **#3 — SOLVED.** Extracted `PinyinInput.svelte` with local
  `editing`/`buffer` state — display value only follows the store-derived
  `value` prop when not editing; commit happens once on blur. Verified live
  in browser preview (`zhi1` stays `zhi1` while editing, becomes `zhī` after
  blur, zero console errors).
- **#4 — NOT SOLVED.** Conversion logic still lives in `Mapping.svelte`'s
  `onCommit` callback (`toCanonical(raw) ?? raw`), not in
  `alignment.svelte.ts`/tokenState.
- **#5 — NOT SOLVED.** `toDisplay()` still runs unmemoized in
  `buildMappingView` for every source entry; confirmed in review #2's
  Efficiency angle as the dominant remaining cost (less frequent now since
  commits happen on blur, not per keystroke).

---

## Code review #2 (after fixes for #2 and #3 above)

Findings, ranked:

1. **CONFIRMED** — `PinyinInput.svelte:41` — pinyin edits now reach the
   alignment store only on blur (`onCommit`), not per-keystroke;
   [`JsonExportPanel.svelte`](../../src/lib/components/JsonExportPanel.svelte)'s
   live JSON preview (`$derived` over `alignment.exportData.sourceTokens`)
   no longer updates while typing pinyin — frozen until blur. Real,
   user-visible regression.
2. **PLAUSIBLE** — `Mapping.svelte:93` — `{#each ... as entry, i
   (entry?.tokenIndex ?? 'empty')}` keys `PinyinInput` by `tokenIndex`; if
   `sourceEntries` reorder/reassign `tokenIndex` mid-edit (e.g. line
   split/merge while a mapping card is open and a pinyin field is focused
   with an uncommitted buffer), Svelte reuses the component instance for a
   different token with stale `editing`/`buffer` state, committing the wrong
   text to the wrong token on blur.
3. **minor/cleanup** — `Mapping.svelte:119` — `onCommit={isEmpty ? () => {} :
   ...}` allocates a no-op closure every render for a branch that's provably
   unreachable (input is `disabled` when `isEmpty`, so blur/onCommit never
   fires). Could drop the ternary or make `onCommit` optional/`undefined`.
4. **simplification** — `PinyinInput.svelte:24` — `editing` (boolean) and
   `buffer` (string) are two state vars that must be kept in sync manually;
   collapsing to `buffer: string | null` (`null` = not editing) would
   eliminate a desync risk for future edits.
5. **altitude/naming** — `PinyinInput.svelte:1` — component named
   generically ("PinyinInput" / Input-like) but hardcodes pinyin-specific UI
   details (`placeholder="Empty"`, `'- - - -'` empty-state string,
   `max-w-[9ch]`, `font-ss4`) — naming/abstraction concern given the plan's
   stated future goal of Wade-Giles/Zhuyin display variants.

### Refuted sub-agent claim

One finder agent claimed `PinyinInput`'s `value` prop receives raw canonical
pinyin (not diacritic). **REFUTED** — `alignment.svelte.ts:134` already
applies `toDisplay()` to `sourceEntries[].pinyin` (from the first
implementation step), and browser testing confirmed `zhi1` → `zhī` display
after blur.

---

## Session 3 — resolutions

Reviewed all open items, decided scope, implemented a subset.

### Fixed

- **Review #2 #2 (wrong-token commit on reorder) — SOLVED.** `MappingView`'s
  `sourceEntries` now carry the stable `tokenId`
  ([`alignment.svelte.ts:22,129`](../../src/lib/context/alignment.svelte.ts));
  `Mapping.svelte`'s `{#each}` keys by `tokenId` instead of the position-based
  `tokenIndex`, so split/merge can no longer reuse a `PinyinInput` instance for
  a different token. Fix applied regardless of repro (cheap, removes the class).
- **Review #1 #4 (conversion-logic placement) — SOLVED.** `toCanonical(raw) ??
  raw` moved out of `Mapping.svelte`'s `onCommit` into `alignment.setPinyin`
  ([`alignment.svelte.ts:153`](../../src/lib/context/alignment.svelte.ts)) — the
  store now owns canonicalization (single token owner per `docs/token-store.md`).
  Component just passes raw text.
- **Review #2 #3 (no-op closure) — SOLVED.** `onCommit` is now optional in
  [`PinyinInput.svelte`](../../src/lib/components/PinyinInput.svelte)
  (`onCommit?: ...`, guarded `onCommit?.(buffer)`); `Mapping.svelte` passes
  `undefined` for the empty case instead of allocating `() => {}`.

`tsc`/`svelte-check` clean (only the pre-existing unrelated error, now at
`alignment.svelte.ts:199`). 12/12 pinyinConvert tests pass.

### Dropped (won't-fix)

- **Review #2 #1 (JSON preview freeze during edit) — WON'T FIX.** Canonical
  storage requires a complete, valid syllable; partial keystrokes (`"zh"`,
  `"zhi1x"`) can't be validated mid-type. Live-committing raw text would put
  transient invalid values into `SourceToken.pinyin`, breaking the
  "always canonical-or-empty" invariant every other reader relies on. The
  blur-only commit (preview lags until blur) is the accepted tradeoff.

### Note for future debugging

`setPinyin(id, position, value)` is position-based (indexes `sourceTokenIds`).
A `tokenId`-based signature would be more robust against reorder/split/merge —
flagged inline at `alignment.svelte.ts:153`. If pinyin edits ever commit to the
wrong token, look there first.

## Open items (deferred to a later cleanup pass)

- **Review #2 #5** — `PinyinInput` naming/abstraction is pinyin-specific
  (hardcoded placeholder, empty-state string, widths) — revisit when
  Wade-Giles/Zhuyin display variants land. Skipped: single consumer today,
  premature to generalize.
- **Review #1 #5** — `toDisplay()` runs unmemoized per source entry in
  `buildMappingView`. Defer until measured (commits now happen on blur, not
  per-keystroke, so the cost is far lower).

## Session 4 — final cleanup + extra fix

- **Review #2 #4 (editing+buffer collapse) — SOLVED.** `PinyinInput.svelte`
  now uses a single `buffer: string | null` (`null` = not editing); `shown =
  buffer ?? value`. Verified live (`zhi1` → `zhī` on blur, no console errors).
- **Extra fix (not from prior reviews) — blank pinyin now clears to
  `undefined`.** `setPinyin` ([alignment.svelte.ts:162](../../src/lib/context/alignment.svelte.ts))
  trims input; empty → `store.setPinyin(tokenId, undefined)` instead of `""`,
  so export omits the field again (`"pinyin": undefined`) rather than showing
  `"pinyin": ""`. Verified live via JSON export panel.
- `/code-review` (medium effort, 7-angle) on the full diff: no new findings.
- `tsc --noEmit` clean (only the pre-existing unrelated error, now at
  `alignment.svelte.ts:202`).
- Committed as `96ada2f`.
