#!/usr/bin/env node
/**
 * Rational Router v3 — CLAUDEMAX Autopilot
 * Fires on UserPromptSubmit. Outputs IMPERATIVE instructions Claude executes.
 *
 * Output tiers:
 *  - Trivial  (<15%): silent — no tokens wasted
 *  - Medium (15-49%): 1 line → [CLAUDEMAX] task model → gstack-skill
 *  - Complex  (50%+): 3 lines → EXECUTE + SPAWN directives (auto-swarm)
 *
 * Non-blocking: always exits 0.
 */

import { spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const COMPLEXITY = {
  documentation: 5,  retro: 5,      monitor: 10,  memory: 10,
  'web-browse': 15,  'bug-fix': 35, 'code-review': 40,
  refactor: 45,      design: 45,    investigate: 50,
  'deploy-ship': 55, performance: 60, planning: 65,
  'new-feature': 70, swarm: 75,     security: 80, autoplan: 85,
};

const RULES = [
  { id: 'web-browse',   patterns: [/\bgo to\b/, /\bbrowse\b/, /https?:\/\//, /\bnavigate to\b/],
    skill: '/browse [url]' },
  { id: 'new-feature',  patterns: [/\b(build|create|make|implement|add|develop)\b.{0,30}\b(feature|component|page|api|endpoint|module|system)\b/, /\bnew feature\b/],
    skill: '/office-hours → /plan-eng-review → build → /review → /qa → /cso → /ship',
    agents: ['planner','coder','reviewer','tester'] },
  { id: 'refactor',     patterns: [/\b(refactor|rewrite|cleanup|clean up|restructure|modernize)\b/],
    skill: '/investigate → refactor → /review → /qa',
    agents: ['researcher','coder','reviewer','tester'] },
  { id: 'bug-fix',      patterns: [/\b(fix|debug|broken|crash|error|fail|issue|bug|not working|doesn.t work)\b/],
    skill: '/investigate → fix → /review → /qa',
    agents: ['researcher','coder','tester'] },
  { id: 'code-review',  patterns: [/\b(review|audit|check|inspect).{0,20}\bcode\b/, /\bcode review\b/],
    skill: '/review → /cso',
    agents: ['reviewer','security-auditor'] },
  { id: 'security',     patterns: [/\b(security|vulnerability|owasp|threat|exploit|xss|csrf|pentest)\b/],
    skill: '/cso',
    agents: ['security-auditor','reviewer','researcher'] },
  { id: 'deploy-ship',  patterns: [/\b(deploy|ship|release|push to prod|go live|pull request)\b/],
    skill: '/review → /qa → /cso → /ship → /land-and-deploy → /canary',
    agents: ['coder','tester','reviewer'] },
  { id: 'performance',  patterns: [/\b(performance|slow|optimize|benchmark|speed|latency|bottleneck|faster|rapido|mejorar)\b/],
    skill: '/benchmark → optimize → /review',
    agents: ['performance-engineer','coder','reviewer'] },
  { id: 'design',       patterns: [/\b(design|ui|ux|component|css|layout|figma|tailwind|shadcn|dark mode|theme|dashboard)\b/],
    skill: '/design-consultation → build → /design-review → /qa → /ship',
    agents: ['coder','reviewer'] },
  { id: 'documentation',patterns: [/\b(docs|document|readme|changelog|api docs)\b/],
    skill: '/document-release' },
  { id: 'swarm',        patterns: [/\b(swarm|parallel|multiple agents|concurrent|spawn agents)\b/],
    skill: 'swarm init --topology hierarchical',
    agents: ['planner','coder','reviewer','tester','researcher'] },
  { id: 'memory',       patterns: [/\b(remember|past|history|previous session|last time|we built)\b/],
    skill: 'memory search' },
  { id: 'planning',     patterns: [/\b(plan|sprint|roadmap|strategy|prioritize|architecture decision)\b/],
    skill: '/office-hours → /plan-ceo-review → /plan-eng-review',
    agents: ['planner','researcher'] },
  { id: 'monitor',      patterns: [/\b(monitor|canary|post.deploy|health check|is it up)\b/],
    skill: '/canary' },
  { id: 'retro',        patterns: [/\b(retro|retrospective|reflect|lessons learned|review sprint)\b/],
    skill: '/retro' },
  { id: 'autoplan',     patterns: [/\b(autoplan|full pipeline|run everything|automated review)\b/],
    skill: '/autoplan',
    agents: ['planner','coder','reviewer','tester','security-auditor'] },
  { id: 'investigate',  patterns: [/\b(why|how does|what is|explain|understand|investigate|diagnose|figure out|isn.t working|aren.t working)\b/, /\b(how (does|do|is|are)|what causes|root cause)\b/],
    skill: '/investigate → explain + fix',
    agents: ['researcher','coder'] },
];

async function main() {
  let promptText = '';
  try {
    if (!process.stdin.isTTY) {
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString().trim();
      if (raw) {
        try { const p = JSON.parse(raw); promptText = p.prompt || p.user_prompt || ''; }
        catch { promptText = raw; }
      }
    }
  } catch { /* non-blocking */ }

  if (!promptText) promptText = process.argv[2] || '';
  const prompt = promptText.toLowerCase().trim();
  if (!prompt || prompt.length < 3) process.exit(0);

  // Skip status/question prompts — avoid false positives on "is X done?", "are we good?"
  const isQuestion = /^(is |are |was |were |has |have |does |do |did |can |could |would |should |what |why |how |when |where |who )/i.test(prompt.trim()) &&
    !/\b(fix|build|create|implement|refactor|deploy|review|audit|investigate|optimize|add|make)\b/.test(prompt);
  if (isQuestion) process.exit(0);

  const matches = RULES
    .map(r => ({ ...r, hits: r.patterns.filter(p => p.test(prompt)).length }))
    .filter(r => r.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  if (matches.length === 0) process.exit(0);

  const primary = matches[0];
  const complexity = matches.reduce((max, m) => Math.max(max, COMPLEXITY[m.id] || 50), 0);

  if (complexity < 15) process.exit(0);

  const tier = complexity < 30 ? 'HAIKU' : complexity < 65 ? 'SONNET' : 'OPUS';

  // Auto-init Ruflo swarm for complex tasks (>= 50%)
  if (complexity >= 50 && primary.agents?.length) {
    try {
      const nodeBin = dirname(process.execPath);
      const PATH = [nodeBin, '/Users/macbook/.nvm/versions/node/v20.19.0/bin', '/usr/local/bin', '/usr/bin', '/bin', process.env.PATH || ''].filter(Boolean).join(':');
      spawn('npx', ['ruflo@latest', 'swarm', 'init', '--topology', 'hierarchical', '--max-agents', '8', '--strategy', 'specialized'],
        { cwd: process.cwd(), detached: true, stdio: 'ignore', env: { ...process.env, PATH } }).unref();
      try {
        const metricsDir = join(process.cwd(), '.claude-flow', 'metrics');
        if (!existsSync(metricsDir)) mkdirSync(metricsDir, { recursive: true });
        const agents = (primary.agents || []).map((type, i) => ({
          id: `${type}-${Date.now()}-${i}`, type, status: 'spawning', startedAt: new Date().toISOString(),
        }));
        writeFileSync(join(metricsDir, 'swarm-activity.json'), JSON.stringify({
          swarm: { active: true, agent_count: agents.length, topology: 'hierarchical', task: promptText.slice(0, 80), agents },
          ts: new Date().toISOString(),
        }, null, 2));
      } catch { /* non-blocking */ }
    } catch { /* non-blocking */ }
  }

  // Output — imperative instructions Claude follows automatically
  if (complexity >= 50 && primary.agents?.length) {
    const agentList = (primary.agents || []).join(', ');
    console.log(`[CLAUDEMAX AUTOPILOT] task:${primary.id} model:${tier} complexity:${complexity}%`);
    console.log(`EXECUTE: ${primary.skill} — run NOW, do not wait for user confirmation`);
    console.log(`SPAWN: ${agentList} — parallel via Task tool, run_in_background:true, ALL in ONE message`);
  } else {
    console.log(`[CLAUDEMAX] task:${primary.id} model:${tier} → ${primary.skill}`);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
