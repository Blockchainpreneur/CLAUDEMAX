#!/usr/bin/env node
/**
 * Open a new tab in the CLAUDEMAX persistent browser.
 *
 * Usage:
 *   node scripts/browser-tab.mjs <url>                    # open URL in new tab
 *   node scripts/browser-tab.mjs <url> --screenshot out.png  # open + screenshot
 *
 * Connects to the running browser-server. If not running, starts it.
 * Tab is NEVER closed — stays open for the user.
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

const ENDPOINT_FILE = '/tmp/claudemax-browser.endpoint';
const url = process.argv[2];
const screenshotIdx = process.argv.indexOf('--screenshot');
const screenshotPath = screenshotIdx > -1 ? process.argv[screenshotIdx + 1] : null;

if (!url) {
  console.error('Usage: node browser-tab.mjs <url> [--screenshot file.png]');
  process.exit(1);
}

// Start server if not running
if (!existsSync(ENDPOINT_FILE)) {
  const serverScript = join(homedir(), 'claudemax', 'scripts', 'browser-server.mjs');
  console.log('Starting browser server...');
  execSync(`node "${serverScript}" &`, { stdio: 'ignore', shell: true });
  // Wait for endpoint file
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (existsSync(ENDPOINT_FILE)) break;
  }
  if (!existsSync(ENDPOINT_FILE)) {
    console.error('Failed to start browser server.');
    process.exit(1);
  }
}

const wsEndpoint = readFileSync(ENDPOINT_FILE, 'utf8').trim();

try {
  const browser = await chromium.connect(wsEndpoint);
  const contexts = browser.contexts();
  // Use existing context or create one
  const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
  // Always open a new tab (page) — never reuse, never close
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

  console.log(`Tab opened: ${url}`);
  console.log(`Title: ${await page.title()}`);

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Screenshot: ${screenshotPath}`);
  }

  // DO NOT close the page — it stays open for the user
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

process.exit(0);
