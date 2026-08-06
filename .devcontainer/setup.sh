#!/usr/bin/env bash
set -euo pipefail

icons_path="src/lib/assets/icons.json"

if [[ -n "${ICONS_JSON_B64:-}" ]]; then
	mkdir -p "$(dirname "$icons_path")"
	temporary_icons="$(mktemp "${icons_path}.XXXXXX")"
	if printf '%s' "$ICONS_JSON_B64" | base64 --decode > "$temporary_icons"; then
		mv "$temporary_icons" "$icons_path"
		echo "Restored $icons_path from the ICONS_JSON_B64 Codespaces secret."
	else
		rm -f "$temporary_icons"
		echo "Error: ICONS_JSON_B64 could not be decoded." >&2
		exit 1
	fi
elif [[ -f "$icons_path" ]]; then
	echo "ICONS_JSON_B64 is not set; using the existing ignored $icons_path file."
else
	echo "Warning: ICONS_JSON_B64 is not set and $icons_path is missing." >&2
	echo "Quote Slicer may not build or run until that Codespaces secret is added and the container is rebuilt." >&2
fi

npm ci
