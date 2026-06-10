# quote-slicer — Documentation

quote-slicer is a SvelteKit 5 app for drawing word-to-word alignments between a Chinese source text and its English translation. Users paste both texts, then click tokens to link them into named mappings, each with auto-filled pinyin.

## Articles

| Article | What it covers |
|---------|----------------|
| [Overview](overview.md) | What the app does, the four modes, product-level description |
| [Data Model](data-model.md) | `SourceToken`, `TargetToken`, `Mapping` types; stable token IDs |
| [Tokenization](tokenization.md) | Source and target tokenizers, line stamping, whitespace strategy |
| [Link Mode](link-mode.md) | Click state machine, `LinkContext`, mapping lifecycle, whitespace bridging |
| [Line Mode](line-mode.md) | Split/merge, text-keyed cache pattern, animation |
| [UI Architecture](ui-architecture.md) | Component tree, GSAP patterns (Flip + sibling shift), context wiring |
| [File Map](file-map.md) | Every source file and its responsibility |
