#!/usr/bin/env node
/**
 * CLAUDEMAX NotebookLM Bridge — CLI integration
 *
 * Uses notebooklm CLI (Python 3.12) to offload reasoning from Claude.
 * Saves tokens by having NotebookLM do research, synthesis, and structuring.
 *
 * Usage:
 *   node notebooklm-bridge.mjs ask "question"          — ask NotebookLM
 *   node notebooklm-bridge.mjs structure "prompt"       — structure a prompt
 *   node notebooklm-bridge.mjs add-source <file>        — add a source document
 *   node notebooklm-bridge.mjs compress-memory          — compress session memory
 *   node notebooklm-bridge.mjs brief                    — session briefing
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const HOME = homedir();
const NLM_BIN = '/Library/Frameworks/Python.framework/Versions/3.12/bin/notebooklm';
const CACHE_DIR = join(HOME, '.claudemax', 'nlm-cache');
const MEMORY_DIR = join(HOME, '.claudemax', 'memory');
const NB_ID_FILE = join(HOME, '.claudemax', 'nlm-notebook-id');

mkdirSync(CACHE_DIR, { recursive: true });

const command = process.argv[2] || 'help';
const input = process.argv.slice(3).join(' ') || '';

function nlm(cmd) {
  try {
    return execSync(`${NLM_BIN} ${cmd}`, { encoding: 'utf8', timeout: 30000 }).trim();
  } catch (e) {
    return `[NLM error: ${e.message?.slice(0, 80)}]`;
  }
}

function ensureNotebook() {
  if (!existsSync(NB_ID_FILE)) {
    console.error('No NotebookLM notebook configured. Run: node notebooklm-bridge.mjs setup');
    process.exit(1);
  }
  const id = readFileSync(NB_ID_FILE, 'utf8').trim();
  nlm(`use ${id.slice(0, 8)}`);
  return id;
}

switch (command) {
  case 'ask': {
    ensureNotebook();
    // Check cache first
    const cacheKey = input.replace(/[^a-z0-9]/gi, '-').slice(0, 40);
    const cacheFile = join(CACHE_DIR, `${cacheKey}.txt`);
    if (existsSync(cacheFile)) {
      const age = Date.now() - require('fs').statSync(cacheFile).mtimeMs;
      if (age < 3600000) { // 1hr cache
        console.log(readFileSync(cacheFile, 'utf8'));
        break;
      }
    }
    const result = nlm(`ask "${input.replace(/"/g, '\\"')}"`);
    // Extract just the answer
    const answer = result.split('Answer:').pop()?.trim() || result;
    writeFileSync(cacheFile, answer);
    console.log(answer);
    break;
  }

  case 'structure': {
    ensureNotebook();
    const structuredPrompt = nlm(`ask "Structure this prompt for maximum precision. Add requirements a senior engineer would expect. Prevent lazy responses. The prompt is: ${input.replace(/"/g, '\\"')}"`);
    const answer = structuredPrompt.split('Answer:').pop()?.trim() || structuredPrompt;
    console.log(answer);
    break;
  }

  case 'add-source': {
    ensureNotebook();
    if (!existsSync(input)) { console.error('File not found:', input); break; }
    const result = nlm(`source add-text "${input.replace(/"/g, '\\"')}"`);
    console.log(result);
    break;
  }

  case 'compress-memory': {
    ensureNotebook();
    if (!existsSync(MEMORY_DIR)) { console.log('No memory.'); break; }
    const files = readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort();
    const entries = files.map(f => { try { return JSON.parse(readFileSync(join(MEMORY_DIR, f), 'utf8')); } catch { return null; } }).filter(Boolean);
    const raw = entries.map(e => `[${e.ts?.slice(0,10)}] ${e.type}: ${e.content || e.summary || ''}`).join('\n');

    const compressed = nlm(`ask "Compress these session logs into a 3-sentence briefing. Include: project, key decisions, current status, next actions: ${raw.slice(0, 2000).replace(/"/g, '\\"')}"`);
    const answer = compressed.split('Answer:').pop()?.trim() || compressed;

    writeFileSync(join(MEMORY_DIR, '_compressed-summary.json'), JSON.stringify({
      ts: new Date().toISOString(), type: 'compressed-summary',
      content: answer, entriesCompressed: entries.length,
    }, null, 2));
    console.log(answer);
    break;
  }

  case 'brief': {
    const summaryFile = join(MEMORY_DIR, '_compressed-summary.json');
    if (existsSync(summaryFile)) {
      console.log(JSON.parse(readFileSync(summaryFile, 'utf8')).content);
    } else {
      console.log('No briefing yet. Run: node notebooklm-bridge.mjs compress-memory');
    }
    break;
  }

  case 'setup': {
    console.log('Creating CLAUDEMAX Autopilot notebook...');
    const result = nlm('create "CLAUDEMAX Autopilot Memory"');
    const idMatch = result.match(/([a-f0-9-]{36})/);
    if (idMatch) {
      writeFileSync(NB_ID_FILE, idMatch[1]);
      console.log('Notebook created:', idMatch[1]);
    } else {
      console.log(result);
    }
    break;
  }

  case 'help': default:
    console.log(`NotebookLM Bridge — CLAUDEMAX
Commands:
  ask "question"         Ask NotebookLM (cached 1hr)
  structure "prompt"     Structure prompt for precision
  add-source <file>      Add document to notebook
  compress-memory        Compress session memory via NLM
  brief                  Show session briefing
  setup                  Create autopilot notebook`);
}

process.exit(0);
