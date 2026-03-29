#!/usr/bin/env node
/**
 * Vision Layer — CLAUDEMAX 2.0
 * SessionStart hook. Reads ~/.claudemax/vision.md and injects it
 * into Claude's context so every session starts grounded in the big picture.
 *
 * If no vision file exists, shows a one-time setup prompt.
 * Non-blocking: always exits 0.
 */

import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const VISION_PATH = join(homedir(), '.claudemax', 'vision.md');

const C = '\x1b[35m'; // purple
const R = '\x1b[0m';
const D = '\x1b[2m';
const W = 56;
const HR = '─'.repeat(W);

const row = (content) => {
  const visible = content.replace(/\x1b\[[0-9;]*m/g, '');
  const spaces  = Math.max(0, W - 1 - [...visible].length);
  return `${C}│${R} ${content}${' '.repeat(spaces)}${C}│${R}`;
};

try {
  if (!existsSync(VISION_PATH)) {
    // First-time setup prompt — shown to user, not Claude
    const lines = [
      `${C}╭─ ◆ Vision not set ${'─'.repeat(W - 18)}╮${R}`,
      row(''),
      row('No vision file found. Run this to set one up:'),
      row(''),
      row(`${D}  node ~/.claude/helpers/vision-setup.mjs${R}`),
      row(''),
      row('Or create ~/.claudemax/vision.md manually.'),
      row(''),
      `${C}╰${HR}╯${R}`,
    ];
    process.stderr.write('\n' + lines.join('\n') + '\n\n');
    process.exit(0);
  }

  const raw = readFileSync(VISION_PATH, 'utf8').trim();
  if (!raw) process.exit(0);

  // Parse sections from the vision file
  const sections = {};
  let current = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('## ')) {
      current = line.replace('## ', '').trim();
      sections[current] = [];
    } else if (current && line.trim()) {
      sections[current].push(line.trim());
    }
  }

  const thesis  = sections['What We\'re Building']?.[0] || sections['Thesis']?.[0] || '';
  const focus   = sections['This Week\'s Focus']?.[0]  || sections['Weekly Focus']?.[0]  || '';
  const goal    = sections['90-Day Goal']?.[0]          || sections['Goal']?.[0]          || '';
  const bet     = sections['The Bet']?.[0]              || sections['Bet']?.[0]            || '';

  // Visual panel → stderr (user sees context is loaded)
  const lines = [
    `${C}╭─ ◆ Vision ${'─'.repeat(W - 10)}╮${R}`,
  ];
  if (thesis)   lines.push(row(`${thesis}`));
  if (goal)     lines.push(row(`${D}Goal  ${R}${goal}`));
  if (focus)    lines.push(row(`${D}Focus ${R}${focus}`));
  if (bet)      lines.push(row(`${D}Bet   ${R}${bet}`));
  lines.push(row(`${D}update: node ~/.claude/helpers/vision-setup.mjs${R}`));
  lines.push(`${C}╰${HR}╯${R}`);
  process.stderr.write('\n' + lines.join('\n') + '\n\n');

  // Context injection → stdout (Claude reads this as session context)
  process.stdout.write('[VISION CONTEXT — read this, use it to ground your work]\n');
  process.stdout.write(raw + '\n');
  process.stdout.write('[END VISION CONTEXT]\n\n');

} catch (_) {
  // never block the session
}

process.exit(0);
