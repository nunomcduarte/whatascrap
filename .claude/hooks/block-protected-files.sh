#!/usr/bin/env bash
# Blocks Edit/Write on the live SQLite library and any env files. Exit 2 in PreToolUse
# halts the tool call and feeds stderr back to Claude.
set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[[ -z "$file" ]] && exit 0

# Allowlist: glob patterns in this file are exceptions to the block below.
# One pattern per line; lines starting with # are comments.
allowlist="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/protected-files-allow.txt"
if [[ -f "$allowlist" ]]; then
  while IFS= read -r pattern || [[ -n "$pattern" ]]; do
    [[ -z "$pattern" || "$pattern" =~ ^[[:space:]]*# ]] && continue
    # shellcheck disable=SC2053
    if [[ "$file" == $pattern ]]; then
      exit 0
    fi
  done < "$allowlist"
fi

case "$file" in
  */frontend/scrape.db|*/frontend/scrape.db-shm|*/frontend/scrape.db-wal|*.env|*/.env.*)
    echo "Blocked: '$file' is protected (live SQLite library or env file). Add to .claude/hooks/protected-files-allow.txt if Claude should be allowed to write it." >&2
    exit 2
    ;;
esac
exit 0
