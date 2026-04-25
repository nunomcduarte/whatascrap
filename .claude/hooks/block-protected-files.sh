#!/usr/bin/env bash
# Blocks Edit/Write on the live SQLite library and any env files. Exit 2 in PreToolUse
# halts the tool call and feeds stderr back to Claude.
set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[[ -z "$file" ]] && exit 0

case "$file" in
  */frontend/scrape.db|*/frontend/scrape.db-shm|*/frontend/scrape.db-wal|*.env|*/.env.*)
    echo "Blocked: '$file' is protected (live SQLite library or env file). Confirm with the user before editing." >&2
    exit 2
    ;;
esac
exit 0
