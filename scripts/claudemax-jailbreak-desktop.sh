#!/bin/bash
# ╔═══════════════════════════════════════════════════════════════╗
# ║   CLAUDEMAX Desktop App Jailbreak — Pure Black Theme Patch   ║
# ║   Patches the Claude.app Electron bundle directly            ║
# ║   Run once on your Mac. Re-run after Claude app updates.     ║
# ╚═══════════════════════════════════════════════════════════════╝
set -euo pipefail

APP_PATH="/Applications/Claude.app"
RESOURCES="$APP_PATH/Contents/Resources"
ASAR_FILE="$RESOURCES/app.asar"
WORK_DIR="/tmp/claudemax-app-patch"
BACKUP_FILE="$RESOURCES/app.asar.claudemax-backup"

GREEN='\033[1;32m'; CYAN='\033[1;36m'; YELLOW='\033[1;33m'
RED='\033[1;31m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${CYAN}▸ $1${RESET}"; }
ok()   { echo -e "${GREEN}✓ $1${RESET}"; }
warn() { echo -e "${YELLOW}⚠ $1${RESET}"; }
err()  { echo -e "${RED}✗ $1${RESET}"; exit 1; }

echo ""
echo -e "${BOLD}${CYAN}▊ CLAUDEMAX — Claude Desktop App Black Theme Patch${RESET}"
echo -e "${CYAN}══════════════════════════════════════════════════${RESET}"
echo ""

# ── Check Claude.app exists ───────────────────────────────────────────────────
[ -d "$APP_PATH" ] || err "Claude.app not found at $APP_PATH — install it first"

# ── Kill Claude if running ────────────────────────────────────────────────────
if pgrep -x "Claude" > /dev/null 2>&1; then
  log "Closing Claude..."
  osascript -e 'tell application "Claude" to quit' 2>/dev/null || killall "Claude" 2>/dev/null || true
  sleep 2
fi

# ── Check for asar vs plain directory ────────────────────────────────────────
if [ -d "$RESOURCES/app" ]; then
  # App is already extracted (no asar) — work directly
  log "App is unpackaged — patching directly..."
  APP_SRC="$RESOURCES/app"
  USE_ASAR=false
elif [ -f "$ASAR_FILE" ]; then
  USE_ASAR=true
  log "Found app.asar — will extract, patch, repack..."

  # Check for asar tool
  ASAR_BIN=""
  if command -v asar &>/dev/null; then
    ASAR_BIN="asar"
  elif npx --yes @electron/asar --version &>/dev/null 2>&1; then
    ASAR_BIN="npx @electron/asar"
  else
    # Try to use the one bundled in the app itself
    BUNDLED_ASAR=$(find "$APP_PATH" -name "asar" -type f 2>/dev/null | head -1)
    if [ -n "$BUNDLED_ASAR" ]; then
      ASAR_BIN="$BUNDLED_ASAR"
    else
      log "Installing @electron/asar via npm..."
      npm install -g @electron/asar 2>/dev/null || \
        sudo npm install -g @electron/asar 2>/dev/null || \
        err "Cannot install asar. Run: npm install -g @electron/asar"
      ASAR_BIN="asar"
    fi
  fi
  ok "asar tool ready: $ASAR_BIN"

  # Backup original
  if [ ! -f "$BACKUP_FILE" ]; then
    log "Backing up original app.asar → app.asar.claudemax-backup"
    cp "$ASAR_FILE" "$BACKUP_FILE"
    ok "Backup created"
  else
    ok "Backup already exists (from previous patch)"
  fi

  # Extract
  rm -rf "$WORK_DIR"
  log "Extracting app.asar..."
  $ASAR_BIN extract "$ASAR_FILE" "$WORK_DIR"
  ok "Extracted to $WORK_DIR"
  APP_SRC="$WORK_DIR"
else
  err "Cannot find app.asar or app/ directory in $RESOURCES"
fi

# ── The pure black CSS to inject ─────────────────────────────────────────────
BLACK_CSS='
/* ════════════════════════════════════════════════════════
   CLAUDEMAX Signature Theme — Pure Black #000000
   Injected by claudemax-jailbreak-desktop.sh
   ════════════════════════════════════════════════════════ */
