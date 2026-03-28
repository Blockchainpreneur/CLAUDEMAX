# CLAUDEMAX — Project Configuration

## Behavioral Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation or README files unless explicitly requested
- NEVER save working files or tests to the root folder
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- Never continuously check status after spawning a swarm — wait for results

## Runtime & Stack Defaults

- **Bun v1.0+** — primary runtime for ALL projects (Node.js fallback only on Windows)
- **TypeScript** — default language for all new code
- **Supabase** — database, auth, storage
- **Playwright** — browser automation + E2E testing
- **GitHub Actions** — CI/CD (never run builds/tests locally — push and let CI validate)

## File Organization

- `/src` — source code
- `/tests` — test files
- `/docs` — documentation
- `/config` — configuration
- `/scripts` — utility scripts

## gstack Integration (Always Active)

gstack is at `~/.claude/skills/gstack`. Every dev task routes through it.

### Decision Tree — which path to take

**Simple task** (1-3 file edits, no logic change):
→ Edit directly → done. No gstack needed.

**Bug fix / debug**:
→ `/investigate` → fix → `/review` → `/qa`

**New feature**:
→ `/office-hours` → `/plan-eng-review` → build → `/review` → `/qa` → `/cso` → `/ship`

**UI/design work**:
→ `/design-consultation` → build → `/design-review` → `/qa` → `/ship`

**Security concern**:
→ `/cso` immediately, before anything else

**Deploy/ship**:
→ `/review` → `/qa` → `/cso` → `/ship` → `/land-and-deploy` → `/canary`

**Post-deploy**:
→ `/canary` → `/retro`

**Web browsing** (any URL, any site):
→ `/browse [url]` — ALWAYS. Never simulate browser interactions.

### Non-negotiable gstack rules
- NEVER ship without `/review` + `/qa` + `/cso` in sequence
- NEVER browse the web without `/browse`
- `/autoplan` for large changes — triggers full pipeline automatically
- `/careful` before any destructive operation (rm, DROP TABLE, force push)

## Parallelism — 1 Message = All Related Operations

- ALL independent reads/writes/edits in ONE message
- ALL agent spawns in ONE message with `run_in_background: true`
- After spawning agents: STOP — wait for ALL results before continuing
- Never poll or check agent status — trust them to return

## Swarm Config

- Topology: hierarchical, max 8 agents, strategy: specialized
- Task tool handles execution; CLI handles coordination
- Shared memory namespace across all agents in a session

## Security

- NEVER hardcode API keys, secrets, or credentials
- NEVER commit .env files
- Always validate input at system boundaries
- Always sanitize file paths

## UI/Design (activate only for UI tasks)

Full rules in `~/.claude/design-system.md` and `~/.claude/animation-system.md`.

**Stack**: Tailwind v4 + shadcn/ui (zinc) + Radix UI + Inter + lucide-react + Motion.dev + GSAP + Lenis
**Tokens always** — never raw hex. **Zinc scale**. **4px grid**. **Dark mode from day one**.
**References**: linear.app · vercel.com/dashboard · stripe.com · mercury.com
