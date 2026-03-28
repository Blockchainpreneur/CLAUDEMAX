#!/bin/bash
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  CLAUDEMAX — Claude Desktop App Black Theme (Electron Jailbreak) ║
# ║  Patches the Electron MAIN PROCESS to inject CSS via             ║
# ║  webContents.insertCSS() — works even when app loads claude.ai   ║
# ╚═══════════════════════════════════════════════════════════════════╝
set -euo pipefail

APP_PATH="/Applications/Claude.app"
RESOURCES="$APP_PATH/Contents/Resources"
ASAR_FILE="$RESOURCES/app.asar"
WORK_DIR="/tmp/claudemax-app-patch-v2"
BACKUP_FILE="$RESOURCES/app.asar.claudemax-backup"

GREEN='\033[1;32m'; CYAN='\033[1;36m'; YELLOW='\033[1;33m'
RED='\033[1;31m'; BOLD='\033[1m'; RESET='\033[0m'
log()  { echo -e "${CYAN}▸ $1${RESET}"; }
ok()   { echo -e "${GREEN}✓ $1${RESET}"; }
warn() { echo -e "${YELLOW}⚠ $1${RESET}"; }
err()  { echo -e "${RED}✗ $1${RESET}"; exit 1; }

echo ""
echo -e "${BOLD}${CYAN}▊ CLAUDEMAX — Electron Main Process CSS Injection${RESET}"
echo -e "${CYAN}═══════════════════════════════════════════════════${RESET}"
echo ""

# ── Prereqs ───────────────────────────────────────────────────────────────────
[ -d "$APP_PATH" ] || err "Claude.app not found at $APP_PATH"

# ── Kill Claude ───────────────────────────────────────────────────────────────
if pgrep -x "Claude" > /dev/null 2>&1; then
  log "Closing Claude..."
  osascript -e 'tell application "Claude" to quit' 2>/dev/null || killall "Claude" 2>/dev/null || true
  sleep 3
fi

# ── Locate / install asar tool ────────────────────────────────────────────────
if command -v asar &>/dev/null; then
  ASAR_BIN="asar"
elif command -v npx &>/dev/null; then
  ASAR_BIN="npx --yes @electron/asar"
else
  err "npx not found. Install Node.js: https://nodejs.org"
fi
log "asar tool: $ASAR_BIN"

# ── Backup ────────────────────────────────────────────────────────────────────
[ -f "$ASAR_FILE" ] || err "Cannot find $ASAR_FILE — is Claude installed?"

if [ ! -f "$BACKUP_FILE" ]; then
  log "Backing up original asar..."
  cp "$ASAR_FILE" "$BACKUP_FILE"
  ok "Backup: $BACKUP_FILE"
else
  ok "Backup already exists"
fi

# ── Extract ───────────────────────────────────────────────────────────────────
rm -rf "$WORK_DIR"
log "Extracting app.asar..."
$ASAR_BIN extract "$ASAR_FILE" "$WORK_DIR"
ok "Extracted to $WORK_DIR"

# ── Find main process entry point ─────────────────────────────────────────────
log "Locating Electron main process entry..."
# Read package.json to find the 'main' field
MAIN_JS=""
PKG_JSON="$WORK_DIR/package.json"
if [ -f "$PKG_JSON" ]; then
  MAIN_FIELD=$(node -e "try{const p=require('$PKG_JSON');console.log(p.main||'')}catch(e){}" 2>/dev/null || echo "")
  if [ -n "$MAIN_FIELD" ]; then
    CANDIDATE="$WORK_DIR/$MAIN_FIELD"
    [ -f "$CANDIDATE" ] && MAIN_JS="$CANDIDATE"
  fi
fi

# Fallback: common locations
if [ -z "$MAIN_JS" ]; then
  for candidate in \
    "$WORK_DIR/main.js" \
    "$WORK_DIR/out/main.js" \
    "$WORK_DIR/dist/main.js" \
    "$WORK_DIR/build/main.js" \
    "$WORK_DIR/.webpack/main/index.js" \
    "$WORK_DIR/app/main.js" \
    "$WORK_DIR/electron/main.js" \
    "$WORK_DIR/src/main.js"
  do
    if [ -f "$candidate" ]; then
      MAIN_JS="$candidate"
      break
    fi
  done
fi

# Last resort: largest JS file not in node_modules
if [ -z "$MAIN_JS" ]; then
  MAIN_JS=$(find "$WORK_DIR" -name "*.js" -not -path "*/node_modules/*" \
    -not -name "*.min.js" -type f -exec wc -c {} + 2>/dev/null \
    | sort -rn | awk '{print $2}' | head -1)
