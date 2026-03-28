#!/bin/bash
# CLAUDEMAX Black Theme Installer for Mac
# Double-click this file in Finder to run it
# It installs the pure black theme for both Claude web app and Claude Code

set -e

CSS_SOURCE="$HOME/.claude/claudemax-theme.css"
CSS_DEST_ELECTRON="$HOME/Library/Application Support/Claude/claudemax-theme.css"
INJECT_SCRIPT="$HOME/.claude/inject-theme.js"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.claudemax.theme.plist"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}▊ CLAUDEMAX Pure Black Theme Installer${RESET}"
echo -e "${CYAN}────────────────────────────────────────${RESET}"

# 1. Check that ~/.claude/claudemax-theme.css exists (installed by install.sh)
if [ ! -f "$CSS_SOURCE" ]; then
  echo -e "${YELLOW}Theme CSS not found — downloading from repo...${RESET}"
  curl -fsSL "https://raw.githubusercontent.com/Blockchainpreneur/CLAUDEMAX/main/setup/claudemax-theme.css" -o "$CSS_SOURCE"
fi

echo -e "${GREEN}✓ Theme CSS found: $CSS_SOURCE${RESET}"

# 2. Copy CSS to Claude app data directory (for reference)
mkdir -p "$HOME/Library/Application Support/Claude"
cp "$CSS_SOURCE" "$CSS_DEST_ELECTRON"
echo -e "${GREEN}✓ Copied to Claude app dir${RESET}"

# 3. Create the JS injection script
cat > "$INJECT_SCRIPT" << 'JSEOF'
// CLAUDEMAX Black Theme Injector
// Injected via DevTools on Claude app startup
(function() {
  if (document.getElementById('claudemax-black-theme')) return;
  const link = document.createElement('link');
  link.id = 'claudemax-black-theme';
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = 'file://' + require('os').homedir() + '/Library/Application Support/Claude/claudemax-theme.css';
  document.head.appendChild(link);
  console.log('%c▊ CLAUDEMAX pure black theme injected', 'color: #9b59b6; font-weight: bold;');
})();
JSEOF
echo -e "${GREEN}✓ Injection script created: $INJECT_SCRIPT${RESET}"

# 4. Create a LaunchAgent that watches for Claude to open and injects CSS via osascript
cat > "$LAUNCH_AGENT" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.claudemax.theme</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-c</string>
    <string>
      # Wait for Claude to launch
      while true; do
        if pgrep -x "Claude" > /dev/null 2>&1; then
          sleep 2
          # Inject pure black CSS via osascript into Claude app
          osascript -e '
            tell application "System Events"
              if exists process "Claude" then
                tell process "Claude"
                  try
                    -- Open DevTools (Cmd+Option+I)
                    keystroke "i" using {command down, option down}
                    delay 1.5
                    -- Switch to Console
                    keystroke "2" using {command down}
                    delay 0.5
                    -- Inject CSS
                    set cssCode to "var s=document.createElement('"'"'style'"'"');s.id='"'"'claudemax-black'"'"';s.textContent='"'"':root{--color-bg-primary:#000!important;--color-bg-secondary:#000!important;--bg-base:#000!important;--background:#000!important}body,html,#root,#app,[data-theme]{background-color:#000!important}'"'"';if(!document.getElementById('"'"'claudemax-black'"'"'))document.head.appendChild(s);"
                    keystroke cssCode
                    delay 0.3
                    key code 36
                    delay 0.5
                    -- Close DevTools
                    keystroke "i" using {command down, option down}
                  end try
                end tell
              end if
            end tell
          '
          sleep 60
        else
          sleep 5
        fi
      done
    </string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
PLISTEOF

echo -e "${GREEN}✓ LaunchAgent created${RESET}"

# 5. Load the LaunchAgent
launchctl unload "$LAUNCH_AGENT" 2>/dev/null || true
launchctl load "$LAUNCH_AGENT"
echo -e "${GREEN}✓ LaunchAgent loaded (runs automatically at login)${RESET}"

echo ""
echo -e "${BOLD}${CYAN}────────────────────────────────────────${RESET}"
echo -e "${BOLD}For the web app (claude.ai):${RESET}"
echo -e "  1. Install Stylus extension: ${CYAN}https://chrome.google.com/webstore/detail/stylus/clngdbkpkpeebahjckkjfobafhncgmne${RESET}"
echo -e "  2. Open Stylus → Add new style → set URL to ${YELLOW}claude.ai${RESET}"
echo -e "  3. Paste contents of: ${YELLOW}$CSS_SOURCE${RESET}"
echo ""
echo -e "${BOLD}${GREEN}▊ CLAUDEMAX black theme installed.${RESET}"
echo -e "${GREEN}  Restart Claude desktop app to activate.${RESET}"
echo ""
read -p "Press Enter to close..."
