#!/usr/bin/env node
/**
 * SessionStart — CLAUDEMAX welcome + update check + memory load
 *
 * 1. Shows welcome panel
 * 2. Checks for updates (blocking, like gstack)
 * 3. Loads session memory from ~/.claudemax/memory/
 * 4. Outputs memory context to stdout so Claude reads it
 *
 * Always exits 0. Non-blocking on failure.
 */
import { execSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, readdirSync, readFileSync, mkdirSync } from 'fs';

const HOME = homedir();
const MEMORY_DIR = join(HOME, '.claudemax', 'memory');
const LEARNINGS_DIR = join(HOME, '.claudemax', 'learnings');

try {
  const C = '\x1b[36m', Y = '\x1b[33m', B = '\x1b[1m', R = '\x1b[0m', D = '\x1b[2m';

  // ── Update check ──────────────────────────────────────────────
  let upgradeAvail = false;
  let localVer = '', remoteVer = '';
  try {
    const checkScript = join(HOME, 'claudemax', 'scripts', 'update-check.sh');
    const result = execSync(`bash "${checkScript}" 2>/dev/null`, { encoding: 'utf8', timeout: 5000 }).trim();
    if (result.startsWith('UPGRADE_AVAILABLE')) {
      const parts = result.split(' ');
      localVer = parts[1] || '?';
      remoteVer = parts[2] || '?';
      upgradeAvail = true;
    }
  } catch (_) {}

  // ── Load memory ───────────────────────────────────────────────
  mkdirSync(MEMORY_DIR, { recursive: true });
  mkdirSync(LEARNINGS_DIR, { recursive: true });

  let memoryItems = [];
  let learningItems = [];

  try {
    if (existsSync(MEMORY_DIR)) {
      const files = readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json')).sort().slice(-20);
      for (const f of files) {
        try {
          const data = JSON.parse(readFileSync(join(MEMORY_DIR, f), 'utf8'));
          memoryItems.push(data);
        } catch {}
      }
    }
  } catch {}

  try {
    if (existsSync(LEARNINGS_DIR)) {
      const files = readdirSync(LEARNINGS_DIR).filter(f => f.endsWith('.json')).sort().slice(-10);
      for (const f of files) {
        try {
          const data = JSON.parse(readFileSync(join(LEARNINGS_DIR, f), 'utf8'));
          learningItems.push(data);
        } catch {}
      }
    }
  } catch {}

  // ── Welcome panel ─────────────────────────────────────────────
  const memCount = memoryItems.length;
  const learnCount = learningItems.length;
  const lines = [
    `${C}╭─ ⚡ CLAUDEMAX ──────────────────────────────────────────╮${R}`,
    `${C}│${R}  Ripple autopilot is active. Just say what you want.    ${C}│${R}`,
    `${C}│${R}                                                         ${C}│${R}`,
    `${C}│  🧭 Ripple${R}        routes + enriches every request        ${C}│${R}`,
    `${C}│  🧠 Memory${R}        ${memCount} memories, ${learnCount} learnings loaded        ${C}│${R}`,
    `${C}│  🔒 Safety${R}        PII redactor + code quality gate       ${C}│${R}`,
    `${C}│  ⚡ CLI-first${R}     codex, gws, firecrawl, playwright     ${C}│${R}`,
    `${C}╰─────────────────────────────────────────────────────────╯${R}`,
  ];
  process.stderr.write(lines.join('\n') + '\n');

  // ── Upgrade banner ────────────────────────────────────────────
  if (upgradeAvail) {
    const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));
    process.stderr.write([
      '', `${Y}${B}  ┌─ CLAUDEMAX UPDATE AVAILABLE ${'─'.repeat(22)}┐${R}`,
      `${Y}  │${R}  You: ${C}${pad(localVer, 40)}${Y}│${R}`,
      `${Y}  │${R}  New: ${C}${B}${pad(remoteVer, 40)}${Y}│${R}`,
      `${Y}  │${R}  ${B}cd ~/claudemax && git pull && bash install.sh${R}  ${Y}│${R}`,
      `${Y}${B}  └${'─'.repeat(50)}┘${R}`, '',
    ].join('\n') + '\n');
  }

  // ── Output memory to stdout (Claude reads this) ───────────────
  if (memoryItems.length > 0 || learningItems.length > 0) {
    const memoryBlock = [];
    memoryBlock.push('[CLAUDEMAX MEMORY]');

    if (memoryItems.length > 0) {
      memoryBlock.push('Recent session context:');
      for (const m of memoryItems.slice(-5)) {
        memoryBlock.push(`- [${m.ts || '?'}] ${m.type || 'note'}: ${m.content || m.decision || m.summary || JSON.stringify(m).slice(0, 150)}`);
      }
    }

    if (learningItems.length > 0) {
      memoryBlock.push('Learned patterns:');
      for (const l of learningItems.slice(-5)) {
        memoryBlock.push(`- ${l.pattern || l.key || '?'}: ${l.strategy || l.insight || l.result || '?'} (confidence: ${l.confidence || '?'})`);
      }
    }

    memoryBlock.push('[/CLAUDEMAX MEMORY]');
    process.stdout.write(memoryBlock.join('\n') + '\n');
  }

} catch (_) {}

process.exit(0);
