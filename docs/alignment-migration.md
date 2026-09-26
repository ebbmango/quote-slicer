# Alignment-owned breaks migration

Tracking: [#2](https://github.com/ebbmango/quote-slicer/issues/2). This document
records the audit before implementation and the approved target contract.

## Audit snapshot (2026-09-25)

Quote Slicer base: `a75ab62` (`origin/main`). The original audit checkout,
`7441aec`, preceded the provenance rename; implementation starts from main.
Verbarium base: `fbe65d5`.

| Responsibility      | Quote Slicer location and observed behavior                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens              | `src/lib/tokenize.ts`: both types carry `line`; source newlines disappear; target newlines emit a space token                                      |
| Line edits          | `src/lib/line.ts`: split/merge rewrite line numbers without changing token count                                                                   |
| Ownership           | `src/lib/context/tokenStore.svelte.ts`: text-keyed token caches, pinyin overlay, animation                                                         |
| Mappings            | `src/lib/context/alignment.svelte.ts`, `src/lib/tokenState.ts`: UUID mappings reference side-local numeric token IDs                               |
| Rendering           | `InteractiveSourceText.svelte`, `InteractiveTargetText.svelte`: adjacent line comparisons; source punctuation grouping; target boundary whitespace |
| Controls            | `QuoteWorkbench.svelte`, `LineDivisor.svelte`: independent callbacks, touch, focus, animation                                                      |
| Export              | `alignment.svelte.ts`, `exportFormat.ts`, `JsonExportPanel.svelte`: flat arrays and meta; formatter requires line; preview only                    |
| Persistence         | `src/routes/+page.svelte`: in-memory draft; only theme uses localStorage                                                                           |
| Regression coverage | tokenizer, line, store, alignment, export unit tests; browser focus/overflow/geometry tests                                                        |

Repository-wide searches found no quotation database, importer, download/save
path, persisted quotation collection, paragraph domain, token insertion/deletion,
token split/merge, or move UI. The paragraph icon names the line tool only.
Raw-text changes fully retokenize before entering the link tool. Target newline
changes also change token count. Mapping, pinyin, and editorial line edits do not.
The UI cannot return to text entry after advancing, but the domain originally
did not guard mapped retokenization. Reusing positional IDs could silently
retarget mappings and pinyin; missing-ID checks do not catch reused IDs.

History explains the constraints: `243ebf6` introduced lines; `db03748` added
target boundary spaces as merge affordances; `1b371e0` introduced IDs;
`5b0c46f` consolidated token ownership after pinyin loss; `9086ea3` made source
punctuation atomic; `f096bbc` keyed pinyin commits by ID; `e046ed5` sanitized meta.

Verbarium's `apps/web/app/quote-slicer-export.ts` already defines the target
contract. `components/quote.tsx` groups source punctuation without crossing
breaks and visually replaces target boundary whitespace with `<br>`.
`components/quote.test.tsx` covers reconstruction, non-contiguous IDs, breaks,
highlighting and provenance links. `content/quotes/quotes.test.ts` validates all
17 quotation assets. Provenance and `sourceHref` are separate component props.
`LegacyQuote` is a static MDX renderer, not token-line compatibility.

Verbarium `9464d63` moved breaks to alignments. `fbe65d5` restored a missing
space token (ID 26) in `L001I-Q01-blocked-breath` and moved its break from 9 to 10.
The correction is complete, with regression coverage. It is not a renderer bug.
Separate content anomaly: `L001C-Q03-governs-below` has a trailing canonical
translation space absent from its descriptive text. Preserve and report it;
structural conversion must not trim it. Other comment/content drift is likewise
editorial work, not authority to rewrite tokens.

Verbarium `schema/verbarium.dbml` makes attestation tokens lossless and excludes
editorial breaks; Translation token storage and Alignment storage remain
incremental work. `CONTEXT.md` and `todo.md` still describe token line assignments.
Full DBML completion does not block this migration.

Baseline: Quote Slicer 141 unit tests, 18 browser tests, check and build;
Verbarium 55 tests, typecheck and build under Node 24. All passed during audit.
Revalidated on implementation main: 142 Quote Slicer unit tests, 18 browser
tests, check and build; Verbarium 55 tests, typecheck and build, all passed.

## Approved contract

```ts
type AttestationTranslationAlignment = {
	attestation: { tokens: SourceToken[] };
	translation: { tokens: TargetToken[] };
	alignment: {
		mappings: { id: string; sourceTokenIds: number[]; targetTokenIds: number[] }[];
		breaks: { attestation: number[]; translation: number[] };
	};
};
```

Tokens have `id`, `text`, and `type`; source tokens also have optional
`pinyin: string | null`. Existing token type discriminants and mapping field
names agree with Verbarium. Production tokens have no editorial line field.
Canonical text is exactly `tokens.map(t => t.text).join('')`.

A boundary `b` is before array index `b`, after index `b - 1`. For `n` tokens,
only integer boundaries `1 <= b < n` are allowed. Zero and terminal boundaries
have no meaning. Empty/one-token streams require `[]`. Arrays are always
serialized, sorted, unique, and independent for each side. Adjacent boundaries
are valid one-token lines; duplicates cannot encode empty lines. A whitespace-only
line may appear visually empty when its boundary whitespace is suppressed.

Initial source newlines are presentation delimiters, not canonical text. Initial
translation newlines contribute one canonical space and a break after it.
Unrepresentable leading/trailing or empty source lines must be reported.
Subsequent lineation edits never create, delete, trim, or retype whitespace.
At a target break after whitespace the renderer may replace the whitespace
visually with `<br>`; merging exposes the same original whitespace again.

Punctuation imposes no domain restriction on boundaries. Source authoring keeps
its existing glued-punctuation restriction; imported valid boundaries still win.
Token IDs are opaque, unique within a side, possibly non-contiguous and unordered.
New IDs are allocated monotonically. Mapping IDs remain UUIDs; membership uses
IDs, never positions. A token is owned by at most one mapping on its side.
Missing/undefined pinyin means unannotated; null means not applicable; strings
remain metadata. Lineation edits change none of these values.

The exported alignment object passes unchanged to Verbarium's `quote` prop.
Provenance stays separate; the lesson-owned `sourceHref` remains separate.
Strict JSON/version negotiation is not required; omission of undefined optional
properties is equivalent to missing properties, never to null.

## Mutation rules

- Insert k tokens at i: boundaries below i stay; above i shift by k. At i,
  explicit affinity chooses insertion before the break (move to i+k) or after
  the break (stay at i).
- Delete [start,end): intersected boundaries collapse to start, later boundaries
  shift left; deduplicate and discard new endpoints.
- Replace [start,end): start stays, end becomes start+k; interior boundaries are
  removed unless the operation supplies explicit correspondence.
- Split: preserve the old ID on the first child, allocate the rest, expand
  mapping membership; exterior breaks transform, internal breaks are not added.
  Reject source metadata that cannot be distributed without guessing.
- Merge: preserve the leftmost ID, remove internal breaks, deduplicate membership;
  reject incompatible mapping ownership or metadata. Crossing a break removes it.
- Delete removes deleted memberships and pinyin; prune only fully empty mappings.
- Retokenization before annotation is allowed. Afterwards require an explicit
  identity edit map; never guess correspondence from repeated text or reuse IDs.
- Move and paragraph editing are unsupported. Future operations must use the
  same centralized transformations rather than UI index arithmetic.

## Delivery and gates

Issues #3–#16 order audit, contract, primitives, mutations, store, export,
rendering, authoring, offline conversion, regression gates, real compatibility
proof, data inventory, legacy deletion, and final verification. Pure helpers
are introduced before runtime consumers. A line projection adapter, if needed,
exists only between store migration and completion of export/render/authoring.
It must be absent when cleanup closes.

The proof uses `L001A-Q02-dao-one`: 20 source tokens, 49 target tokens, 14 mappings,
source break [10], translation breaks [16,28,42], pinyin, punctuation, whitespace,
provenance and source URL. Author/edit in Quote Slicer, consume the unchanged
export in Verbarium, verify reconstruction/breaks/mappings/interaction/metadata,
and run both repositories' full suites. Manual reshaping fails the proof.

No Quote Slicer persisted collection exists in-repository. Validate Verbarium's
17 assets, convert every discovered legacy export, and request owner inventory
of external data before closing the data gate. Preserve exact text and metadata;
record malformed content separately.

Deferred: permanent Quote identity, database identity/PostgreSQL, full DBML,
versioned interchange/runtime negotiation, ingestion, responsive break variants,
transliteration presentation, unrelated typography and lesson UI.