fi

[ -n "$MAIN_JS" ] && [ -f "$MAIN_JS" ] || err "Cannot find main.js — try manually: ls $WORK_DIR"
ok "Main process: $MAIN_JS"

# ── Build the CSS string (compact, no heredoc issues) ─────────────────────────
BLACK_CSS='html,body,#root,#app,#__next,[data-theme],[data-theme="dark"],.dark{background-color:#000!important;color:#fff!important}:root{--bg-100:#000!important;--bg-200:#000!important;--bg-300:#050505!important;--bg-400:#080808!important;--surface-0:#000!important;--surface-100:#050505!important;--surface-200:#080808!important;--background:#000!important;--color-bg-primary:#000!important;--color-bg-secondary:#000!important;--color-bg-tertiary:#050505!important;--color-surface:#000!important;--bg-base:#000!important;--text-primary:#fff!important;--text-secondary:#ccc!important;--border-color:#111!important}[class*="titlebar"],[class*="title-bar"],[class*="nav-bar"],[class*="navbar"],[class*="TopBar"],[class*="top-bar"],header,nav{background-color:#000!important;border-bottom-color:#111!important}[class*="tab-bar"],[class*="TabBar"],[role="tablist"]{background-color:#000!important}[role="tab"],[class*="tab-item"]{background-color:transparent!important}[role="tab"][aria-selected="true"],[class*="tab--active"],[class*="tab-item"][class*="active"]{background-color:#111!important}[class*="sidebar"],[class*="Sidebar"],aside,[role="complementary"]{background-color:#000!important;border-right-color:#111!important}[class*="conversation"],[class*="message-list"],[class*="thread"],[class*="chat"],main,[role="main"]{background-color:#000!important}[class*="message"],[class*="turn"],[class*="human"],[class*="assistant"]{background-color:#000!important}[class*="input-area"],[class*="composer"],[class*="reply"],[class*="prompt"],[class*="footer"],[class*="bottom-bar"],footer{background-color:#000!important;border-top-color:#111!important}textarea,[contenteditable],[class*="editor"]{background-color:#050505!important;color:#fff!important;border-color:#222!important}pre,code,[class*="code-block"],[class*="CodeBlock"]{background-color:#050505!important;border-color:#111!important}[class*="card"],[class*="modal"],[class*="popup"],[class*="popover"],[class*="dropdown"],[class*="menu"],[class*="tooltip"],[class*="overlay"]{background-color:#080808!important;border-color:#222!important;box-shadow:0 4px 24px rgba(0,0,0,.9)!important}::-webkit-scrollbar{width:5px!important;background:#000!important}::-webkit-scrollbar-track{background:#000!important}::-webkit-scrollbar-thumb{background:#1a1a1a!important;border-radius:3px!important}[class*="bg-gray"],[class*="bg-neutral"],[class*="bg-slate"],[class*="bg-zinc"]{background-color:#000!important}::selection{background-color:#1a1a1a!important;color:#fff!important}'

# ── Build injection code ───────────────────────────────────────────────────────
# This appends to main.js and hooks into ALL BrowserWindow instances,
# including windows that load remote URLs (like claude.ai)
INJECTION=$(cat << 'INJECT_EOF'

// ═══════════════════════════════════════════════════════════════
// CLAUDEMAX Pure Black Theme — injected by jailbreak script
// Uses Electron webContents.insertCSS() — works for remote URLs
// ═══════════════════════════════════════════════════════════════
INJECT_EOF
)

cat >> "$MAIN_JS" << JSEOF

