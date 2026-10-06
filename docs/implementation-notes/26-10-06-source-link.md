# Source link field

**Date:** 2026-10-06 · **Issue:** [#20](https://github.com/ebbmango/quote-slicer/issues/20)

A quotation's online textual witness has a URL, which Verbarium lessons used to
pass as a `<Quote>` prop. The quotation file now carries it, so the workbench
has a field for it.

- `QuoteWorkbench.svelte`: a `#source-link` textarea under the provenance, same
  rhythm and text→link morph (`morph-provenance`), smaller and dimmer, disabled
  in the view tool. Its ref joins `EditScope` so split/merge Flips carry it
  like the provenance field.
- `QuoteExportMeta.sourceLink`, `Alignment.sourceLink`; the export panel passes
  it to `buildQuotationFile`, which trims it and leaves a blank one out.
- `quotationFileProblems` holds the Copy and Download buttons while the link is
  not an `http`/`https` address, since Verbarium rejects such a file.
- `quotation-contract.e2e.ts` fills the field and checks `sourceLink` in the
  file; `theme-lockstep.e2e.ts` samples the new field too.
