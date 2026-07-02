# Build & Deploy

## Static prerender

The app is a fully static SvelteKit site — `export const prerender = true` in
`+layout.ts`, built with `@sveltejs/adapter-static`. There is no SSR and no server
runtime: the build emits plain HTML/JS/CSS. This is _why_ anything touching browser
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
const basePath = dev ? '' : '/quote-slicer'; // → kit.paths.base
```

So dev-server URLs stay root-relative, while production build links resolve under the
Pages subpath — with no per-environment env var to set.

## The proprietary icons file

`src/lib/assets/icons.json` holds a **proprietary icon set** and is **gitignored**. A
clean checkout therefore _cannot build_ — the import fails on the missing file. Locally
you need your own copy of `icons.json` in place.

In CI the file is restored from a repo secret before install/build:

```yaml
- name: Restore proprietary icons
  run: echo "${{ secrets.ICONS_JSON_B64 }}" | base64 -d > src/lib/assets/icons.json
```

`ICONS_JSON_B64` is the file's contents, base64-encoded.

### The required-keys guard

A _missing_ secret fails the build outright (the `icons.json` import can't resolve). But
a **stale or incomplete** secret — the file present, yet missing the keys a newer
component references — used to slip through: the build succeeded, the deploy succeeded,
and only on prod did the affected icons render as nothing (the lookup returned
`undefined` with no error). This actually shipped once, breaking the toolbar in
production with no build-time signal.

So `deploy.yml` runs a guard step **after** restoring `icons.json` but **before**
`npm ci` (failing before the costly install/build): it reads the restored JSON with
`node -e` and checks every required icon key, exiting non-zero with a message listing any
that are absent.

> The guard is the _enforcement_, not the source of truth. When you add a new icon to a
> component you must update the `ICONS_JSON_B64` secret **and** add the key to the
> guard's required-keys list — otherwise the guard can't catch a stale secret.

## The GitHub Pages pipeline

`.github/workflows/deploy.yml` builds and deploys on every push to `main` (and on
manual `workflow_dispatch`). Two jobs:

1. **build** — checkout → setup Node 20 (npm cache) → restore `icons.json` from the
   secret → **guard required icon keys** → `npm ci` → `npm run build` → upload `./build`
   as a Pages artifact.
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

- `src/lib/tokenize.spec.ts` — the target tokenizer's punctuation rules.
- `src/lib/pinyinConvert.spec.ts` — canonical↔diacritic pinyin conversion.
- `src/lib/tokenState.spec.ts` — token-state derivation.
- `src/lib/tokenPresentation.spec.ts` — per-token colour/opacity/weight output.
- `src/lib/exportFormat.spec.ts` — the JSON pretty-printer.
- `src/lib/themeState.spec.ts` — theme resolution / continuity logic.
- `src/lib/actions/redistribute.spec.ts` — the hover-spread offset math.
- `src/lib/navigation/visualNeighbor.spec.ts` — the visual-neighbour math.

End-to-end flows are covered by Playwright (`src/routes/*.e2e.ts`), including
`line-split-overflow.e2e.ts` (the constrained/overflow line-edit regime) and
`rapid-click.e2e.ts` (the mapping-list re-entrancy guard).