:root,
:root[data-theme],
:root[class],
html[data-theme="dark"],
html[class*="dark"] {
  --bg-100: #000000 !important;
  --bg-200: #000000 !important;
  --bg-300: #050505 !important;
  --bg-400: #080808 !important;
  --bg-500: #0a0a0a !important;
  --surface-0: #000000 !important;
  --surface-100: #050505 !important;
  --surface-200: #080808 !important;
  --surface-300: #0a0a0a !important;
  --background: #000000 !important;
  --color-bg-primary: #000000 !important;
  --color-bg-secondary: #000000 !important;
  --color-bg-tertiary: #050505 !important;
  --color-surface: #000000 !important;
  --color-surface-raised: #080808 !important;
  --bg-base: #000000 !important;
  --bg-surface: #000000 !important;
  --bg-card: #080808 !important;
  --text-primary: #ffffff !important;
  --text-secondary: #cccccc !important;
  --text-tertiary: #999999 !important;
  --border-color: #111111 !important;
  --divider-color: #111111 !important;
}

html, body, #root, #app, #__next,
[data-theme], [data-theme="dark"],
.dark, [class*="dark-mode"],
[class*="App_"], [class*="Layout_"] {
  background-color: #000000 !important;
  color: #ffffff !important;
}

/* App chrome — window + nav bar */
[class*="titlebar"], [class*="title-bar"],
[class*="nav-bar"], [class*="navbar"],
[class*="app-header"], [class*="AppHeader"],
[class*="TopBar"], [class*="top-bar"],
header, nav {
  background-color: #000000 !important;
  border-bottom-color: #111111 !important;
}

/* Tab bar (Chat / Cowork / Code) */
[class*="tab-bar"], [class*="TabBar"], [class*="tabs"],
[role="tablist"] {
  background-color: #000000 !important;
}
[role="tab"], [class*="tab-item"], [class*="TabItem"] {
  background-color: transparent !important;
}
[role="tab"][aria-selected="true"],
[class*="tab-item"][class*="active"],
[class*="tab--active"] {
  background-color: #111111 !important;
}

/* Sidebar */
[class*="sidebar"], [class*="Sidebar"],
[class*="panel"], [class*="Panel"],
[class*="drawer"], [class*="Drawer"],
aside, [role="complementary"] {
  background-color: #000000 !important;
  border-right-color: #111111 !important;
  border-left-color: #111111 !important;
}

/* Conversation / message list */
[class*="conversation"], [class*="Conversation"],
[class*="message-list"], [class*="MessageList"],
[class*="thread"], [class*="Thread"],
[class*="messages"], [class*="Messages"],
[class*="chat"], [class*="Chat"],
main, [role="main"] {
  background-color: #000000 !important;
}

/* Individual messages */
[class*="message"], [class*="Message"],
[class*="turn"], [class*="Turn"],
[class*="human"], [class*="assistant"] {
  background-color: #000000 !important;
}

/* Input area */
[class*="input-area"], [class*="InputArea"],
[class*="composer"], [class*="Composer"],
[class*="reply"], [class*="Reply"],
[class*="prompt"], [class*="PromptInput"],
[class*="footer"], footer,
[class*="bottom-bar"], [class*="BottomBar"] {
  background-color: #000000 !important;
  border-top-color: #111111 !important;
}

textarea, [contenteditable],
[class*="editor"], [class*="Editor"] {
  background-color: #050505 !important;
  color: #ffffff !important;
  border-color: #222222 !important;
}

/* Code blocks */
pre, code, [class*="code-block"],
[class*="codeblock"], [class*="CodeBlock"],
[class*="syntax"], [class*="Syntax"] {
  background-color: #050505 !important;
  border-color: #111111 !important;
}

/* Cards, modals, dropdowns */
[class*="card"], [class*="Card"],
[class*="modal"], [class*="Modal"],
[class*="popup"], [class*="Popup"],
[class*="popover"], [class*="Popover"],
[class*="dropdown"], [class*="Dropdown"],
[class*="menu"], [class*="Menu"],
[class*="tooltip"], [class*="Tooltip"],
[class*="overlay"], [class*="Overlay"] {
  background-color: #080808 !important;
  border-color: #222222 !important;
  box-shadow: 0 4px 24px rgba(0,0,0,0.9) !important;
}

