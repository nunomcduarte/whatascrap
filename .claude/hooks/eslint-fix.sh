#!/usr/bin/env bash
# Auto-runs eslint --fix on edited frontend TS/TSX files. Skips the two
# known-bad files documented in CLAUDE.md so we don't fight pre-existing errors.
set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[[ -z "$file" ]] && exit 0

case "$file" in
  */frontend/src/*.ts|*/frontend/src/*.tsx) ;;
  *) exit 0 ;;
esac

case "$file" in
  */JobsPanel.tsx|*/Sidebar.tsx) exit 0 ;;
esac

output=$(cd "$CLAUDE_PROJECT_DIR/frontend" && npx --no-install eslint --fix "$file" 2>&1) || true
if [[ -n "$output" ]]; then
  printf '%s\n' "$output" >&2
fi
exit 0
