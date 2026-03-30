# CLAUDEMAX

**A persistent cognitive operating system for Claude Code.**

CLAUDEMAX transforms Claude Code from a stateless terminal assistant into a context-aware, self-routing, visually transparent execution environment. Every prompt is classified, routed, and executed through a defined pipeline. Every response is annotated with a state machine diagram. Memory accumulates across sessions. Safety guards run on every write. The system operates without user intervention.

---

## Architecture

CLAUDEMAX is composed of five layers, each implemented as a lightweight hook in Claude Code's event pipeline:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — Cognitive Router (UserPromptSubmit)              │
│  Classifies prompt against 25 task types. Computes          │
│  complexity score. Selects model tier. Emits routing        │
│  state machine diagram + EXECUTE/SPAWN directives.          │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2 — Safety Guards (PreToolUse)                       │
│  PII redactor: blocks API keys, tokens, wallet addresses.   │
│  Code quality gate: rejects hardcoded secrets, empty catch. │
│  Runs on every Write / Edit / Bash invocation.              │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3 — Event Accumulator (PostToolUse)                  │
│  Writes structured tool events to turn-events.jsonl.        │
│  Tracks: tool type, files modified, commands run.           │
│  Forwards to daemon for long-term session memory.           │
├─────────────────────────────────────────────────────────────┤
│  LAYER 4 — Completion Feedback (Stop)                       │
│  Reads accumulated events. Renders DONE state machine       │
│  diagram with actual task, files, actions, result.          │
│  Writes structured session summary to daemon.               │
├─────────────────────────────────────────────────────────────┤
│  LAYER 5 — Session Context (SessionStart)                   │
│  Reads project memory from daemon. Injects context into     │
│  Claude's working session. Starts Ruflo swarm engine.       │
│  Displays morning brief: focus, last session, open items.   │
└─────────────────────────────────────────────────────────────┘
```

---

## Visual State Machine Protocol

Every interaction produces two diagrams. Both render in the terminal (ANSI color) and are injected into Claude's response as clean ASCII — always visible in every interface without requiring user interaction.

**On input — routing diagram:**

```
 ◆ AUTOPILOT  ─────────────────────  Thinking through strategy  ·  OPUS

┌─[ INPUT ]─────────────────────────────────────────────────────┐
│  "what should our go-to-market strategy be..."               │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌─[ DETECT ]────────────────────────────────────────────────────┐
│  task    strategy                                             │
│  model   OPUS  (most capable)   scope  70%                   │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌─[ SPAWN ]──────────────────────────────────────── parallel ───┐
│  ◆  advisor       giving you honest strategic advice         │
│  ◈  strategist    thinking through the business angle        │
│  ▸  researcher    finding what you need to know              │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌─[ EXECUTE ]───────────────────────────────────────────────────┐
│  /plan-ceo-review  ──►  /office-hours                        │
└───────────────────────────────────────────────────────────────┘
```

**On completion — done diagram:**

```
┌─[ DONE ]──────────────────────────────────────────────────────┐
│  task     strategy planning                                   │
│  files    docs/gtm-strategy.md · research/competitors.md     │
│  actions  edited code(×2) · searched online(×3)              │
│  result   ✓ complete                                         │
└───────────────────────────────────────────────────────────────┘
```

---

## Task Taxonomy

The cognitive router classifies prompts against 25 task types across two domains.

### Entrepreneur / Thinker

| Task | Trigger patterns | Pipeline | Model |
|------|-----------------|----------|-------|
| `brain-dump` | brain dump, I've been thinking, messy thoughts | extract → prioritize → structure → `~/.claudemax/decisions.md` | SONNET |
| `write-content` | write/draft + email/post/memo/thread | draft → /review | SONNET |
| `brainstorm` | brainstorm, what if we, think through | /office-hours → capture | SONNET |
| `decide` | should I, pros and cons, choose between | /office-hours → framework → recommend | SONNET |
| `research` | research, competitors, market size | /browse → analyze → synthesize | SONNET |
| `strategy` | strategy, positioning, GTM, business model | /plan-ceo-review → /office-hours | OPUS |
| `pitch` | pitch, investor, demo day, fundraising deck | /office-hours → /design-consultation → build | OPUS |
| `fundraise` | raise a round, term sheet, cap table | /office-hours → research → draft → /review | OPUS |
| `hire` | first hire, job description, co-founder | /office-hours → draft → /review | SONNET |

### Engineering / Builder

| Task | Pipeline | Model |
|------|----------|-------|
| `bug-fix` | /investigate → fix → /review → /qa | SONNET |
| `new-feature` | /office-hours → /plan-eng-review → build → /review → /qa → /cso → /ship | OPUS |
| `deploy-ship` | /review → /qa → /cso → /ship → /land-and-deploy → /canary | SONNET |
| `design` | /design-consultation → build → /design-review → /qa → /ship | SONNET |
| `security` | /cso | OPUS |
| `refactor` | /investigate → refactor → /review → /qa | SONNET |
| `performance` | /benchmark → optimize → /review | SONNET |
| `investigate` | /investigate → explain + fix | SONNET |
| `planning` | /office-hours → /plan-ceo-review → /plan-eng-review | SONNET |
| `code-review` | /review → /cso | SONNET |
| `autoplan` | /autoplan | OPUS |

Complexity scoring adjusts dynamically: if the current task type appears in the project's session history, complexity is boosted +15%. Large projects (context > 2000 chars) receive an additional +5% boost, upgrading the model tier accordingly.

---

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/Blockchainpreneur/CLAUDEMAX/main/install.sh | bash
```

