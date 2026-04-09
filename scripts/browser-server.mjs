#!/usr/bin/env node
/**
 * CLAUDEMAX Persistent Browser Server
 *
 * Starts a single headed Chromium that stays open.
 * All Playwright tasks connect to it and open new TABS (not windows).
 * Tabs are NEVER closed — user closes them manually.
 *
 * Usage:
 *   node scripts/browser-server.mjs          # start server
 *   node scripts/browser-server.mjs --stop   # stop server
 *   node scripts/browser-server.mjs --status # check if running
 *
 * Other scripts connect via:
 *   PW_ENDPOINT=$(cat /tmp/claudemax-browser.endpoint)
 *   npx playwright test  (reads PW_ENDPOINT from env)
 */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';

const ENDPOINT_FILE = '/tmp/claudemax-browser.endpoint';
const PID_FILE = '/tmp/claudemax-browser.pid';

// ── Stop command ──────────────────────────────────────────────
if (process.argv.includes('--stop')) {
  if (existsSync(PID_FILE)) {
    const pid = readFileSync(PID_FILE, 'utf8').trim();
    try { process.kill(parseInt(pid)); } catch {}
    try { unlinkSync(PID_FILE); } catch {}
    try { unlinkSync(ENDPOINT_FILE); } catch {}
    console.log('Browser server stopped.');
  } else {
    console.log('No browser server running.');
  }
  process.exit(0);
}

// ── Status command ────────────────────────────────────────────
if (process.argv.includes('--status')) {
  if (existsSync(ENDPOINT_FILE)) {
    const ep = readFileSync(ENDPOINT_FILE, 'utf8').trim();
    console.log(`Running: ${ep}`);
  } else {
    console.log('Not running.');
  }
  process.exit(0);
}

// ── Already running? ──────────────────────────────────────────
if (existsSync(PID_FILE)) {
  const oldPid = parseInt(readFileSync(PID_FILE, 'utf8').trim());
  try {
    process.kill(oldPid, 0); // check if alive
    const ep = existsSync(ENDPOINT_FILE) ? readFileSync(ENDPOINT_FILE, 'utf8').trim() : '?';
    console.log(`Already running (PID ${oldPid}): ${ep}`);
    process.exit(0);
  } catch {
    // Dead process, clean up
    try { unlinkSync(PID_FILE); } catch {}
    try { unlinkSync(ENDPOINT_FILE); } catch {}
  }
}

// ── Launch persistent browser ─────────────────────────────────
console.log('Starting CLAUDEMAX browser server...');

const browserServer = await chromium.launchServer({
  headless: false,
  args: [
    '--disable-blink-features=AutomationControlled',
    '--no-first-run',
    '--no-default-browser-check',
    '--start-maximized',
  ],
});

const wsEndpoint = browserServer.wsEndpoint();
writeFileSync(ENDPOINT_FILE, wsEndpoint);
writeFileSync(PID_FILE, String(process.pid));

console.log(`Browser server ready: ${wsEndpoint}`);
console.log(`PID: ${process.pid}`);
console.log('All Playwright tasks will open as tabs in this window.');
console.log('Tabs are NEVER closed — close them manually when done.');

// Keep alive — clean up on exit
const cleanup = () => {
  try { unlinkSync(ENDPOINT_FILE); } catch {}
  try { unlinkSync(PID_FILE); } catch {}
};
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('exit', cleanup);

// Prevent exit — keep browser alive until killed
await new Promise(() => {});
