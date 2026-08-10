#!/bin/sh
# Reads a prompt on stdin, prints a commit message on stdout.
# Exit 127 means the Claude CLI was not found.
set -u

CLAUDE_BIN=${CLAUDE_BIN:-claude}
CLAUDE_MODEL=${CLAUDE_MODEL:-sonnet}
CLAUDE_TIMEOUT=${CLAUDE_TIMEOUT:-90}

command -v "$CLAUDE_BIN" >/dev/null 2>&1 || exit 127

PROMPT_FILE=$(mktemp -t claude-commit-prompt) || exit 1
OUT_FILE=$(mktemp -t claude-commit-msg) || exit 1
trap 'rm -f "$PROMPT_FILE" "$OUT_FILE"' EXIT

cat >"$PROMPT_FILE"
[ -s "$PROMPT_FILE" ] || exit 1

"$CLAUDE_BIN" -p --model "$CLAUDE_MODEL" --allowed-tools '' <"$PROMPT_FILE" >"$OUT_FILE" &
CLAUDE_PID=$!

# The watchdog must not inherit stdout: a background sleep holding the pipe
# open makes the caller wait for the full timeout after the CLI is done.
( sleep "$CLAUDE_TIMEOUT"; kill "$CLAUDE_PID" 2>/dev/null ) >/dev/null 2>&1 &
WATCHDOG_PID=$!

wait "$CLAUDE_PID"
STATUS=$?

pkill -P "$WATCHDOG_PID" 2>/dev/null
kill "$WATCHDOG_PID" 2>/dev/null
wait "$WATCHDOG_PID" 2>/dev/null

if [ "$STATUS" -ne 0 ]; then
	# The CLI reports usage limits and auth failures on stdout, which is dropped
	# on a failing exit — forward it so the caller can explain what happened.
	cat "$OUT_FILE" >&2
	exit "$STATUS"
fi

[ -s "$OUT_FILE" ] || exit 1

cat "$OUT_FILE"