Or clone and run locally:

```bash
git clone https://github.com/Blockchainpreneur/CLAUDEMAX ~/claudemax
cd ~/claudemax && bash install.sh
```

The installer wires six hooks into `~/.claude/settings.json` and copies all helpers to `~/.claude/helpers/`. Idempotent — safe to re-run. Existing installations are upgraded automatically: the old `rational-router.mjs` and `post-tool-use.mjs` are replaced, not duplicated.

---

## Hook Pipeline

```
Event             File                          Function
─────────────────────────────────────────────────────────────────────
PreToolUse        pii-redactor.mjs              Block secrets on Write/Edit/Bash
PreToolUse        code-quality-gate.mjs         Block hardcoded creds, warn on any/empty-catch
UserPromptSubmit  rational-router-apex.mjs      Classify → route → emit state machine diagram
PostToolUse       post-tool-use-apex.mjs        Accumulate tool events per turn
Stop              task-complete.mjs             Emit DONE diagram + structured session summary
Stop              session-stop.mjs              Post session end to memory daemon
SessionStart      session-start.mjs             Welcome panel
SessionStart      session-start-daemon.mjs      Inject project context from memory daemon
SessionStart      ruflo daemon                  Start swarm engine (60+ agents)
```

All hooks exit 0 unconditionally. Claude never waits on them.

---

## CLAUDE.md — Global Configuration

After install, append the following to `~/.claude/CLAUDE.md`. This is the exact configuration in production — copy it verbatim:

