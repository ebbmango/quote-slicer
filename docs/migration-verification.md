# Quotation migration verification

## Data inventory

The owner confirmed on 2026-09-25 that no external Quote Slicer exports or quotation
datasets exist. Quote Slicer has no quotation persistence/import/database path.
Its seed text is parsed into the current model at runtime. Theme localStorage is
unrelated. There is consequently no in-repository legacy quotation collection to
rewrite.

The offline converter validated every one of Verbarium's 17 existing `L*.ts`
quotation assets. All were already target-shaped (`changed: false`) and all original
asset files remain unchanged. Token IDs, mapping IDs/membership, pinyin and canonical
text are preserved. Canonical text snapshots now guard every asset in Verbarium.

The single reported content warning is a trailing translation space in
L001C-Q03-governs-below. It is preserved, with editorial follow-up
[Verbarium #6](https://github.com/ebbmango/verbarium/issues/6).
The blocked-breath missing-space correction remains complete and regression-tested.

## Compatibility proof

`src/routes/quotation-contract.e2e.ts` authors L001A-Q02 in the real Quote Slicer UI,
creates all 14 mappings, edits pinyin through its input, authors source break [10]
and translation breaks [16,28,42], and captures the actual export panel text.
It asserts exact canonical strings, all memberships, unchanged token/pinyin/mapping
objects across lineation edits, separate provenance, and visible independent rows.

`docs/fixtures/dao-one-export.txt` is the captured object. Its payload SHA-256,
excluding the file's final newline, is:

`4ebd7d402f5da54be119b74cb5ebdb92da8df4ece12c04daec1d84ed2458338b`

Verbarium's `apps/web/app/content/quotes/quote-slicer-dao-one.ts` wraps that exact
object in an exported declaration with a type assertion. A byte comparison of the
object payload confirms no reshaping or repair. The renderer tests use this export
for Dao canonical-text, authored-break, provenance/source-link, hover-delay,
many-to-many highlight, and touch-selection regressions. Content tests compare
the export's tokens, pinyin, breaks and memberships with the original real quote.
New mapping UUIDs are expected from authoring a new draft; they are unchanged
between the producer capture and consumer fixture.

The Quote Slicer browser suite also verifies keyboard focus restoration and
two-tap touch merging, independent break arrays, unchanged canonical tokens,
and rejection of unrepresentable empty source lines. A settled desktop screenshot
was visually inspected: two source lines and four translation lines render correctly.

## Mutation and conversion coverage

`breaks.spec.ts` covers interior boundaries, invalid endpoints, sorting, duplicates,
adjacent boundaries, insert affinity, deletion seams, replacement, and exhaustive
small-range transformations. `tokenMutation.spec.ts` covers identity allocation,
split/merge correspondence, mapping ownership conflicts, deletion pruning and
ambiguous pinyin rejection. Raw retokenization is locked after mapping/annotation.

`legacyMigration.spec.ts` tests malformed data, exact reconstruction and reference
validation, plus deterministic CLI conversion of the actual pre-migration Dao
export from Verbarium commit `9464d63^`. That historical input lives only under
`tools/fixtures/`; it is not production data. The converter parses TypeScript data
literals without executing the file and reports discrepancies rather than repairing
content. Missing/undefined optional properties and null retain distinct semantics.

## Legacy removal

`src/lib/line.ts` and its obsolete tests are deleted. No runtime projection adapter
was needed. Production token types, tokenization, store, renderers, line controls,
and exporter all use boundary arrays. Offline migration code lives under `tools/`
and is never imported by production modules. Active model/tokenization/store/
authoring/export documentation now describes the boundary contract.

Allowed historical references are the dated audit, archived implementation notes,
the offline converter and its tests/fixture. CSS `line-tool-active` names describe
the editing tool, not token state. Verbarium's static `LegacyQuote` is unrelated
to the removed representation and remains intact.

## Completion checks

- Final local results: Quote Slicer 152 unit tests and 21 browser tests passed;
  Svelte check reported no errors or warnings; production build passed. Verbarium
  76 tests, typecheck and production build passed under Node 24.20.0.
- These are local verification results, not a claim of deployed or merged code.
- Quote Slicer: `npm run test:unit -- --run`, `npm run check`, `npx playwright test`
  (which builds production before browser tests).
- Verbarium under Node 24: `pnpm test`, `pnpm typecheck`, `pnpm build`.
- Changed TypeScript/Svelte files: ESLint; both repositories: `git diff --check`.
- All original Verbarium quotation assets: no diff from `fbe65d5`.
- Runtime search: no token line properties, old grouping helpers or adapters.

The final repeated browser gate exposed an existing asynchronous preview race:
an older syntax-highlighting result could overwrite the current export. A
deterministic mounted-component test reproduced the reversed completion order;
effect cleanup now discards obsolete results. This protects the actual copy/export
surface rather than masking the failure with retries.

Permanent database/quotation identity, full DBML, ingestion/version negotiation,
responsive break variants, transliteration presentation and unrelated UI remain
deferred as agreed in the contract.
