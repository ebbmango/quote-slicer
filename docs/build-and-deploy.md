# Build & Deploy

## Static prerender

The app is a fully static SvelteKit site — `export const prerender = true` in
`+layout.ts`, built with `@sveltejs/adapter-static`. There is no SSR and no server
runtime: the build emits plain HTML/JS/CSS. This is *why* anything touching browser
APIs (notably GSAP) is lazy-loaded inside `onMount` rather than imported at module top
level — import-time browser calls would break prerendering.

The adapter is configured with `fallback: '404.html'` so client-side routes still
resolve when GitHub Pages serves a 404 for an unknown path.

Runes mode is forced project-wide in `svelte.config.js` (except for `node_modules`).

## Base path

The site is served from a subpath (`/quote-slicer/`), not a domain root.
`svelte.config.js` computes the base from whether the SvelteKit CLI was invoked with
`dev`:

```js
const dev = process.argv.includes('dev');
const basePath = dev ? '' : '/quote-slicer';  // → kit.paths.base
```

So dev-server URLs stay root-relative, while production build links resolve under the
Pages subpath — with no per-environment env var to set.

## The proprietary icons file

`src/lib/assets/icons.json` holds a **proprietary icon set** and is **gitignored**. A
clean checkout therefore *cannot build* — the import fails on the missing file. Locally
you need your own copy of `icons.json` in place.

In CI the file is restored from a repo secret before install/build:

```yaml
- name: Restore proprietary icons
  run: echo "${{ secrets.ICONS_JSON_B64 }}" | base64 -d > src/lib/assets/icons.json
```

`ICONS_JSON_B64` is the file's contents, base64-encoded.

> If `ICONS_JSON_B64` is missing or stale, CI fails on the missing `icons.json` import
> — the same failure mode as a local checkout without the file. Anyone who changes
> `icons.json` locally must re-encode and update the secret, or CI builds use the old
> icons.

## The GitHub Pages pipeline

`.github/workflows/deploy.yml` builds and deploys on every push to `main` (and on
manual `workflow_dispatch`). Two jobs:

1. **build** — checkout → setup Node 20 (npm cache) → restore `icons.json` from the
   secret → `npm ci` → `npm run build` → upload `./build` as a Pages artifact.
2. **deploy** — `actions/deploy-pages@v4` publishes the artifact to the `github-pages`
   environment.

Concurrency is grouped on `pages` with `cancel-in-progress`, so a newer push supersedes
an in-flight deploy.

## Dev commands

```bash
npm run dev          # vite dev server
npm run build        # static build → ./build
npm run preview      # preview the production build
npx tsc --noEmit     # type-check
npm run check        # svelte-check
npm run lint         # prettier --check + eslint
npm run format       # prettier --write

npm run test:unit    # vitest (src/lib/**/*.spec.ts)
npm run test:e2e     # playwright
npm test             # unit (run) + e2e
```

### Test surface

The framework-free logic is unit-tested with vitest:

- `src/lib/vitest-examples/tokenize.spec.ts` — the target tokenizer's punctuation rules.
- `src/lib/tokenState.spec.ts` — token-state derivation.
- `src/lib/exportFormat.spec.ts` — the JSON pretty-printer.
- `src/lib/navigation/visualNeighbor.spec.ts` — the visual-neighbour math.

End-to-end flows are covered by Playwright (`src/routes/*.e2e.ts`).