```markdown
## Visual Protocol — NON-NEGOTIABLE, always on

When your context contains `[CLAUDEMAX DISPLAY]...[/CLAUDEMAX DISPLAY]`:
output that block **verbatim** as the **very first thing** in your response.
No preamble. No modification. Just the block exactly as-is.

After every response where you used one or more tools, append this diagram
using real information from what you actually did:

┌─[ DONE ]────────────────────────────────────────────────┐
│  task     <task label from CLAUDEMAX context>           │
│  files    <files you edited/wrote, or none>             │
│  actions  <e.g. edited code · ran commands · read files>│
│  result   ✓ complete                                    │
└────────────────────────────────────────────────────────┘

If your context contains `[CLAUDEMAX DONE]...[/CLAUDEMAX DONE]`:
output that block verbatim **at the end** of your response instead of
generating a new one.

## Global Behavioral Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing an existing file to creating a new one
- NEVER save working files or tests to the root folder
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files

## Security Rules

- NEVER hardcode API keys, secrets, or credentials in source files
- NEVER run curl | bash from unverified URLs
- Always validate user input at system boundaries
- Always sanitize file paths to prevent directory traversal

## Active Hooks (Autopilot Stack)

- **rational-router-apex** — UserPromptSubmit: classifies task, emits state machine + directive
  - Trivial (<15%): silent
  - Medium (15–49%): compact routing box with pipeline
  - Complex (50%+): full state machine + EXECUTE + SPAWN + VERIFY
- **pii-redactor** — PreToolUse on Write/Edit/Bash: blocks secrets, API keys, credentials
- **code-quality-gate** — PreToolUse on Write/Edit: blocks hardcoded secrets, warns on debug/any/empty-catch
- **post-tool-use-apex** — PostToolUse: accumulates tool events for completion diagram
- **task-complete** — Stop: renders DONE diagram, writes structured memory summary
- **Ruflo daemon** — SessionStart: starts swarm engine (60+ specialized agents, vector memory)

## Agent Teams & Swarm

- CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 is active globally
- Default topology: hierarchical-mesh with max 15 agents
- CLAUDEMAX coordinates all multi-agent tasks
- Use specialized strategy for clear role boundaries

## gstack — AI Software Factory

gstack is installed at `~/.claude/skills/gstack`. Use these skills for all dev work.

### Sprint Workflow
1. `/office-hours`        → product strategy + design doc
2. `/plan-ceo-review`     → scope + direction rethink
3. `/plan-eng-review`     → architecture + testing strategy
4. `/plan-design-review`  → design audit (0–10 ratings)
5. `/design-consultation` → full design system creation
6. `/review`              → code review with auto-fixes
7. `/investigate`         → root-cause debugging
8. `/design-review`       → design audit + implementation
9. `/qa`                  → testing with bug fixes
10. `/qa-only`            → bug reporting only
11. `/cso`                → security audit (OWASP + STRIDE)
12. `/ship`               → PR creation + testing
13. `/land-and-deploy`    → merge, deploy, verify
14. `/canary`             → post-deploy monitoring
15. `/benchmark`          → performance baseline comparison
16. `/document-release`   → documentation updates
17. `/retro`              → team retrospective analysis

### When to use gstack

| Task | Path |
|------|------|
| 1–3 file edits, no logic change | Edit directly |
| Bug fix | `/investigate` → fix → `/review` → `/qa` |
| New feature | `/office-hours` → `/plan-eng-review` → build → `/review` → `/qa` → `/cso` → `/ship` |
| UI/design | `/design-consultation` → build → `/design-review` → `/qa` → `/ship` |
| Security | `/cso` first |
| Deploy | `/review` → `/qa` → `/cso` → `/ship` → `/land-and-deploy` → `/canary` |
| Large changes | `/autoplan` |
| Destructive ops | `/careful` first |

### Non-negotiable rules
- NEVER ship without `/review` + `/qa` + `/cso`
- After deploy: always `/canary` then `/retro`
- Update: `/gstack-upgrade`

## UI/Design (activate only when building UI)

Full specs: `~/.claude/design-system.md` · `~/.claude/animation-system.md`

**Stack**: Tailwind v4 + shadcn/ui (zinc) + Radix UI + Inter + lucide-react + Motion.dev + GSAP + Lenis
**MCPs**: Magic UI (`magicuidesign-mcp`) · shadcn (`shadcn`) · visual QA (`playwright`)
**Rules**: CSS tokens always · zinc scale · 4px grid · dark mode from day one · multi-layer shadows
**References**: linear.app · vercel.com/dashboard · stripe.com · mercury.com
```

---

## Memory System

Session memory is stored at `~/.claudemax/contexts/{project-slug}.md`. The daemon accumulates structured tool events per session. On session end, a summary is written. On the next session start, context is injected automatically — Claude opens each session knowing what was built, decided, and what is outstanding.

**Optional: set a vision file** to ground every session in your north star:

```bash
node ~/.claude/helpers/vision-setup.mjs
```

Creates `~/.claudemax/vision.md` with your thesis, 90-day goal, weekly focus, and current bets. Injected at every session start alongside the morning brief.

---

## MCP Servers

```bash
# GitHub
claude mcp add -s user github \
  -e GITHUB_TOKEN=your_token \
  -- npx -y @modelcontextprotocol/server-github

# Supabase
claude mcp add -s user supabase \
  -e SUPABASE_ACCESS_TOKEN=your_token \
  -- npx -y @supabase/mcp-server-supabase@latest

# Context7 (live library docs)
claude mcp add -s user context7 \
  -- npx -y @upstash/context7-mcp@latest

# Playwright (browser automation)
claude mcp add -s user playwright \
  -- npx -y @playwright/mcp@latest
```

---

## Requirements

- macOS or Linux
- Node.js ≥ 18
- Claude Code CLI — `npm install -g @anthropic-ai/claude-code`
- Bun — `curl -fsSL https://bun.sh/install | bash`

---

## License

MIT