/* Scrollbars */
::-webkit-scrollbar { width: 5px !important; background: #000 !important; }
::-webkit-scrollbar-track { background: #000 !important; }
::-webkit-scrollbar-thumb { background: #1a1a1a !important; border-radius: 3px !important; }

/* Borders and dividers */
[class*="divider"], [class*="separator"], hr {
  border-color: #111111 !important;
  background-color: #111111 !important;
}

/* Buttons — keep accent colors, only fix background containers */
button[class*="ghost"], button[class*="outline"], button[class*="secondary"],
[class*="btn-ghost"], [class*="btn-outline"] {
  background-color: #080808 !important;
  border-color: #1a1a1a !important;
}

/* Status bar */
[class*="status-bar"], [class*="statusbar"], [class*="StatusBar"],
[class*="bottom-status"] {
  background-color: #000000 !important;
  border-top-color: #111111 !important;
}

/* Text selection */
::selection { background-color: #1a1a1a !important; color: #ffffff !important; }

/* Force all generic bg-gray / bg-neutral classes → black */
[class*="bg-gray"], [class*="bg-neutral"], [class*="bg-slate"],
[class*="bg-zinc"], [class*="bg-stone"] {
  background-color: #000000 !important;
}
'

# ── Find and patch CSS files ──────────────────────────────────────────────────
log "Finding CSS files to patch..."
CSS_COUNT=0
while IFS= read -r -d '' css_file; do
  # Append black CSS to every stylesheet
  echo "$BLACK_CSS" >> "$css_file"
  CSS_COUNT=$((CSS_COUNT + 1))
done < <(find "$APP_SRC" -name "*.css" -type f -print0 2>/dev/null)
ok "Patched $CSS_COUNT CSS file(s)"

# ── Find and patch HTML entry points ─────────────────────────────────────────
log "Finding HTML entry points..."
HTML_COUNT=0
while IFS= read -r -d '' html_file; do
  if grep -q "</head>" "$html_file" 2>/dev/null; then
    # Inject <style> tag before </head>
    STYLE_TAG="<style id=\"claudemax-black\">$(echo "$BLACK_CSS" | tr '\n' ' ')</style>"
    # Use perl for reliable in-place edit (sed -i '' has issues with large content)
    perl -i -0pe "s|</head>|${STYLE_TAG}</head>|g" "$html_file" 2>/dev/null || true
    HTML_COUNT=$((HTML_COUNT + 1))
  fi
done < <(find "$APP_SRC" -name "*.html" -type f -print0 2>/dev/null)
ok "Patched $HTML_COUNT HTML entry point(s)"

# ── Find main JS to inject CSS via document.head ─────────────────────────────
log "Injecting CSS via JS entry point..."
# Find the main/index js (typically largest JS file in root)
MAIN_JS=$(find "$APP_SRC" -maxdepth 3 -name "main.js" -o -name "index.js" -o -name "renderer.js" 2>/dev/null | head -1)
if [ -n "$MAIN_JS" ]; then
  JS_INJECT="
;(function(){
  var s=document.createElement('style');
  s.id='claudemax-black-theme';
  s.textContent=$(cat <<'CSSEOF'
$(echo "$BLACK_CSS")
CSSEOF
);
  if(!document.getElementById('claudemax-black-theme')){
    if(document.head) document.head.appendChild(s);
    else document.addEventListener('DOMContentLoaded',function(){document.head.appendChild(s);});
  }
})();"
  echo "$JS_INJECT" >> "$MAIN_JS"
  ok "Injected via $MAIN_JS"
fi

# ── Repack asar if needed ─────────────────────────────────────────────────────
if [ "$USE_ASAR" = true ]; then
  log "Repacking app.asar..."
  $ASAR_BIN pack "$WORK_DIR" "$ASAR_FILE"
  ok "Repacked app.asar"
  rm -rf "$WORK_DIR"
  ok "Cleaned up temp files"
fi

# ── Remove code signature (required after modifying app bundle) ───────────────
log "Removing code signature (required after patching)..."
codesign --remove-signature "$APP_PATH" 2>/dev/null || true
# Also remove from inner binaries
codesign --remove-signature "$APP_PATH/Contents/MacOS/Claude" 2>/dev/null || true
find "$APP_PATH" -name "*.dylib" -exec codesign --remove-signature {} \; 2>/dev/null || true

# Remove quarantine attributes
xattr -rd com.apple.quarantine "$APP_PATH" 2>/dev/null || true
xattr -dr com.apple.security.app-sandbox "$APP_PATH" 2>/dev/null || true

ok "Code signature handled"

# ── Launch Claude ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}▊ CLAUDEMAX black theme patched into Claude.app${RESET}"
echo -e "${GREEN}══════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${CYAN}Original backup:${RESET} $BACKUP_FILE"
echo -e "  ${CYAN}Re-run this script${RESET} after any Claude app update."
echo -e "  ${CYAN}Restore original:${RESET}"
echo -e "  ${YELLOW}  cp '$BACKUP_FILE' '$ASAR_FILE'${RESET}"
echo ""

log "Launching Claude..."
open "$APP_PATH"
echo -e "${GREEN}✓ Claude launched — it should now render in pure black.${RESET}"
echo ""
