#!/usr/bin/env node
// SessionStart hook — CLAUDEMAX welcome panel + update check
// Runs update-check.sh and shows upgrade banner if needed.
// Always exits 0. Non-blocking.

import { execSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

try {
  const C = '\x1b[36m'; // cyan
  const Y = '\x1b[33m'; // yellow
  const B = '\x1b[1m';  // bold
  const R = '\x1b[0m';  // reset

  // ── Update check ──────────────────────────────────────────────
  let upgradeAvail = false;
  let localVer = '', remoteVer = '';
  try {
    const checkScript = join(homedir(), 'claudemax', 'scripts', 'update-check.sh');
    const result = execSync(`bash "${checkScript}" 2>/dev/null`, { encoding: 'utf8', timeout: 5000 }).trim();
    if (result.startsWith('UPGRADE_AVAILABLE')) {
      const parts = result.split(' ');
      localVer = parts[1] || '?';
      remoteVer = parts[2] || '?';
      upgradeAvail = true;
    }
  } catch (_) { /* non-blocking */ }

  // ── Welcome panel ─────────────────────────────────────────────
  const lines = [
    `${C}╭─ ⚡ CLAUDEMAX ──────────────────────────────────────────╮${R}`,
    `${C}│${R}  Ripple autopilot is active. Just say what you want.    ${C}│${R}`,
    `${C}│${R}                                                         ${C}│${R}`,
    `${C}│  🧭 Ripple${R}        routes every request + enriches prompt ${C}│${R}`,
    `${C}│  👥 Team builder${R}   spins up specialist agents for big   ${C}│${R}`,
    `${C}│${R}                    tasks — you never have to ask         ${C}│${R}`,
    `${C}│  🔒 Safety guard${R}   blocks secrets & bad code silently   ${C}│${R}`,
    `${C}│  📦 60+ agents${R}     researchers, coders, testers ready   ${C}│${R}`,
    `${C}╰─────────────────────────────────────────────────────────╯${R}`,
  ];
  process.stderr.write(lines.join('\n') + '\n');

  // ── Upgrade banner (if needed) ────────────────────────────────
  if (upgradeAvail) {
    const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));
    const banner = [
      '',
      `${Y}${B}  ┌─ CLAUDEMAX UPDATE AVAILABLE ${'─'.repeat(22)}┐${R}`,
      `${Y}  │${R}  Your version : ${C}${pad(localVer, 34)}${Y}│${R}`,
      `${Y}  │${R}  Latest       : ${C}${B}${pad(remoteVer + `${R} (new features + fixes)`, 43)}${Y}│${R}`,
      `${Y}  │${R}                                              ${Y}│${R}`,
      `${Y}  │${R}  ${B}cd ~/claudemax && git pull && bash install.sh${R}  ${Y}│${R}`,
      `${Y}${B}  └${'─'.repeat(50)}┘${R}`,
      '',
    ];
    process.stderr.write(banner.join('\n') + '\n');
  }
} catch (_) {
  // never block the session
}

process.exit(0);
