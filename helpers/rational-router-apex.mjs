#!/usr/bin/env node
/**
 * Ripple — CLAUDEMAX Autopilot Engine
 * For visionaries, entrepreneurs, and builders shipping real products.
 *
 * Extends the dev-focused router with:
 * - Entrepreneur cognitive layer (brain-dumps, strategy, pitches, hiring)
 * - Prompt enrichment engine (adds production context users don't ask for)
 * - gstack-first routing (~95% of tasks flow through gstack skills)
 *
 * Output tiers:
 *  - Trivial  (<3%): silent (only greetings, no real task)
 *  - Medium  (3-49%): compact routing + ENRICH context
 *  - Complex (50%+): full Ripple panel + EXECUTE/SPAWN/ENRICH directives
 *
 * Non-blocking: always exits 0.
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync, statSync } from 'fs';
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
    id: 'e2e-testing',
    patterns: [
      /\bplaywright\b/i,
      /\b(e2e|end.to.end|browser test|ui test|integration test)\b/i,
      /\b(automate.{0,15}browser|open.{0,10}browser|take screenshot)\b/i,
      /\b(test.{0,20}(app|page|ui|flow|site|form))\b/i,
      /\b(write.{0,10}test|run.{0,10}test|add.{0,10}test|spec\.ts|\.spec\.)\b/i,
      /\b(click.{0,20}button|fill.{0,20}form|screenshot|visual check)\b/i,
    ],
    skill: 'playwright → mcp__playwright__* → npx playwright test',
    label: 'Testing with Playwright',
    agents: ['tester', 'coder', 'reviewer'],
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

// ── Prompt enrichment — production context the user didn't ask for ─────────
const ENRICHMENTS = {
  'new-feature': [
    'input validation at all boundaries',
    'error states (network failure, invalid input, timeout, empty)',
    'loading/skeleton states',
    'responsive design (mobile-first)',
    'accessibility (ARIA, keyboard nav)',
    'E2E tests with Playwright',
    'edge cases and overflow handling',
  ],
  'bug-fix': [
    'root cause analysis before patching',
    'regression test that catches this exact bug',
    'check for same pattern in related code',
    'verify fix handles edge cases',
  ],
  'deploy-ship': [
    'pre-deploy smoke test',
    'rollback plan if deploy fails',
    'post-deploy canary monitoring',
    'verify zero-downtime',
  ],
  design: [
    'mobile-first responsive',
    'dark mode support',
    'loading/empty/error/overflow states',
    'accessibility (WCAG 2.1 AA)',
    'visual regression test',
  ],
  'e2e-testing': [
    'happy path + error paths + edge cases',
    'mobile viewport testing',
    'form validation testing',
    'cross-browser (chromium + firefox)',
  ],
  refactor: [
    'preserve all existing behavior',
    'add/update tests to cover refactored code',
    'benchmark before and after for performance',
  ],
  security: [
    'OWASP Top 10 check',
    'STRIDE threat model',
    'input sanitization audit',
    'auth/session handling review',
  ],
  'code-review': [
    'security implications',
    'performance impact',
    'test coverage gaps',
    'edge cases missed',
  ],
  performance: [
    'baseline measurement before changes',
    'identify actual bottleneck (profile, don\'t guess)',
    'test with realistic data volume',
    'check for N+1 queries and memory leaks',
  ],
  investigate: [
    'reproduce the issue first',
    'check logs and error traces',
    'narrow scope before patching',
    'verify the fix doesn\'t mask the real problem',
  ],
  'brain-dump': [
    'extract actionable decisions',
    'identify blockers and dependencies',
    'prioritize by impact vs effort',
  ],
  strategy: [
    'competitive landscape',
    'distribution channel strategy',
    'unit economics check',
    'go-to-market timeline',
  ],
  pitch: [
    'problem/solution clarity',
    'market size evidence',
    'traction metrics',
    'why now, why you',
  ],
  fundraise: [
    'round size and use of funds',
    'key metrics investors will ask about',
    'comparable raises in this space',
  ],
  research: [
    'primary vs secondary sources',
    'verify claims with data',
    'identify conflicting evidence',
  ],
};

// ── Tool recommendations — best instruments per task ────────────────────────
// gstack is always the base. These add the specific MCPs and tools that make
// each task type execute at the highest level.
const TOOL_RECS = {
  'new-feature': [
    'gstack: /office-hours → /plan-eng-review → build → /review → /qa → /cso → /ship',
    'mcp__playwright__: E2E tests for all user flows',
    'mcp__supabase__: backend, auth, storage, RLS policies',
    'mcp__shadcn__: UI component library (check registry first)',
    'mcp__context7__: latest framework docs before coding',
  ],
  'bug-fix': [
    'gstack: /investigate → fix → /review → /qa',
    'mcp__playwright__: reproduce the bug in a real browser',
    'mcp__context7__: check if it is a known framework issue',
  ],
  design: [
    'gstack: /design-consultation → build → /design-review → /qa → /ship',
    'mcp__shadcn__: component library + audit checklist',
    'mcp__magicuidesign-mcp__: animated/interactive components',
    'mcp__playwright__: visual regression + responsive testing',
  ],
  'deploy-ship': [
    'gstack: /review → /qa → /cso → /ship → /land-and-deploy → /canary',
    'mcp__github__: PR creation, branch management, release',
  ],
  'e2e-testing': [
    'mcp__playwright__: all browser automation and testing',
    'gstack: /qa for full QA workflow with bug fixes',
  ],
  security: [
    'gstack: /cso for OWASP Top 10 + STRIDE audit',
    'mcp__supabase__: check RLS policies, auth config, exposed keys',
  ],
  performance: [
    'gstack: /benchmark for baseline measurement',
    'mcp__playwright__: Core Web Vitals + page load profiling',
  ],
  'code-review': [
    'gstack: /review for comprehensive code review',
    'gstack: /cso for security implications',
  ],
  refactor: [
    'gstack: /review → /qa after refactoring',
    'mcp__playwright__: regression tests to verify nothing broke',
    'mcp__context7__: check framework best practices',
  ],
  investigate: [
    'gstack: /investigate for systematic root-cause debugging',
    'mcp__playwright__: reproduce in browser if UI-related',
    'mcp__context7__: check framework docs for known issues',
  ],
  'web-browse': [
    'gstack: /browse for fast web research',
  ],
  'brain-dump': [
    'gstack: extract decisions → prioritize → structure',
  ],
  strategy: [
    'gstack: /office-hours for strategic review',
    'mcp__context7__: market/technology research',
  ],
  pitch: [
    'gstack: /office-hours for pitch structure and feedback',
  ],
  research: [
    'mcp__context7__: technical docs and framework references',
    'gstack: /browse for web research',
  ],
};

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
      const { size } = statSync(ctxFile);
      if (size < 512 * 1024) { // skip files > 512 KB to avoid memory/perf issues
        const ctx = readFileSync(ctxFile, 'utf8').toLowerCase();
        if (ctx.includes(primary.id))  complexity = Math.min(85, complexity + 15); // seen before
        if (ctx.length > 2000)         complexity = Math.min(85, complexity + 5);  // big project
      }
    }
  } catch {}

  if (complexity < 3) process.exit(0);  // only truly empty tasks skip — Ripple routes everything

  const tier           = complexity < 30 ? 'HAIKU' : complexity < 65 ? 'SONNET' : 'OPUS';
  const isEntrepreneur = ENTREPRENEUR_TASKS.has(primary.id);

  // Gap 1: write current-task.json for completion diagram ──────────────────
  try {
    const taskDir = join(homedir(), '.claudemax');
    if (!existsSync(taskDir)) mkdirSync(taskDir, { recursive: true });
    writeFileSync(join(taskDir, 'current-task.json'),
      JSON.stringify({ id: primary.id, label: primary.label, ts: new Date().toISOString() }));
  } catch {}

  // Version check — once per session, non-blocking ──────────────────────────
  try {
    const flagFile = join(homedir(), '.claudemax', '.version-checked-' + new Date().toISOString().slice(0, 10));
    if (!existsSync(flagFile)) {
      writeFileSync(flagFile, Date.now().toString());
      // Clean up flags older than 24h
      try {
        const dir = join(homedir(), '.claudemax');
        const cutoff = Date.now() - 86400000;
        for (const f of (await import('fs')).readdirSync(dir).filter(f => f.startsWith('.version-checked-'))) {
          try { const age = parseInt((await import('fs')).readFileSync(join(dir, f), 'utf8')); if (age < cutoff) (await import('fs')).unlinkSync(join(dir, f)); } catch {}
        }
      } catch {}
      // Spawn background check — exits immediately, never blocks
      const checker = `
        import { readFileSync, existsSync } from 'fs';
        import { join } from 'path';
        import { homedir } from 'os';
        try {
          const localVersion = (existsSync(join(homedir(), 'claudemax', 'VERSION'))
            ? readFileSync(join(homedir(), 'claudemax', 'VERSION'), 'utf8')
            : '0.0.0').trim();
          const res = await fetch('https://raw.githubusercontent.com/Blockchainpreneur/CLAUDEMAX/main/VERSION', { signal: AbortSignal.timeout(4000) });
          if (!res.ok) process.exit(0);
          const remoteVersion = (await res.text()).trim();
          if (remoteVersion && remoteVersion !== localVersion) {
            const Y = '\\x1b[33m', R = '\\x1b[0m', C = '\\x1b[36m', B = '\\x1b[1m';
            process.stderr.write([
              '',
              Y + B + '  ┌─ CLAUDEMAX UPDATE REQUIRED ' + '─'.repeat(24) + '┐' + R,
              Y + '  │' + R + '  Your version : ' + C + localVersion + R + ' '.repeat(Math.max(0, 33 - localVersion.length)) + Y + '│' + R,
              Y + '  │' + R + '  Latest        : ' + C + B + remoteVersion + R + ' (critical fixes) ' + ' '.repeat(Math.max(0, 14 - remoteVersion.length)) + Y + '│' + R,
              Y + '  │' + R + '                                              ' + Y + '│' + R,
              Y + '  │' + R + '  ' + B + 'cd ~/claudemax && git pull && bash install.sh' + R + '  ' + Y + '│' + R,
              Y + B + '  └' + '─'.repeat(50) + '┘' + R,
              '',
            ].join('\\n') + '\\n');
          }
        } catch {}
      `;
      spawn(process.execPath, ['--input-type=module'], {
        detached: true, stdio: ['pipe', 'ignore', process.stderr],
        env: { ...process.env },
      }).stdin.end(checker);
    }
  } catch {}

  // Spin up Ruflo swarm for complex tasks
  if (complexity >= 50 && primary.agents?.length) {
    try {
      const nodeBin = dirname(process.execPath);
      let nvmBin = '';
      try { const v = readFileSync(join(homedir(), '.nvm', 'alias', 'default'), 'utf8').trim().replace(/^v/, ''); nvmBin = join(homedir(), '.nvm', 'versions', 'node', `v${v}`, 'bin'); } catch {}
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
  const W  = 40;           // total box width including borders
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
    const headerFill  = '─'.repeat(Math.max(0, W - 4 - vis(` ${icon} RIPPLE`).length - vis(headerRight).length - 2));
    out.push(` ${C}${icon} RIPPLE${R}  ${headerFill}  ${headerRight}`);
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
  const enrichItems = ENRICHMENTS[primary.id] || [];
  const enrichLine  = enrichItems.length
    ? `ENRICH: production-ready — ${enrichItems.join(', ')}\n`
    : '';

  const toolItems = TOOL_RECS[primary.id] || [];
  const toolsLine = toolItems.length
    ? `TOOLS: ${toolItems.join(' | ')}\n`
    : '';

  if (complexity >= 50 && primary.agents?.length) {
    const agentList = (primary.agents || []).join(', ');
    process.stdout.write(`[CLAUDEMAX RIPPLE] task:${primary.id} model:${tier} complexity:${complexity}%\n`);
    process.stdout.write(`EXECUTE: ${primary.skill} — run NOW, do not wait for user confirmation\n`);
    process.stdout.write(`SPAWN: ${agentList} — parallel via Task tool, run_in_background:true, ALL in ONE message\n`);
    process.stdout.write(`VERIFY: confirm Task tool was called for each agent before proceeding\n`);
    if (enrichLine) process.stdout.write(enrichLine);
    if (toolsLine)  process.stdout.write(toolsLine);
  } else {
    process.stdout.write(`[CLAUDEMAX] task:${primary.id} model:${tier} → ${primary.skill}\n`);
    if (enrichLine) process.stdout.write(enrichLine);
    if (toolsLine)  process.stdout.write(toolsLine);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
