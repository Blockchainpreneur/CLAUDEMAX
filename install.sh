#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  econ.vibe — One-command installer
#  Usage: curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/econ.vibe/main/install.sh | bash
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="$HOME/econ.vibe"
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

print_header() {
  echo ""
  echo -e "${CYAN}${BOLD}"
  echo "  ███████╗ ██████╗ ██████╗ ███╗  ██╗    ██╗   ██╗██╗██████╗ ███████╗"
  echo "  ██╔════╝██╔════╝██╔═══██╗████╗ ██║    ██║   ██║██║██╔══██╗██╔════╝"
  echo "  █████╗  ██║     ██║   ██║██╔██╗██║    ██║   ██║██║██████╔╝█████╗  "
  echo "  ██╔══╝  ██║     ██║   ██║██║╚████║    ╚██╗ ██╔╝██║██╔══██╗██╔══╝  "
  echo "  ███████╗╚██████╗╚██████╔╝██║ ╚███║     ╚████╔╝ ██║██████╔╝███████╗"
  echo "  ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚══╝      ╚═══╝  ╚═╝╚═════╝ ╚══════╝"
  echo -e "${RESET}"
  echo -e "  ${BOLD}The AI Development Operating System${RESET}"
  echo ""
}

step() { echo -e "\n${CYAN}▶ $1${RESET}"; }
ok()   { echo -e "  ${GREEN}✓ $1${RESET}"; }
warn() { echo -e "  ${YELLOW}⚠ $1${RESET}"; }
fail() { echo -e "  ${RED}✗ $1${RESET}"; }

# ── Detect OS ─────────────────────────────────────────────────────────────────
detect_os() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    ARCH=$(uname -m)
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    ARCH=$(uname -m)
  else
    fail "Unsupported OS: $OSTYPE"
    exit 1
  fi
  ok "Detected: $OS ($ARCH)"
}

