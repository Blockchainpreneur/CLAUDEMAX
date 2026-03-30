#!/usr/bin/env bash
# CLAUDEMAX launcher — starts daemon if needed, then Python TUI

DAEMON_PORT=57821
DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Start daemon if not responding
curl -sf "http://localhost:$DAEMON_PORT/status" >/dev/null 2>&1 || {
  cd "$DIR/daemon" && bun run src/index.ts >/dev/null 2>&1 &
  sleep 0.5
}

exec python3 "$DIR/tui/claudemax.py"
