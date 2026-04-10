#!/usr/bin/env node
/**
 * CLAUDEMAX Prompt Engine — FULLY AUTOMATED
 *
 * Runs on every prompt via Ripple. Three auto-actions:
 * 1. Retrieves relevant memory (LightRAG-style search)
 * 2. Auto-calls NotebookLM for research/synthesis prompts (background, cached)
 * 3. Structures prompt with anti-laziness + quality gates
 *
 * All non-blocking. Max 3s total. Cached results are instant.
 */
import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const HOME = homedir();
const MEMORY_DIR = join(HOME, '.claudemax', 'memory');
const LEARNINGS_DIR = join(HOME, '.claudemax', 'learnings');
const NLM_CACHE = join(HOME, '.claudemax', 'nlm-cache');
const NLM_BIN = '/Library/Frameworks/Python.framework/Versions/3.12/bin/notebooklm';
const NLM_BRIDGE = join(HOME, 'claudemax', 'helpers', 'notebooklm-bridge.mjs');
const NB_ID_FILE = join(HOME, '.claudemax', 'nlm-notebook-id');

mkdirSync(MEMORY_DIR, { recursive: true });
mkdirSync(LEARNINGS_DIR, { recursive: true });
mkdirSync(NLM_CACHE, { recursive: true });

// ── Read prompt ─────────────────────────────────────────────────
let prompt = '';
try {
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString().trim();
    if (raw) {
      try { const p = JSON.parse(raw); prompt = p.prompt || p.user_prompt || raw; }
      catch { prompt = raw; }
    }
  }
} catch {}
if (!prompt) prompt = process.argv[2] || '';
if (!prompt || prompt.length < 5) process.exit(0);

const promptLower = prompt.toLowerCase();

// ── 1. AUTO: Memory retrieval ───────────────────────────────────
let memoryContext = '';
try {
  const memFiles = existsSync(MEMORY_DIR)
    ? readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort().slice(-20)
    : [];

  // Check compressed summary first (most efficient)
  const summaryFile = join(MEMORY_DIR, '_compressed-summary.json');
  if (existsSync(summaryFile)) {
    try {
      const summary = JSON.parse(readFileSync(summaryFile, 'utf8'));
      if (summary.content) memoryContext = '[Session briefing]: ' + summary.content.slice(0, 300);
    } catch {}
  }

  // Then search for relevant entries
  const words = promptLower.split(/\s+/).filter(w => w.length > 3);
  if (words.length > 0) {
    const relevant = [];
    for (const f of memFiles.slice(-10)) {
      try {
        const data = JSON.parse(readFileSync(join(MEMORY_DIR, f), 'utf8'));
        const content = JSON.stringify(data).toLowerCase();
        const matches = words.filter(w => content.includes(w)).length;
        if (matches >= 2) relevant.push({ ...data, relevance: matches });
      } catch {}
    }
    relevant.sort((a, b) => b.relevance - a.relevance);
    if (relevant.length > 0) {
      memoryContext += '\n' + relevant.slice(0, 2)
        .map(m => `[${m.ts?.slice(0, 10) || '?'}] ${m.content || m.summary || ''}`)
        .join('\n');
    }
  }

  // Check learnings for matching strategies
  const learnFiles = existsSync(LEARNINGS_DIR) ? readdirSync(LEARNINGS_DIR).filter(f => f.endsWith('.json')) : [];
  for (const f of learnFiles) {
    try {
      const data = JSON.parse(readFileSync(join(LEARNINGS_DIR, f), 'utf8'));
      if (data.type === 'success' && data.strategy) {
        if (promptLower.includes(data.task) || promptLower.includes(data.tool)) {
          memoryContext += `\n[Learned]: ${data.strategy} (confidence: ${data.confidence}/10)`;
        }
      }
    } catch {}
  }
} catch {}