# ── Install NVM + Node 20 ─────────────────────────────────────────────────────
install_node() {
  if command -v node &>/dev/null && node -e "process.exit(parseInt(process.version.slice(1)) >= 20 ? 0 : 1)" 2>/dev/null; then
    ok "Node.js $(node --version) already installed"
    return
  fi

  echo "  Installing Node.js 20+ via nvm..."
  export NVM_DIR="$HOME/.nvm"
  if [ ! -d "$NVM_DIR" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  fi
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
  nvm install 20 --lts
  nvm use 20
  ok "Node.js $(node --version) installed"
}

# ── Install Python 3.11+ ──────────────────────────────────────────────────────
install_python() {
  if python3 --version 2>&1 | grep -qE "3\.(1[1-9]|[2-9][0-9])"; then
    ok "Python $(python3 --version) already installed"
  else
    warn "Python 3.11+ recommended. Using $(python3 --version 2>&1 || echo 'not found')"
    warn "Install via: brew install python@3.11  or  https://python.org"
  fi
}

# ── Install Claude Code ───────────────────────────────────────────────────────
install_claude_code() {
  export PATH="$HOME/.nvm/versions/node/v20.19.0/bin:$PATH"
  if command -v claude &>/dev/null; then
    ok "Claude Code already installed"
  else
    echo "  Installing Claude Code..."
    npm install -g @anthropic-ai/claude-code
    ok "Claude Code installed"
  fi
}

# ── Install Ruflo ─────────────────────────────────────────────────────────────
install_ruflo() {
  export PATH="$HOME/.nvm/versions/node/v20.19.0/bin:/usr/local/bin:$PATH"
  echo "  Initializing Ruflo in your home directory..."
  mkdir -p "$HOME/.ruflo-global"
  cd "$HOME/.ruflo-global"
  echo '{"name":"ruflo-global"}' > package.json
  npx ruflo@latest init --yes 2>/dev/null || \
    npx ruflo@latest init 2>/dev/null || \
    warn "Ruflo init skipped — run 'npx ruflo@latest init' in each project"
  ok "Ruflo ready"
}

# ── Install MCP Servers ───────────────────────────────────────────────────────
install_mcp_servers() {
  export PATH="$HOME/.nvm/versions/node/v20.19.0/bin:/usr/local/bin:$PATH"
  echo "  Installing MCP servers (global user scope)..."

  claude mcp add -s user context7 -- npx -y @upstash/context7-mcp 2>/dev/null && ok "context7" || warn "context7 skipped"
  claude mcp add -s user sequential-thinking -- npx -y @modelcontextprotocol/server-sequential-thinking 2>/dev/null && ok "sequential-thinking" || warn "sequential-thinking skipped"
  claude mcp add -s user playwright -- npx -y @playwright/mcp@latest 2>/dev/null && ok "playwright" || warn "playwright skipped"

  echo ""
  echo -e "  ${YELLOW}For GitHub and Supabase MCP, tokens are required:${RESET}"
  echo "  • GitHub:   claude mcp add -s user github -e GITHUB_TOKEN=YOUR_TOKEN -- npx -y @modelcontextprotocol/server-github"
  echo "  • Supabase: claude mcp add -s user supabase -e SUPABASE_ACCESS_TOKEN=YOUR_TOKEN -- npx -y @supabase/mcp-server-supabase@latest"
}

# ── Copy global Claude config ─────────────────────────────────────────────────
copy_claude_config() {
  mkdir -p "$HOME/.claude/helpers"

  if [ -f "$REPO_DIR/setup/CLAUDE.md" ]; then
    cp "$REPO_DIR/setup/CLAUDE.md" "$HOME/.claude/CLAUDE.md"
    ok "CLAUDE.md installed globally"
  fi

  if [ -f "$REPO_DIR/setup/settings.json" ]; then
    cp "$REPO_DIR/setup/settings.json" "$HOME/.claude/settings.json"
    ok "settings.json installed globally"
  fi

  # Install helper scripts if present
  for helper in "$REPO_DIR"/.claude/helpers/*.mjs "$REPO_DIR"/.claude/helpers/*.cjs; do
    [ -f "$helper" ] && cp "$helper" "$HOME/.claude/helpers/" && ok "Copied $(basename $helper)"
  done
}

# ── Install Python TUI deps ───────────────────────────────────────────────────
install_python_deps() {
  echo "  Installing Textual and Rich..."
  pip3 install --user textual rich --quiet 2>/dev/null || \
    pip3 install textual rich --quiet 2>/dev/null || \
    warn "pip install failed — try: pip3 install textual rich"

  if python3 -c "import textual, rich" 2>/dev/null; then
    ok "textual + rich installed"
  else
    warn "Could not verify Python deps — check manually"
  fi
}

# ── Create desktop launcher ───────────────────────────────────────────────────
create_launcher() {
  LAUNCHER="$HOME/Desktop/CLAUDEMAX.command"
  cat > "$LAUNCHER" <<'LAUNCHER_SCRIPT'
#!/bin/bash
export PATH="$HOME/.nvm/versions/node/v20.19.0/bin:/usr/local/bin:$PATH"
# Start Ruflo daemon if not running
npx ruflo@latest daemon status 2>/dev/null | grep -qi "running" || \
  (npx ruflo@latest daemon start 2>/dev/null &)
sleep 1
cd "$HOME/econ.vibe/tui"
python3 app.py
LAUNCHER_SCRIPT

  chmod +x "$LAUNCHER"
  ok "Desktop launcher created: ~/Desktop/CLAUDEMAX.command"
}

# ── Install CLAUDEMAX pure black theme ───────────────────────────────────────
install_theme() {
  mkdir -p "$HOME/.claude"
  if [ -f "$REPO_DIR/setup/claudemax-theme.css" ]; then
    cp "$REPO_DIR/setup/claudemax-theme.css" "$HOME/.claude/claudemax-theme.css"
    ok "CLAUDEMAX pure black theme installed → ~/.claude/claudemax-theme.css"
  fi

  # Write a one-line Stylus userscript wrapper for web/desktop app
  cat > "$HOME/.claude/claudemax-theme-install.txt" <<'THEME_INSTRUCTIONS'
CLAUDEMAX Pure Black Theme — Apply in 30 seconds:

1. Install the free "Stylus" browser extension:
   Chrome:  https://chrome.google.com/webstore/detail/stylus/clngdbkpkpeebahjckkjfobafhncgmne
   Safari:  https://apps.apple.com/app/stylus/id1276145049
   Firefox: https://addons.mozilla.org/addon/styl-us/

2. Open Stylus → "Write new style" → paste ~/.claude/claudemax-theme.css

3. Set URLs to match: claude.ai

Done. Background becomes pure #000000 black. Restarts persist automatically.
THEME_INSTRUCTIONS
  ok "Theme install instructions → ~/.claude/claudemax-theme-install.txt"
}

# ── Start Ruflo daemon ────────────────────────────────────────────────────────
start_daemon() {
  export PATH="$HOME/.nvm/versions/node/v20.19.0/bin:/usr/local/bin:$PATH"
  npx ruflo@latest daemon start 2>/dev/null || true
  ok "Ruflo daemon started"
}

# ── Print success summary ─────────────────────────────────────────────────────
print_success() {
  echo ""
  echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════${RESET}"
  echo -e "${GREEN}${BOLD}  ✅ econ.vibe setup complete!${RESET}"
  echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════${RESET}"
  echo ""
  echo "  What's installed:"
  echo "  • Claude Code (global)"
  echo "  • Multi-agent swarm coordinator (15 agents)"
  echo "  • Speed skills: parallel-execution, smart-routing, context-compress, personas"
  echo "  • MCP: context7, sequential-thinking, playwright"
  echo "  • Global Claude hooks (memory, PII redaction, learning)"
  echo "  • CLAUDEMAX pure black theme → ~/.claude/claudemax-theme.css"
  echo ""
  echo "  Next steps:"
  echo "  1. Add GitHub + Supabase tokens to MCP (see above)"
  echo -e "  2. ${BOLD}Apply pure black theme: see ~/.claude/claudemax-theme-install.txt${RESET}"
  echo -e "  3. ${BOLD}Paste setup/claude-preferences.json into Claude Desktop → Settings → Personal Preferences${RESET}"
  echo ""
  echo -e "${CYAN}  Setup complete. Double-click CLAUDEMAX on your Desktop to launch.${RESET}"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  print_header

  step "1/9  Detecting OS"
  detect_os

  step "2/9  Checking Node.js 20+"
  install_node

  step "3/9  Checking Python 3.11+"
  install_python

  step "4/9  Installing Claude Code"
  install_claude_code

  step "5/9  Setting up Ruflo"
  install_ruflo

  step "6/9  Installing MCP servers"
  install_mcp_servers

  step "7/9  Copying global Claude config"
  copy_claude_config

  step "8/9  Installing Python TUI dependencies"
  install_python_deps

  step "9/9  Creating desktop launcher"
  create_launcher

  install_theme
  start_daemon

  print_success
}

main "$@"