// CLAUDEMAX Black Theme Injection (appended by claudemax-jailbreak-desktop.sh)
;(function claudemaxBlackTheme() {
  try {
    var _electron = require('electron');
    var _app = _electron.app || (process.type === 'browser' ? _electron.app : null);
    var _BrowserWindow = _electron.BrowserWindow;
    var _session = _electron.session;

    // The full CLAUDEMAX pure black CSS
    var _css = '${BLACK_CSS}';

    // Inject into a single webContents instance
    function _inject(wc) {
      if (!wc || wc.isDestroyed()) return;
      var doIt = function() {
        if (!wc.isDestroyed()) {
          wc.insertCSS(_css, { cssOrigin: 'user' }).catch(function(){});
        }
      };
      // Fire on every navigation and load event
      wc.on('did-finish-load',         doIt);
      wc.on('did-navigate',            doIt);
      wc.on('did-navigate-in-page',    doIt);
      wc.on('did-frame-finish-load',   doIt);
      wc.on('dom-ready',               doIt);
      // Try immediately if already loaded
      if (!wc.isLoading()) { try { doIt(); } catch(e) {} }
    }

    // Inject into a BrowserWindow
    function _injectWin(win) {
      if (!win || !win.webContents) return;
      _inject(win.webContents);
      // Also handle any child views / webviews
      win.webContents.on('will-attach-webview', function(_, prefs) {
        win.webContents.on('did-attach-webview', function(_, wc) { _inject(wc); });
      });
    }

    // Hook all existing windows (in case app is already ready)
    if (_BrowserWindow) {
      try { _BrowserWindow.getAllWindows().forEach(_injectWin); } catch(e) {}
    }

    // Hook all future windows — works when appended before app ready AND after
    if (_app) {
      _app.on('browser-window-created', function(_, win) { _injectWin(win); });
      _app.whenReady && _app.whenReady().then(function() {
        if (_BrowserWindow) {
          _BrowserWindow.getAllWindows().forEach(_injectWin);
        }
        // Also use session-level CSS injection as fallback
        if (_session && _session.defaultSession) {
          _session.defaultSession.webContents && _session.defaultSession.webContents.forEach
            ? _session.defaultSession.webContents.forEach(function(wc){ _inject(wc); })
            : null;
        }
      }).catch(function(){});
    }

    // Process-level fallback: hook require('electron').BrowserWindow constructor
    try {
      var _origBW = _electron.BrowserWindow;
      if (_origBW && _origBW.prototype) {
        var _origShow = _origBW.prototype.show;
        _origBW.prototype.show = function() {
          _injectWin(this);
          return _origShow.apply(this, arguments);
        };
      }
    } catch(e) {}

  } catch(e) {
    // Silent fail — never break the app
  }
})();
JSEOF

ok "Injected CSS into main process: $MAIN_JS"

# ── Repack ────────────────────────────────────────────────────────────────────
log "Repacking app.asar..."
$ASAR_BIN pack "$WORK_DIR" "$ASAR_FILE"
ok "Repacked"
rm -rf "$WORK_DIR"

# ── Remove code signature ─────────────────────────────────────────────────────
log "Removing code signature..."
codesign --remove-signature "$APP_PATH" 2>/dev/null || true
codesign --remove-signature "$APP_PATH/Contents/MacOS/Claude" 2>/dev/null || true
find "$APP_PATH/Contents/Frameworks" -name "*.dylib" \
  -exec codesign --remove-signature {} \; 2>/dev/null || true
find "$APP_PATH/Contents/Frameworks" -name "*.framework" \
  -exec codesign --remove-signature {} \; 2>/dev/null || true
xattr -rd com.apple.quarantine "$APP_PATH" 2>/dev/null || true

ok "Code signature removed"

# ── Verify the patch was written ──────────────────────────────────────────────
PATCHED_MAIN=$($ASAR_BIN extract-file "$ASAR_FILE" "$(basename $MAIN_JS)" 2>/dev/null | wc -c || echo 0)
log "Verifying patch in repacked asar..."
# Re-extract and check
VERIFY_DIR="/tmp/claudemax-verify"
rm -rf "$VERIFY_DIR"
$ASAR_BIN extract "$ASAR_FILE" "$VERIFY_DIR" 2>/dev/null
VERIFY_FILE="${VERIFY_DIR}/$(realpath --relative-to=$WORK_DIR $MAIN_JS 2>/dev/null || basename $MAIN_JS)"
if grep -q "claudemaxBlackTheme" "$VERIFY_FILE" 2>/dev/null || \
   find "$VERIFY_DIR" -name "*.js" -exec grep -l "claudemaxBlackTheme" {} \; 2>/dev/null | grep -q .; then
  ok "Patch verified in repacked asar"
else
  warn "Could not verify patch in asar — check manually"
fi
rm -rf "$VERIFY_DIR"

# ── Launch Claude ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}▊ Done — launching Claude with pure black theme${RESET}"
echo -e "${GREEN}═══════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${CYAN}Backup:${RESET}  $BACKUP_FILE"
echo -e "  ${CYAN}Restore:${RESET} cp '$BACKUP_FILE' '$ASAR_FILE'"
echo -e "  ${YELLOW}Re-run after every Claude app update.${RESET}"
echo ""

open "$APP_PATH"
echo -e "${GREEN}✓ Claude launched.${RESET}"
echo ""