// ── 2. AUTO: NotebookLM delegation ──────────────────────────────
// Research/synthesis/analysis prompts auto-call NLM in background
// Results cached for 1hr. Cached results injected immediately.
let nlmResult = '';
try {
  const isResearch = /\b(research|find out|search for|compare|analyze|what is|how does|competitive|market|trends|best practices)\b/i.test(prompt);
  const isDocAnalysis = /\b(summarize|analyze this|review this|what does this say|read this)\b/i.test(prompt);
  const isSynthesis = /\b(explain|why|how to|what are the|give me|list the|describe)\b/i.test(prompt);

  if (isResearch || isDocAnalysis || isSynthesis) {
    const cacheKey = prompt.replace(/[^a-z0-9]/gi, '-').slice(0, 50);
    const cacheFile = join(NLM_CACHE, `${cacheKey}.txt`);

    // Check cache (1hr TTL)
    if (existsSync(cacheFile)) {
      const age = Date.now() - statSync(cacheFile).mtimeMs;
      if (age < 3600000) {
        nlmResult = readFileSync(cacheFile, 'utf8').trim();
      }
    }

    // If no cache hit, spawn NLM in background (non-blocking)
    if (!nlmResult && existsSync(NB_ID_FILE)) {
      const nbId = readFileSync(NB_ID_FILE, 'utf8').trim().slice(0, 8);
      // Fire and forget — result will be cached for next time
      try {
        const child = spawn(NLM_BIN, ['ask', prompt.slice(0, 200)], {
          detached: true,
          stdio: ['ignore', 'pipe', 'ignore'],
          env: { ...process.env, PATH: `/Library/Frameworks/Python.framework/Versions/3.12/bin:${process.env.PATH}` },
          timeout: 25000,
        });
        // Capture output and cache it
        let output = '';
        child.stdout.on('data', d => { output += d.toString(); });
        child.on('close', () => {
          const answer = output.split('Answer:').pop()?.trim() || output.trim();
          if (answer.length > 20) {
            try { writeFileSync(cacheFile, answer); } catch {}
          }
        });
        child.unref();
      } catch {}
    }

    // If we have cached result, inject it
    if (nlmResult) {
      memoryContext += `\n[NotebookLM]: ${nlmResult.slice(0, 500)}`;
    }
  }
} catch {}

// ── 3. AUTO: Prompt structuring ─────────────────────────────────
let structuredPrompt = prompt;
try {
  const patterns = [
    { test: /^(fix|update|change|modify)\s/i, add: 'Read the code first. Show root cause before patching. Write regression test.' },
    { test: /^(build|create|make|add)\s/i, add: 'Include: input validation, error states, loading states, edge cases, tests.' },
    { test: /^(check|review|look at)\s/i, add: 'Read every file involved. List findings with file:line references.' },
    { test: /^(deploy|ship|push)\s/i, add: 'Pre-deploy: tests, diff review, secrets check. Post-deploy: canary.' },
    { test: /^(test|qa|verify)\s/i, add: 'Test: happy path, error paths, edge cases, mobile. Show evidence.' },
    { test: /^(research|find|search)\s/i, add: 'Multiple sources. Verify claims. Note conflicts. Cite sources.' },
    { test: /^(design|ui|ux)\s/i, add: 'Mobile-first. Dark mode. Loading/empty/error states. WCAG 2.1.' },
  ];

  for (const p of patterns) {
    if (p.test.test(prompt)) {
      structuredPrompt += `\n[anti-laziness]: ${p.add}`;
      break;
    }
  }

  if (memoryContext) structuredPrompt += `\n[past context]:\n${memoryContext}`;
  structuredPrompt += '\n[quality]: Do the COMPLETE thing. Verify claims. Show evidence.';
} catch {}

// ── 4. AUTO: Save prompt to memory ──────────────────────────────
try {
  const ts = new Date().toISOString();
  writeFileSync(
    join(MEMORY_DIR, `${ts.slice(0, 10)}-${ts.slice(11, 19).replace(/:/g, '')}-prompt.json`),
    JSON.stringify({ ts, type: 'prompt', content: prompt.slice(0, 300), cwd: process.cwd() })
  );
} catch {}

// ── Output ──────────────────────────────────────────────────────
if (structuredPrompt !== prompt) {
  process.stdout.write(`[CLAUDEMAX PROMPT-ENGINE]\n${structuredPrompt}\n[/CLAUDEMAX PROMPT-ENGINE]\n`);
}

process.exit(0);
