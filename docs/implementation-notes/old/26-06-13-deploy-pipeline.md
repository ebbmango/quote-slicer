# GitHub Pages deploy pipeline

> Commits: `c1c84eb`, `3120bca`
> Date: 2026-06-13

## Overview

Adds a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds the
static site and deploys it to GitHub Pages on every push to `main`.

## Motivation

The app builds with `adapter-static` but had no deploy step. Two things stood
in the way of a plain static deploy to Pages: the app isn't served from a
domain root (it lives under `/quote-slicer/`), and one source file
(`src/lib/assets/icons.json`) is gitignored because it contains a proprietary
icon set, so a clean checkout can't build at all.

## Implementation Details

`svelte.config.js` now computes `basePath` from whether the SvelteKit CLI was
invoked with `dev`: empty in dev, `/quote-slicer` otherwise, passed via
`kit.paths.base`. The adapter also gets `fallback: '404.html'` so client-side
routes resolve correctly when Pages serves a 404 for unknown paths.

The workflow's `build` job restores `icons.json` before `npm ci`/`npm run build`:

```yaml
- name: Restore proprietary icons
  run: echo "${{ secrets.ICONS_JSON_B64 }}" | base64 -d > src/lib/assets/icons.json
```

The repo secret `ICONS_JSON_B64` holds the file's contents base64-encoded.
The build output (`./build`) is uploaded as a Pages artifact and deployed by a
second `deploy` job via `actions/deploy-pages@v4`.

## Design Decisions

- Base path is derived from `process.argv` rather than an env var — keeps dev
  server URLs root-relative while prod build links resolve under the Pages
  subpath, with no extra config to set per environment.
- Icons are restored from a secret rather than committed, to keep the
  proprietary icon set out of the repo while still letting CI build.

## Areas to Be Careful

- If `ICONS_JSON_B64` is missing/stale in repo secrets, the build will fail
  on the missing `icons.json` import — same failure case as a local checkout
  without the file.
- Anyone changing `src/lib/assets/icons.json` locally must re-encode and update
  the `ICONS_JSON_B64` secret, or CI builds will use the old icon set.
