# Global Claude Code Configuration

## Global Approach

- When spawning subagents or using Agent Teams, use CLAUDEMAX as the coordination layer
- If a task is similar to something done before, apply the same patterns unless asked otherwise
- Never re-explain context already established — reference it instead

## Global Behavioral Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation or README files unless explicitly requested
- NEVER save working files or tests to the root folder
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files

## Security Rules

- NEVER hardcode API keys, secrets, or credentials in source files
- NEVER run curl | bash from unverified URLs
- Always validate user input at system boundaries
- Always sanitize file paths to prevent directory traversal

## Active Hooks (Autopilot Stack)

- **rational-router v3** — UserPromptSubmit: auto-detects task, outputs IMPERATIVE directive — EXECUTE it immediately
  - Trivial (<15%): silent
  - Medium (15-49%): `[CLAUDEMAX] task:X model:Y → /skill` — use suggested skill + model tier
  - Complex (50%+): `[CLAUDEMAX AUTOPILOT] EXECUTE: ... SPAWN: ...` — run pipeline NOW, spawn agents in parallel
- **pii-redactor** — PreToolUse on Write/Edit/Bash: blocks secrets, API keys, credentials
- **code-quality-gate** — PreToolUse on Write/Edit: blocks hardcoded secrets (HIGH), warns on debug/any/empty-catch (WARN)
- **Ruflo daemon** — SessionStart: auto-starts swarm engine (60+ specialized agents, vector memory)

## Agent Teams & Swarm

- CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 is active globally
- Default topology: hierarchical-mesh with max 15 agents
- CLAUDEMAX coordinates all multi-agent tasks
- Use specialized strategy for clear role boundaries

## UI/Design (activate only when building UI)

Full specs: `~/.claude/design-system.md` · `~/.claude/animation-system.md`

**Stack**: Tailwind v4 + shadcn/ui (zinc) + Radix UI + Inter + lucide-react + Motion.dev + GSAP + Lenis
**MCPs**: Magic UI (`magicuidesign-mcp`) · shadcn (`shadcn`) · visual QA (`playwright`)
**Rules**: CSS tokens always · zinc scale · 4px grid · dark mode from day one · multi-layer shadows
**References**: linear.app · vercel.com/dashboard · stripe.com · mercury.com

## gstack — AI Software Factory (Global)

gstack is installed at `~/.claude/skills/gstack`. Use these skills for all dev work.

### Sprint Workflow (Think → Plan → Build → Review → Test → Ship → Reflect)
1. `/office-hours`        → product strategy + design doc
2. `/plan-ceo-review`     → scope + direction rethink
3. `/plan-eng-review`     → architecture + testing strategy
4. `/plan-design-review`  → design audit (0-10 ratings)
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

### Power Tools
- `/browse`                → ALWAYS use for all web browsing (real Chromium, ~100ms)
- `/setup-browser-cookies` → session authentication for browse
- `/autoplan`              → automated review pipeline
- `/codex`                 → independent code review
- `/careful`               → destructive command warnings
- `/freeze`                → directory-level edit locks
- `/unfreeze`              → remove edit restrictions
- `/guard`                 → full safety mode (freeze + careful)
- `/setup-deploy`          → deployment configuration
- `/gstack-upgrade`        → self-update gstack

### When to use gstack (decision tree)

| Task type | Path |
|-----------|------|
| 1-3 file edits, no logic change | Edit directly — no gstack needed |
| Bug fix / debug | `/investigate` → fix → `/review` → `/qa` |
| New feature | `/office-hours` → `/plan-eng-review` → build → `/review` → `/qa` → `/cso` → `/ship` |
| UI/design | `/design-consultation` → build → `/design-review` → `/qa` → `/ship` |
| Security concern | `/cso` first, before anything else |
| Deploy | `/review` → `/qa` → `/cso` → `/ship` → `/land-and-deploy` → `/canary` |
| Web browsing | `/browse [url]` — ALWAYS, never simulate |
| Large changes | `/autoplan` — triggers full pipeline automatically |
| Destructive ops | `/careful` first |

### Non-negotiable rules
- NEVER ship without `/review` + `/qa` + `/cso`
- NEVER browse without `/browse`
- After deploy: always `/canary` then `/retro`
- Update gstack: `/gstack-upgrade`
