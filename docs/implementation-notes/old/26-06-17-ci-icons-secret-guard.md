# CI Guard for ICONS_JSON_B64 Secret

> Commits: `7b37ba2`
> Date: 2026-06-17

## Overview

`icons.json` is gitignored and injected from the `ICONS_JSON_B64` GitHub Actions secret at build time. A stale or incomplete secret previously produced a valid build that crashed silently at runtime — any component accessing a missing icon key got `undefined` with no build-time warning. A CI guard was added to `deploy.yml` that enumerates required icon keys and fails the build fast with a clear error listing the missing ones.

## Motivation

On 2026-06-17, `ToolToolbar.svelte` was updated to use five icon keys that were not yet in the production secret. The build succeeded, the deploy succeeded, but on prod the toolbar was missing and token taps were broken — because the icon import resolved to an object with no matching keys, and the components rendering icon SVGs silently produced nothing.

The failure case was hard to catch in review: the secret is not visible in the repo, the build output does not include `icons.json` contents, and the only signal was a broken prod deploy.

## Implementation

The guard runs as a step in `.github/workflows/deploy.yml` **after** the secret is restored to `src/lib/assets/icons.json` but **before** `npm ci` and the Vite build. It reads the restored JSON with `node -e` and checks for each required key, exiting non-zero with a descriptive message if any are absent.

By failing before `npm ci`, it avoids wasting the full install + build time on a deploy that would produce a broken app.

## Areas to Be Careful

When adding a new icon to any component, the corresponding key must also be added to the `ICONS_JSON_B64` secret (base64-encoded `icons.json`) **and** to the required-keys list in the CI guard. The guard is the enforcement mechanism, not the source of truth — it will catch a missing secret update, but someone must still update the secret itself.
