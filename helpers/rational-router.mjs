#!/usr/bin/env node
/**
 * Rational Router — Thinking Step for Every Claude Code Prompt
 * Fires on UserPromptSubmit. Claude Code sends { prompt } via stdin as JSON.
 * Analyzes intent, picks the right system + model tier, outputs activation plan.
 *
 * Features:
 * - 17 intent rules with swarm auto-init for complex tasks
 * - Model tier recommendation (HAIKU / SONNET / OPUS)
 * - Complexity scoring (0-100%)
 * - [AGENT_BOOSTER_AVAILABLE] for trivial single-file transforms
 * - Skips swarm init for low-complexity tasks (< 35%)
 * Non-blocking: always exits 0.
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// Complexity weights per rule (0-100)
const COMPLEXITY = {
  'documentation': 5,  'retro': 5,   'monitor': 10,  'memory': 10,
  'web-browse': 15,    'bug-fix': 35, 'code-review': 40,
  'refactor': 45,      'design': 45,  'investigate': 50,
  'deploy-ship': 55,   'performance': 60, 'planning': 65,
  'new-feature': 70,   'swarm': 75,   'security': 80, 'autoplan': 85,
};

async function main() {
  let promptText = '';
  try {
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
  } catch { /* non-blocking */ }

  if (!promptText) promptText = process.argv[2] || '';
  const prompt = promptText.toLowerCase().trim();
  if (!prompt || prompt.length < 3) process.exit(0);

  // ── Intent rules ─────────────────────────────────────────────────────────────
  const rules = [
    {
      id: 'web-browse', label: 'Web / Browser Task',
      patterns: [/\bgo to\b/, /\bbrowse\b/, /\bopen.*(https?|url|site|page)\b/, /https?:\/\//, /\bnavigate to\b/, /\bcheck.*(website|url|page|site)\b/],
      activation: ['Use → /browse [url]  (real Chromium, ~100ms)', 'Never simulate browser interactions — always use /browse'],
      missing: ['The URL or website to open?'],
    },
    {
      id: 'new-feature', label: 'New Feature / Build',
      patterns: [
        /\b(build|create|make|implement|add|develop|write)\b.{0,30}\b(feature|component|page|screen|api|endpoint|module|system|function|service)\b/,
        /\bnew feature\b/, /\bi need (a|an)\b.{0,20}\b(feature|component|page)\b/,
      ],
      activation: [
        'Sprint: /office-hours → /plan-eng-review → build → /review → /qa → /cso → /ship',
        'If UI involved: add /design-consultation before /plan-eng-review',
      ],
      missing: ['Feature description?', 'Target file / module / tech stack?'],
      optional: true, swarm: true,
      agents: ['planner', 'coder', 'reviewer', 'tester'], topology: 'hierarchical',
    },
    {
      id: 'refactor', label: 'Refactor / Cleanup / Rewrite',
      patterns: [
        /\b(refactor|rewrite|cleanup|clean up|restructure|reorganize|modernize|overhaul)\b/,
        /\b(full refactor|complete refactor|global (setup|config|refactor))\b/,
        /\b(make.*work(s)? (the )?ideal|improve.*setup|fix.*setup)\b/,
      ],
      activation: ['Use → /investigate first', 'Then refactor → /review → /qa'],
      missing: ['Which files or modules?', 'Goal — performance, readability, or architecture?'],
      optional: true, swarm: true,
      agents: ['researcher', 'coder', 'reviewer', 'tester'], topology: 'hierarchical',
    },
    {
      id: 'bug-fix', label: 'Bug Fix / Debug',
      patterns: [/\b(fix|debug|broken|crash|error|fail|issue|bug|not working|doesn.t work|unexpected)\b/],
      activation: ['Use → /investigate (root-cause analysis)', 'Then → fix → /review → /qa'],
      missing: ['Error message or stack trace?', 'Which file / component?'],
      optional: true, swarm: true,
      agents: ['researcher', 'coder', 'tester'], topology: 'hierarchical',
    },
    {
      id: 'code-review', label: 'Code Review',
      patterns: [/\b(review|audit|check|inspect).{0,20}\bcode\b/, /\bcode review\b/, /\bcan you (look at|check|review)\b/],
      activation: ['Use → /review (full review with auto-fixes)', 'Then → /cso if security check needed'],
      missing: ['Which files or PR?'],
      swarm: true, agents: ['reviewer', 'security-auditor'], topology: 'hierarchical',
    },
    {
      id: 'security', label: 'Security Audit',
      patterns: [/\b(security|secure|vulnerability|owasp|threat|exploit|hack|injection|xss|csrf|pentest)\b/],
      activation: ['Use → /cso (OWASP Top 10 + STRIDE threat modeling)'],
      missing: ['Which codebase or component?'],
      swarm: true, agents: ['security-auditor', 'reviewer', 'researcher'], topology: 'hierarchical',
    },
    {
      id: 'deploy-ship', label: 'Deploy / Ship / Release',
      patterns: [/\b(deploy|ship|release|push to prod|go live|merge|pull request|pr)\b/],
      activation: ['Use → /ship → /land-and-deploy → /canary'],
      missing: ['Target branch?', 'Target environment?'],
      optional: true, swarm: true,
      agents: ['coder', 'tester', 'reviewer'], topology: 'hierarchical',
    },
    {
      id: 'performance', label: 'Performance / Optimization',
      patterns: [/\b(performance|slow|fast|optimize|benchmark|speed|latency|bottleneck|memory usage|output mas rapido|faster output|mas rapido|mejorar|rapido)\b/],
      activation: ['Use → /benchmark (baseline)', 'Then optimize → /review to verify'],
      missing: ['Which component?', 'Current vs target metrics?'],
      optional: true, swarm: true,
      agents: ['performance-engineer', 'coder', 'reviewer'], topology: 'hierarchical',
    },
    {
      id: 'design', label: 'Design / UI / UX',
      patterns: [/\b(design|ui|ux|component|style|css|layout|visual|figma|wireframe|color|font|spacing|dashboard|landing|page|screen|interface|tailwind|shadcn|dark mode|theme)\b/],
      activation: [
        '🎨 DESIGN SYSTEM ACTIVE — ~/.claude/design-system.md',
        'Stack: Tailwind v4 + shadcn/ui (zinc) + Radix UI + Inter + lucide-react',
        'Use → /design-consultation then /design-review',
      ],
      missing: ['Which component?', 'Dark mode needed?'],
      optional: true, swarm: true, agents: ['coder', 'reviewer'], topology: 'hierarchical',
    },
    {
      id: 'documentation', label: 'Documentation',
      patterns: [/\b(docs|document|readme|changelog|api docs|write docs|update docs)\b/],
      activation: ['Use → /document-release'],
      missing: ['What changed?'], optional: true,
    },
    {
      id: 'swarm', label: 'Multi-Agent Swarm Task',
      patterns: [/\b(swarm|parallel|multiple agents|concurrent|distribute|spawn agents|team of agents)\b/],
      activation: [
        'npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8',
        'Spawn specialized agents via Task tool in ONE message',
      ],
      missing: ['Task breakdown?'],
      swarm: true, agents: ['planner', 'coder', 'reviewer', 'tester', 'researcher'], topology: 'hierarchical',
    },
    {
      id: 'memory', label: 'Memory / Past Context Lookup',
      patterns: [/\b(remember|past|history|what did we|previous session|last time|we decided|we built)\b/],
      activation: ['npx @claude-flow/cli@latest memory search --query "..."'],
      missing: ['Topic to look up?'],
    },
    {
      id: 'planning', label: 'Planning / Strategy / Sprint',
      patterns: [/\b(plan|sprint|roadmap|strategy|prioritize|think through|architecture decision|adr)\b/],
      activation: ['/office-hours → /plan-ceo-review → /plan-eng-review'],
      missing: ['Goals for this sprint?'],
      optional: true, swarm: true,
      agents: ['planner', 'researcher', 'architecture'], topology: 'hierarchical',
    },
    {
      id: 'monitor', label: 'Post-Deploy Monitoring',
      patterns: [/\b(monitor|canary|post.deploy|health check|check deploy|is it up|prod.*(ok|broken|down))\b/],
      activation: ['Use → /canary'],
      missing: ['Which environment?'],
    },
    {
      id: 'retro', label: 'Retrospective / Reflection',
      patterns: [/\b(retro|retrospective|reflect|what worked|lessons learned|review sprint|look back)\b/],
      activation: ['Use → /retro'],
      missing: [],
    },
    {
      id: 'autoplan', label: 'Auto-Review Pipeline',
      patterns: [/\b(autoplan|auto plan|full pipeline|run everything|automated review)\b/],
      activation: ['Use → /autoplan (full review pipeline)'],
      missing: ['Which codebase or PR?'],
      swarm: true, agents: ['planner', 'coder', 'reviewer', 'tester', 'security-auditor'], topology: 'hierarchical',
    },
    {
      id: 'investigate', label: 'Investigate / Diagnose / Understand',
      patterns: [
        /\b(why|how does|what is|explain|understand|investigate|diagnose|figure out|find out|what('s| is) happening|not working|isn.t working|aren.t working)\b/,
        /\b(how (does|do|is|are)|what causes|root cause|why (are|is|does|do|did|can.t|won.t))\b/,
      ],
      activation: ['/investigate (root-cause + deep read)', 'Then explain findings + propose fix'],
      missing: [], optional: true, swarm: true,
      agents: ['researcher', 'coder'], topology: 'hierarchical',
    },
  ];

  function classify(text) {
    return rules
      .map(rule => ({ ...rule, hits: rule.patterns.filter(p => p.test(text)).length }))
      .filter(r => r.hits > 0)
      .sort((a, b) => b.hits - a.hits);
  }

  const matches = classify(prompt);
  if (matches.length === 0) process.exit(0);

  const primary   = matches[0];
  const secondary = matches[1] || null;

  // ── Complexity scoring + model tier ─────────────────────────────────────────
  const topComplexity = matches.reduce((max, m) => Math.max(max, COMPLEXITY[m.id] || 50), 0);
  const isBooster     = topComplexity < 15;  // trivial: rename, add type, small tweak
  const tier          = topComplexity < 30 ? 'HAIKU' : topComplexity < 65 ? 'SONNET' : 'OPUS';

  // ── Auto-swarm init (background, non-blocking) — only for complex tasks ──────
  function autoInitSwarm(rule) {
    if (topComplexity < 35) return; // skip swarm for simple tasks
    try {
      const nodeBin = dirname(process.execPath);
      const PATH = [nodeBin, '/Users/macbook/.nvm/versions/node/v20.19.0/bin', '/usr/local/bin', '/usr/bin', '/bin', process.env.PATH || ''].filter(Boolean).join(':');

      spawn('npx', ['@claude-flow/cli@latest', 'swarm', 'init',
        '--topology', rule.topology || 'hierarchical',
        '--max-agents', '8', '--strategy', 'specialized',
      ], { cwd: process.cwd(), detached: true, stdio: 'ignore', env: { ...process.env, PATH } }).unref();

      try {
        const metricsDir = join(process.cwd(), '.claude-flow', 'metrics');
        if (!existsSync(metricsDir)) mkdirSync(metricsDir, { recursive: true });
        const swarmPath = join(metricsDir, 'swarm-activity.json');
        if (existsSync(swarmPath)) {
          try { const c = JSON.parse(readFileSync(swarmPath, 'utf-8')); if (c?.swarm?.active) return; } catch {}
        }
        const agents = (rule.agents || []).map((type, i) => ({
          id: `${type}-${Date.now()}-${i}`, type, status: 'spawning', startedAt: new Date().toISOString(),
        }));
        writeFileSync(swarmPath, JSON.stringify({
          swarm: { active: true, agent_count: agents.length, coordination_active: true, topology: rule.topology || 'hierarchical', task: promptText.slice(0, 80), agents },
          ts: new Date().toISOString(),
        }, null, 2));
      } catch {}
    } catch {}
  }

  // ── Build output ─────────────────────────────────────────────────────────────
  const lines = [];
  lines.push('');
  lines.push('┌─ RATIONAL ROUTER ──────────────────────────────────────────────┐');
  lines.push(`│ Intent:     ${primary.label.padEnd(51)}│`);
  lines.push(`│ Complexity: ${String(topComplexity + '%').padEnd(10)} Model: ${tier.padEnd(33)}│`);
  lines.push('└────────────────────────────────────────────────────────────────┘');

  lines.push('');
  lines.push('▶ Recommended Activation:');
  primary.activation.forEach(a => lines.push(`  • ${a}`));

  if (secondary) {
    lines.push('');
    lines.push(`▶ Also detected: ${secondary.label}`);
    secondary.activation.slice(0, 1).forEach(a => lines.push(`  • ${a}`));
  }

  // Swarm directive (only for complex tasks)
  if (primary.swarm && primary.agents?.length && topComplexity >= 35) {
    autoInitSwarm(primary);
    const agentList = primary.agents.join(', ');
    lines.push('');
    lines.push('╔═ SWARM AUTO-INIT ══════════════════════════════════════════════╗');
    lines.push('║ ⚡ Spawn ALL agents in ONE message via Task tool:              ║');
    lines.push(`║   Agents → ${agentList.slice(0, 51).padEnd(51)}║`);
    lines.push('║   run_in_background: true  •  ALL calls in ONE message         ║');
    lines.push('║   After spawning: STOP — wait for ALL results before answering ║');
    lines.push('╚════════════════════════════════════════════════════════════════╝');
  }

  // Missing info
  const missing = (primary.missing || []).filter(q => {
    const words = q.split('?')[0].toLowerCase().split(/\s+/);
    const key   = words.find(w => w.length > 4) || words[words.length - 1];
    return !prompt.includes(key);
  });
  if (missing.length > 0 && !primary.optional) {
    lines.push('');
    lines.push('▶ Need from you:');
    missing.forEach(q => lines.push(`  ? ${q}`));
  } else if (missing.length > 0) {
    lines.push('');
    lines.push('▶ Would help (optional):');
    missing.slice(0, 1).forEach(q => lines.push(`  ? ${q}`));
  }

  // Model recommendation — Claude reads this and acts on it
  lines.push('');
  lines.push(`[TASK_MODEL_RECOMMENDATION: ${tier}] [COMPLEXITY: ${topComplexity}%]${isBooster ? ' [AGENT_BOOSTER_AVAILABLE]' : ''}`);
  lines.push('▶ Systems: gstack  •  claudemax (claude-flow)  •  Use /browse for web');
  lines.push('');

  console.log(lines.join('\n'));
  process.exit(0);
}

main().catch(() => process.exit(0));
