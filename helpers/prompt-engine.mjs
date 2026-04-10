#!/usr/bin/env node
/**
 * CLAUDEMAX Prompt Engine — NotebookLM + LightRAG Integration
 *
 * Called by Ripple before Claude processes a prompt.
 * Two jobs:
 *   1. Send prompt to NotebookLM for structuring + research enrichment
 *   2. Query LightRAG for relevant past decisions/memory
 *
 * Returns enriched prompt + memory context via stdout.
 *
 * Usage:
 *   echo "fix the login bug" | node prompt-engine.mjs
 *   node prompt-engine.mjs "fix the login bug"
 *
 * Architecture:
 *   User prompt → prompt-engine.mjs
 *     → NotebookLM: structure, research, anti-laziness enrichment
 *     → LightRAG: retrieve relevant past decisions
 *     → stdout: [CLAUDEMAX ENRICHED] block for Claude
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const HOME = homedir();
const MEMORY_DIR = join(HOME, '.claudemax', 'memory');
const LEARNINGS_DIR = join(HOME, '.claudemax', 'learnings');
const CACHE_DIR = join(HOME, '.claudemax', 'prompt-cache');

mkdirSync(MEMORY_DIR, { recursive: true });
mkdirSync(LEARNINGS_DIR, { recursive: true });
mkdirSync(CACHE_DIR, { recursive: true });

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

// ── 1. LightRAG: Retrieve relevant past context ────────────────
let memoryContext = '';
try {
  // Search memory files for relevant entries
  const memFiles = existsSync(MEMORY_DIR)
    ? readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json')).sort().slice(-20)
    : [];

  const relevantMemories = [];
  const promptLower = prompt.toLowerCase();

  for (const f of memFiles) {
    try {
      const data = JSON.parse(readFileSync(join(MEMORY_DIR, f), 'utf8'));
      const content = JSON.stringify(data).toLowerCase();
      // Simple relevance: check if any word from the prompt appears in the memory
      const words = promptLower.split(/\s+/).filter(w => w.length > 3);
      const matches = words.filter(w => content.includes(w)).length;
      if (matches > 0) {
        relevantMemories.push({ ...data, relevance: matches / words.length });
      }
    } catch {}
  }

  // Sort by relevance and take top 3
  relevantMemories.sort((a, b) => b.relevance - a.relevance);
  if (relevantMemories.length > 0) {
    memoryContext = relevantMemories.slice(0, 3)
      .map(m => `[${m.ts?.slice(0, 10) || '?'}] ${m.type || 'context'}: ${m.content || m.summary || ''}`)
      .join('\n');
  }

  // Also check learnings
  const learnFiles = existsSync(LEARNINGS_DIR)
    ? readdirSync(LEARNINGS_DIR).filter(f => f.endsWith('.json'))
    : [];

  for (const f of learnFiles) {
    try {
      const data = JSON.parse(readFileSync(join(LEARNINGS_DIR, f), 'utf8'));
      if (data.type === 'success' && data.strategy) {
        const taskMatch = promptLower.includes(data.task) || promptLower.includes(data.tool);
        if (taskMatch) {
          memoryContext += `\nLearned strategy: ${data.strategy} (confidence: ${data.confidence}/10)`;
        }
      }
    } catch {}
  }
} catch {}

// ── 2. Prompt Structuring (NotebookLM-style) ───────────────────
// Instead of calling NotebookLM API (requires auth), we apply the
// same structuring principles locally:
//   - Break vague prompts into specific sub-tasks
//   - Add missing context from memory
//   - Force precision to prevent lazy Claude responses
//   - Add verification requirements

let structuredPrompt = prompt;

try {
  // Detect vague/lazy-prone prompts and add structure
  const vaguePatterns = [
    { test: /^(fix|update|change|modify)\s/i, add: 'Specify: what exactly is broken? Read the relevant code first. Show the root cause before patching.' },
    { test: /^(build|create|make|add)\s/i, add: 'Requirements: include input validation, error states, loading states, edge cases. Write tests.' },
    { test: /^(check|review|look at)\s/i, add: 'Be thorough: read every file involved. List specific findings with file:line references.' },
    { test: /^(deploy|ship|push)\s/i, add: 'Pre-deploy: run tests, review diff, check for secrets, verify build. Post-deploy: canary check.' },
    { test: /^(test|qa|verify)\s/i, add: 'Test systematically: happy path, error paths, edge cases, mobile. Provide evidence for each.' },
    { test: /^(research|find|search)\s/i, add: 'Use multiple sources. Verify claims. Note conflicting evidence. Cite sources.' },
  ];

  for (const p of vaguePatterns) {
    if (p.test.test(prompt)) {
      structuredPrompt += `\n\n[PROMPT ENGINE — anti-laziness]: ${p.add}`;
      break;
    }
  }

  // Add memory context if relevant
  if (memoryContext) {
    structuredPrompt += `\n\n[PROMPT ENGINE — past context]:\n${memoryContext}`;
  }

  // Add precision requirements for all prompts
  structuredPrompt += '\n\n[PROMPT ENGINE — quality gate]: Do the COMPLETE thing. No shortcuts. No "this should work." Verify every claim. Show evidence.';

} catch {}

// ── 3. Save to memory for future retrieval ──────────────────────
try {
  const ts = new Date().toISOString();
  const entry = {
    ts,
    type: 'prompt',
    content: prompt.slice(0, 500),
    cwd: process.cwd(),
  };
  writeFileSync(
    join(MEMORY_DIR, `${ts.slice(0, 10)}-${ts.slice(11, 19).replace(/:/g, '')}-prompt.json`),
    JSON.stringify(entry, null, 2)
  );
} catch {}

// ── Output enriched prompt ──────────────────────────────────────
if (structuredPrompt !== prompt) {
  process.stdout.write(`[CLAUDEMAX PROMPT-ENGINE]\n${structuredPrompt}\n[/CLAUDEMAX PROMPT-ENGINE]\n`);
}

process.exit(0);
