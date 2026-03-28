#!/bin/bash
# CLAUDEMAX — Update script
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "🔄 Updating CLAUDEMAX..."

cd "$REPO_DIR"
git pull origin main

# Refresh Python deps
pip3 install --upgrade textual rich --quiet

# Refresh Node deps
export PATH="$HOME/.nvm/versions/node/v20.19.0/bin:/usr/local/bin:$PATH"
npm install -g @anthropic-ai/claude-code --quiet 2>/dev/null || true

echo "✅ CLAUDEMAX updated successfully."
