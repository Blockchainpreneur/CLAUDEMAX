#!/usr/bin/env node
/**
 * Rational Router APEX — CLAUDEMAX 2.0
 * For visionaries, entrepreneurs, and thinkers.
 *
 * Extends the dev-focused router with a full entrepreneur cognitive layer:
 * brain-dumps, strategy, research, writing, pitches, hiring, decisions.
 *
 * Output tiers:
 *  - Trivial  (<15%): silent
 *  - Medium (15-49%): single routing hint
 *  - Complex  (50%+): full autopilot panel + EXECUTE/SPAWN directives
 *
 * Non-blocking: always exits 0.
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// ── Task complexity scores ──────────────────────────────────────────────────
const COMPLEXITY = {
  // Entrepreneur tasks
  'brain-dump':     30,
  'write-content':  25,
  brainstorm:       35,
  decide:           45,
  research:         50,
  hire:             50,
  strategy:         70,
  pitch:            75,
  fundraise:        80,

  // Dev tasks
  documentation:    5,  retro:      5,   monitor:       10,  memory:   10,
  'web-browse':     15, 'bug-fix':  35,  'code-review': 40,
  refactor:         45, design:     45,  investigate:   50,
  'deploy-ship':    55, performance:60,  planning:      65,
  'new-feature':    70, swarm:      75,  security:      80,  autoplan: 85,
};

// ── Rule definitions ────────────────────────────────────────────────────────
// Entrepreneur rules are listed first so they score higher on entrepreneur language.
const RULES = [

  // ── ENTREPRENEUR LAYER ───────────────────────────────────────────────────

  {
    id: 'brain-dump',
    patterns: [
      /\b(brain.?dump|i've been thinking|let me think out loud|rambling|messy thoughts|wall of text|too many thoughts|a lot on my mind|stream of consciousness)\b/,
      /^(ok so,?|so i|here'?s what i'?m thinking|i have a lot|i don'?t know where to start)/,
    ],
    skill: 'extract-decisions → prioritize → structure → SAVE key decisions + action items to ~/.claudemax/decisions.md',
    label: 'Processing your thoughts',
  },

  {
    id: 'write-content',
    patterns: [
      /\b(write|draft|create).{0,40}\b(email|post|thread|blog|memo|announcement|newsletter|copy|tweet|linkedin|message|letter|update|doc)\b/,
      /\b(write me|draft me|help me write|can you write)\b/,
    ],
    skill: 'draft → /review',
    label: 'Writing for you',
  },

  {
    id: 'brainstorm',
    patterns: [
      /\b(brainstorm|think through|explore.{0,15}idea|what if we|what if i|help me think|possibilities for|options for|how might we|how could we)\b/,
      /\b(riff on|expand on|build on the idea)\b/,
    ],
    skill: '/office-hours → capture',
    label: 'Thinking this through with you',
  },

  {
    id: 'decide',
    patterns: [
      /\b(should i|should we|decision|decide|pros.{0,5}cons|tradeoffs?|choose between|which (is|are|would|should) (be )?better|versus|vs\.)\b/,
      /\b(help me decide|what would you do|what.s the right call|which path)\b/,
    ],
    skill: '/office-hours → framework → recommend',
    label: 'Making the call with you',
    agents: ['advisor', 'researcher'],
  },

  {
    id: 'research',
    patterns: [
      /\b(research|look into|investigate.{0,20}(market|space|company|product)|find out (about|how)|what do (people|users|customers)|market size|landscape|competitors?)\b/,
      /\b(who (is|are|does)|what (is|are) the (best|top|leading)|how does .+ work)\b/,
    ],
    skill: '/browse → analyze → synthesize',
    label: 'Researching the market',
    agents: ['researcher'],
  },

  {
    id: 'strategy',
    patterns: [
      /\b(strategy|strategic|positioning|go.?to.?market|gtm|market fit|product.?market fit|competitive advantage|moat|differentiat|business model|revenue model|pricing strategy)\b/,
      /\b(how do we win|how do we grow|what.s the play|the right move|big picture|long term)\b/,
    ],
    skill: '/plan-ceo-review → /office-hours',
    label: 'Thinking through the strategy',
    agents: ['advisor', 'strategist', 'researcher'],
  },

  {
    id: 'pitch',
    patterns: [
      /\b(pitch|investor|pitch deck|demo day|cold email.{0,20}(investor|vc|fund)|fundraising deck|one.?pager)\b/,
      /\b(tell the story of|narrative for|how do we sell this)\b/,
    ],
    skill: '/office-hours → /design-consultation → build → /review',
    label: 'Building your pitch',
    agents: ['advisor', 'researcher', 'writer'],
  },

  {
    id: 'fundraise',
    patterns: [
      /\b(fundraise|raise (money|a round|seed|series [abcd]|pre.?seed)|term sheet|valuation|dilution|cap table|safe note|convertible)\b/,
      /\b(talking to vcs?|investor (meeting|call|outreach)|how to raise)\b/,
    ],
    skill: '/office-hours → research → draft → /review',
    label: 'Preparing to raise',
    agents: ['advisor', 'researcher', 'writer'],
  },

  {
    id: 'hire',
    patterns: [
      /\b(hire|hiring|first (hire|employee|eng|designer)|job description|interview (process|question)|equity (split|offer)|cofounder|co.?founder|who should (i|we) hire|build.{0,10}team)\b/,
    ],
    skill: '/office-hours → draft → /review',
    label: 'Helping you build the team',
    agents: ['advisor', 'researcher'],
  },

  // ── DEV LAYER (unchanged from v1) ────────────────────────────────────────

  {
    id: 'web-browse',
    patterns: [/\bgo to\b/, /\bbrowse\b/, /https?:\/\//, /\bnavigate to\b/],
    skill: '/browse [url]',
    label: 'Opening the page',
  },

  {
    id: 'new-feature',
    patterns: [
      /\b(build|create|make|implement|add|develop)\b.{0,30}\b(feature|component|page|api|endpoint|module|system)\b/,
      /\bnew feature\b/,
    ],
    skill: '/office-hours → /plan-eng-review → build → /review → /qa → /cso → /ship',
    label: 'Building something new',
    agents: ['planner', 'coder', 'reviewer', 'tester'],
  },

  {
    id: 'refactor',
    patterns: [/\b(refactor|rewrite|cleanup|clean up|restructure|modernize)\b/],
    skill: '/investigate → refactor → /review → /qa',
    label: 'Cleaning up the code',
    agents: ['researcher', 'coder', 'reviewer', 'tester'],
  },

  {
    id: 'bug-fix',
    patterns: [/\b(fix|debug|broken|crash|error|fail|issue|bug|not working|doesn.t work)\b/],
    skill: '/investigate → fix → /review → /qa',
    label: 'Fixing the problem',
    agents: ['researcher', 'coder', 'tester'],
  },

  {
    id: 'code-review',
    patterns: [/\b(review|audit|check|inspect).{0,20}\bcode\b/, /\bcode review\b/],
    skill: '/review → /cso',
    label: 'Reviewing the code',
    agents: ['reviewer', 'security-auditor'],
  },

  {
    id: 'security',
    patterns: [/\b(security|vulnerability|owasp|threat|exploit|xss|csrf|pentest)\b/],
    skill: '/cso',
    label: 'Security check',
    agents: ['security-auditor', 'reviewer', 'researcher'],
  },

  {
    id: 'deploy-ship',
    patterns: [/\b(deploy|ship|release|push to prod|go live|pull request)\b/],
    skill: '/review → /qa → /cso → /ship → /land-and-deploy → /canary',
    label: 'Deploying',
    agents: ['coder', 'tester', 'reviewer'],
  },

  {
    id: 'performance',
    patterns: [/\b(performance|slow|optimize|benchmark|speed|latency|bottleneck|faster)\b/],
    skill: '/benchmark → optimize → /review',
    label: 'Making it faster',
    agents: ['performance-engineer', 'coder', 'reviewer'],
  },

  {
    id: 'design',
    patterns: [/\b(design|ui|ux|component|css|layout|figma|tailwind|shadcn|dark mode|theme|dashboard)\b/],
    skill: '/design-consultation → build → /design-review → /qa → /ship',
    label: 'Designing the UI',
    agents: ['coder', 'reviewer'],
  },

  {
    id: 'documentation',
    patterns: [/\b(docs|document|readme|changelog|api docs)\b/],
    skill: '/document-release',
    label: 'Writing the docs',
  },

  {
    id: 'swarm',
    patterns: [/\b(swarm|parallel|multiple agents|concurrent|spawn agents)\b/],
    skill: 'swarm init --topology hierarchical',
    label: 'Big parallel task',
    agents: ['planner', 'coder', 'reviewer', 'tester', 'researcher'],
  },

  {
    id: 'memory',
    patterns: [/\b(remember|past|history|previous session|last time|we built)\b/],
    skill: 'memory search',
    label: 'Pulling up past context',
  },

  {
    id: 'planning',
    patterns: [/\b(plan|sprint|roadmap|architecture decision)\b/],
    skill: '/office-hours → /plan-ceo-review → /plan-eng-review',
    label: 'Planning the work',
    agents: ['planner', 'researcher'],
  },

  {
    id: 'monitor',
    patterns: [/\b(monitor|canary|post.deploy|health check|is it up)\b/],
    skill: '/canary',
    label: 'Monitoring',
  },

  {
    id: 'retro',
    patterns: [/\b(retro|retrospective|reflect|lessons learned|review sprint)\b/],
    skill: '/retro',
    label: 'Running the retro',
  },

  {
    id: 'autoplan',
    patterns: [/\b(autoplan|full pipeline|run everything|automated review)\b/],
    skill: '/autoplan',
    label: 'Full automated pipeline',
    agents: ['planner', 'coder', 'reviewer', 'tester', 'security-auditor'],
  },

  {
    id: 'investigate',
    patterns: [
      /\b(why|how does|explain|understand|investigate|diagnose|figure out|isn.t working|aren.t working)\b/,
      /\b(how (does|do|is|are)|what causes|root cause)\b/,
    ],
    skill: '/investigate → explain + fix',
    label: 'Investigating the issue',
    agents: ['researcher', 'coder'],
  },
];

// ── Agent display config ────────────────────────────────────────────────────
const AGENT_LABELS = {
  // Entrepreneur agents
  advisor:              'giving you honest strategic advice',
  strategist:           'thinking through the business angle',
  writer:               'drafting your content',
  analyst:              'analyzing the numbers',
  // Dev agents
  planner:              'planning the approach',
  coder:                'writing the code',
  reviewer:             'checking for problems',
  tester:               'making sure it works',
  researcher:           'finding what you need to know',
  'security-auditor':   'checking for security issues',
  'performance-engineer':'making it faster',
  architect:            'designing the structure',
};

const AGENT_ICONS = {
  advisor:              '◆ ',
  strategist:           '◈ ',
  writer:               '✦ ',
  analyst:              '◇ ',
  planner:              '▸ ',
  coder:                '▹ ',
  reviewer:             '▸ ',
  tester:               '▹ ',
  researcher:           '▸ ',
  'security-auditor':   '▸ ',
  'performance-engineer':'▸ ',
  architect:            '▸ ',
};

const TIER_LABEL   = { HAIKU: 'fast', SONNET: 'smart', OPUS: 'most capable' };

// Entrepreneur tasks get a cleaner label style
const ENTREPRENEUR_TASKS = new Set([
  'brain-dump', 'write-content', 'brainstorm', 'decide',
  'research', 'strategy', 'pitch', 'fundraise', 'hire',
]);

// ── Main ────────────────────────────────────────────────────────────────────
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

  // Pure questions (no action verb) pass through silently
  const normalized = prompt.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const ACTION_VERBS = /\b(fix|build|create|implement|refactor|deploy|review|audit|investigate|optimize|add|make|write|run|install|update|delete|remove|research|hire|draft|pitch|brainstorm|decide|strategize)\b/;
  // Entrepreneur questions are action-requests even when phrased as "what/how/should"
  const ENTREPRENEUR_INTENT = /\b(strategy|go.?to.?market|gtm|positioning|competitive|business model|revenue|pricing|fundrais|pitch|investor|market fit|roadmap|prioritize|should (we|i) (build|launch|raise|hire|pivot|focus)|what.s the (best|right) (way|move|approach)|how (do|should) (we|i) (grow|scale|win|differentiate))\b/i;
  const isQuestion =
    /^(is |are |was |were |has |have |does |do |did |can |could |would |should |what |why |how |when |where |who |describe |explain |tell me|give me)/i.test(normalized.trim()) &&
    !ACTION_VERBS.test(normalized) &&
    !ENTREPRENEUR_INTENT.test(prompt);
  if (isQuestion) process.exit(0);

  // Match rules
  const matches = RULES
    .map(r => ({ ...r, hits: r.patterns.filter(p => p.test(prompt)).length }))
    .filter(r => r.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  if (matches.length === 0) process.exit(0);

  const primary         = matches[0];
  let   complexity      = matches.reduce((max, m) => Math.max(max, COMPLEXITY[m.id] || 50), 0);

  // Gap 3: context-aware complexity boost ─────────────────────────────────
  try {
    const slug    = process.cwd().replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').toLowerCase().slice(-50);
    const ctxFile = join(homedir(), '.claudemax', 'contexts', `${slug}.md`);
    if (existsSync(ctxFile)) {
      const ctx = readFileSync(ctxFile, 'utf8').toLowerCase();
      if (ctx.includes(primary.id))  complexity = Math.min(85, complexity + 15); // seen before
      if (ctx.length > 2000)         complexity = Math.min(85, complexity + 5);  // big project
    }
  } catch {}

  if (complexity < 15) process.exit(0);

  const tier           = complexity < 30 ? 'HAIKU' : complexity < 65 ? 'SONNET' : 'OPUS';
  const isEntrepreneur = ENTREPRENEUR_TASKS.has(primary.id);

  // Gap 1: write current-task.json for completion diagram ──────────────────
  try {
    const taskDir = join(homedir(), '.claudemax');
    if (!existsSync(taskDir)) mkdirSync(taskDir, { recursive: true });
    writeFileSync(join(taskDir, 'current-task.json'),
      JSON.stringify({ id: primary.id, label: primary.label, ts: new Date().toISOString() }));
  } catch {}

  // Spin up Ruflo swarm for complex tasks
  if (complexity >= 50 && primary.agents?.length) {
    try {
      const nodeBin = dirname(process.execPath);
      const nvmBin = join(homedir(), '.nvm', 'versions', 'node', 'v20.19.0', 'bin');
      const PATH = [nodeBin, nvmBin, '/usr/local/bin', '/usr/bin', '/bin', process.env.PATH || ''].filter(Boolean).join(':');
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

  // ── State machine diagram → STDERR ──────────────────────────────────────
  const C  = isEntrepreneur ? '\x1b[35m' : '\x1b[36m';
  const R  = '\x1b[0m';
  const D  = '\x1b[2m';
  const W  = 58;           // total box width including borders
  const IW = W - 4;        // inner content width (2 border + 2 padding)
  const MID = Math.floor(W / 2);  // connector column

  const vis  = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
  const fit  = (s, w) => s + ' '.repeat(Math.max(0, w - [...vis(s)].length));

  // Box primitives
  const boxTop = (tag = '', rightLabel = '') => {
    const tagStr = tag ? `[ ${tag} ]` : '';
    const rl     = rightLabel ? ` ${rightLabel} ` : '';
    const fill   = W - 2 - tagStr.length - rl.length;
    return `${C}┌─${tagStr}${'─'.repeat(Math.max(0, fill))}${rl.length ? D + rl + R + C : ''}┐${R}`;
  };
  const boxBot = () => `${C}└${'─'.repeat(W - 2)}┘${R}`;
  const boxRow = (content) => `${C}│${R}  ${fit(content, IW)}${C}│${R}`;
  const conn   = () => [
    ' '.repeat(MID) + `${C}│${R}`,
    ' '.repeat(MID) + `${C}▼${R}`,
  ];

  // Pipeline renderer — wraps long pipelines across lines
  const renderPipeline = (skill) => {
    const steps = skill.split(/\s*→\s*/).map(s => s.trim()).filter(Boolean);
    const rows  = [];
    let line    = '';
    let lineLen = 0;
    for (let i = 0; i < steps.length; i++) {
      const sep    = i === 0 ? '' : ' ──► ';
      const chunk  = sep + steps[i];
      if (lineLen + vis(chunk).length > IW && i > 0) {
        rows.push(boxRow(line));
        line    = `     ${steps[i]}`;  // indent continuation
        lineLen = 5 + steps[i].length;
      } else {
        line    += chunk;
        lineLen += vis(chunk).length;
      }
    }
    if (line) rows.push(boxRow(line));
    return rows;
  };

  const shortPrompt = promptText.length > IW - 2 ? promptText.slice(0, IW - 3) + '…' : promptText;

  if (complexity >= 50 && primary.agents?.length) {
    // ── Full autopilot state machine ────────────────────────────────────────
    const icon = isEntrepreneur ? '◆' : '▸';
    const out  = [''];

    // Header
    const headerRight = `${primary.label}  ·  ${D}${TIER_LABEL[tier]}${R}`;
    const headerFill  = '─'.repeat(Math.max(0, W - 4 - vis(` ${icon} AUTOPILOT`).length - vis(headerRight).length - 2));
    out.push(` ${C}${icon} AUTOPILOT${R}  ${headerFill}  ${headerRight}`);
    out.push('');

    // INPUT node
    out.push(boxTop('INPUT'));
    out.push(boxRow(`${D}"${shortPrompt}"${R}`));
    out.push(boxBot());
    out.push(...conn());

    // DETECT node
    out.push(boxTop('DETECT'));
    out.push(boxRow(`task    ${C}${primary.id}${R}`));
    out.push(boxRow(`model   ${C}${tier}${R}  ${D}(${TIER_LABEL[tier]})${R}   scope  ${C}${complexity}%${R}`));
    out.push(boxBot());
    out.push(...conn());

    // SPAWN node
    out.push(boxTop('SPAWN', 'parallel'));
    for (const agent of (primary.agents || [])) {
      const ico = AGENT_ICONS[agent] || '▸ ';
      const lbl = AGENT_LABELS[agent] || agent;
      out.push(boxRow(`${C}${ico}${R} ${fit(agent, 14)}${D}${lbl}${R}`));
    }
    out.push(boxBot());
    out.push(...conn());

    // EXECUTE node
    out.push(boxTop('EXECUTE'));
    out.push(...renderPipeline(primary.skill));
    out.push(boxBot());

    out.push('');

    // Colored version → stderr (terminal always-visible)
    process.stderr.write(out.join('\n') + '\n');

    // Clean ASCII version → stdout so Claude outputs it in its response (app/web visible)
    const clean = out.map(l => l.replace(/\x1b\[[0-9;]*m/g, '')).join('\n');
    process.stdout.write(`[CLAUDEMAX DISPLAY]\n${clean}\n[/CLAUDEMAX DISPLAY]\n`);

  } else {
    // ── Compact routing diagram (medium tier) ───────────────────────────────
    const icon  = isEntrepreneur ? '◆' : '▸';
    const out   = [''];
    out.push(boxTop(`${icon}  ${primary.label}`, tier));
    out.push(...renderPipeline(primary.skill));
    out.push(boxBot());
    out.push('');

    process.stderr.write(out.join('\n') + '\n');

    const clean = out.map(l => l.replace(/\x1b\[[0-9;]*m/g, '')).join('\n');
    process.stdout.write(`[CLAUDEMAX DISPLAY]\n${clean}\n[/CLAUDEMAX DISPLAY]\n`);
  }

  // ── Machine directive → STDOUT (Claude reads and executes) ────────────────
  if (complexity >= 50 && primary.agents?.length) {
    const agentList = (primary.agents || []).join(', ');
    process.stdout.write(`[CLAUDEMAX APEX] task:${primary.id} model:${tier} complexity:${complexity}%\n`);
    process.stdout.write(`EXECUTE: ${primary.skill} — run NOW, do not wait for user confirmation\n`);
    process.stdout.write(`SPAWN: ${agentList} — parallel via Task tool, run_in_background:true, ALL in ONE message\n`);
    process.stdout.write(`VERIFY: confirm Task tool was called for each agent before proceeding\n`);
  } else {
    process.stdout.write(`[CLAUDEMAX] task:${primary.id} model:${tier} → ${primary.skill}\n`);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
