#!/usr/bin/env node
/**
 * Memory Enrichment Hook — v2
 * Runs on UserPromptSubmit and SessionStart — surfaces relevant past context.
 *
 * Improvements v2:
 * - mtime-based file cache: skips re-parsing if files unchanged
 * - TF-IDF inspired scoring: weights rare keywords higher
 * - Shows which keywords matched for better context
 * - Faster keyword extraction with compiled stopwords Set
 * Non-blocking: exits 0 always.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

const cwd           = process.cwd();
const DATA_DIR      = join(cwd, '.claude-flow', 'data');
const STORE_PATH    = join(DATA_DIR, 'auto-memory-store.json');
const PATTERNS_PATH = join(DATA_DIR, 'learned-patterns.json');
const CACHE_DIR     = join(homedir(), '.claude', 'helpers', '.cache');
const CACHE_FILE    = join(CACHE_DIR, 'enrich-cache.json');

// Ensure dirs exist
try {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(STORE_PATH)) writeFileSync(STORE_PATH, '[]');
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
} catch {}

// Stopwords — fast Set lookup
const STOPWORDS = new Set([
  'the','and','for','are','but','not','you','all','can','had','her','was','one','our',
  'out','day','get','has','him','his','how','its','let','may','now','old','see','two',
  'use','way','who','did','do','go','in','is','it','no','of','on','or','so','to','up',
  'we','be','by','he','me','my','an','as','at','if','la','el','en','un','una','que',
  'los','las','con','por','del','esto','este','eso','ese','para','como','bien','todo',
]);

// Load JSON file with mtime-based cache (avoids re-parsing unchanged files)
function loadCached(filePath) {
  if (!existsSync(filePath)) return [];
  try {
    const mtime = statSync(filePath).mtimeMs;
    let cache = {};
    if (existsSync(CACHE_FILE)) {
      try { cache = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')); } catch {}
    }
    // Cache hit: file unchanged
    if (cache[filePath]?.mtime === mtime && Array.isArray(cache[filePath]?.data)) {
      return cache[filePath].data;
    }
    // Cache miss: read and update cache
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    cache[filePath] = { mtime, data };
    try { writeFileSync(CACHE_FILE, JSON.stringify(cache)); } catch {}
    return Array.isArray(data) ? data : Object.values(data);
  } catch { return []; }
}

async function main() {
  const mode = process.argv[2] || '';

  // ── Session restore mode ─────────────────────────────────────────────────────
  if (mode === 'session-start') {
    try {
      const project  = basename(cwd);
      const patterns = loadCached(PATTERNS_PATH);
      const recent   = patterns.filter(p => p.project === project || !p.project).slice(0, 5);
      if (recent.length > 0) {
        console.log(`\n[AutoMemory] Project: ${project} — Last ${recent.length} tool events restored:`);
        recent.forEach((p, i) => console.log(`  ${i + 1}. ${p.pattern}`));
      }
    } catch {}
    process.exit(0);
  }

  // ── Prompt enrichment mode ───────────────────────────────────────────────────
  try {
    let promptText = '';
    if (!process.stdin.isTTY) {
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString().trim();
      if (raw) {
        try {
          const payload = JSON.parse(raw);
          promptText = payload.prompt || payload.user_prompt || '';
        } catch { promptText = raw; }
      }
    }
    if (!promptText || promptText.length < 5) process.exit(0);

    // Extract keywords — min 3 chars, skip stopwords, deduplicated
    const seen = new Set();
    const keywords = promptText.toLowerCase()
      .split(/[\s\-_.,;:!?()[\]{}"'`/\\]+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length >= 3 && !STOPWORDS.has(w) && !seen.has(w) && seen.add(w))
      .slice(0, 12);

    if (keywords.length === 0) process.exit(0);

    // Build keyword frequency map for TF-IDF-inspired weighting
    // Rare keywords (appear less) are more specific → higher weight
    const allPatterns = loadCached(PATTERNS_PATH);
    const storeData   = loadCached(STORE_PATH);

    // Compute document frequency per keyword
    const totalDocs  = allPatterns.length + storeData.length + 1;
    const docFreq    = {};
    for (const kw of keywords) {
      let df = 0;
      for (const p of allPatterns) {
        const content = ((p.pattern || '') + ' ' + (p.context || '')).toLowerCase();
        if (content.includes(kw)) df++;
      }
      for (const e of storeData) {
        const content = ((e.content || '') + ' ' + (e.value || '')).toLowerCase();
        if (content.includes(kw)) df++;
      }
      docFreq[kw] = df;
    }

    // Score function: TF-IDF inspired — rare keywords score higher
    function scoreEntry(content, matchedKws) {
      return matchedKws.reduce((sum, kw) => {
        const idf = Math.log((totalDocs + 1) / ((docFreq[kw] || 0) + 1));
        return sum + idf;
      }, 0);
    }

    const matches = [];

    // Search learned patterns
    for (const p of allPatterns) {
      if (!p.pattern) continue;
      const content   = ((p.pattern) + ' ' + (p.context || '')).toLowerCase();
      const matched   = keywords.filter(k => content.includes(k));
      if (matched.length === 0) continue;
      const score = scoreEntry(content, matched);
      matches.push({
        score,
        summary:  p.pattern.slice(0, 120),
        matched:  matched.slice(0, 3),
        success:  p.success !== false,
      });
    }

    // Search auto-memory store
    for (const entry of storeData) {
      const content = ((entry.content || '') + ' ' + (entry.value || '') + ' ' + (entry.summary || '')).toLowerCase();
      const matched = keywords.filter(k => content.includes(k));
      if (matched.length === 0) continue;
      const score   = scoreEntry(content, matched);
      const summary = (entry.content || entry.value || '').slice(0, 120);
      if (summary) matches.push({ score, summary, matched: matched.slice(0, 3), success: true });
    }

    // Sort: score desc, prefer successful patterns
    matches.sort((a, b) => (b.score - a.score) || (b.success ? 1 : -1));
    const top = matches.slice(0, 3).filter(m => m.summary);

    if (top.length > 0) {
      console.log(`\n[Memory] ${top.length} relevant pattern(s) from past sessions:`);
      top.forEach((m, i) => {
        const tags = m.matched.length ? ` (${m.matched.join(', ')})` : '';
        console.log(`  ${i + 1}. ${m.summary}${tags}`);
      });
    }
  } catch { /* never block */ }

  process.exit(0);
}

main().catch(() => process.exit(0));
