# CLAUDEMAX — Project Configuration

## Behavioral Rules (Always Enforced)

- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested
- NEVER save working files, text/mds, or tests to the root folder
- Never continuously check status after spawning a swarm — wait for results
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files

## File Organization

- NEVER save to root folder — use the directories below
- Use `/src` for source code files
- Use `/tests` for test files
- Use `/docs` for documentation and markdown files
- Use `/config` for configuration files
- Use `/scripts` for utility scripts
- Use `/examples` for example code

## Project Architecture

- Follow Domain-Driven Design with bounded contexts
- Keep files under 500 lines
- Use typed interfaces for all public APIs
- Prefer TDD London School (mock-first) for new code
- Use event sourcing for state changes
- Ensure input validation at system boundaries

### Project Config

- **Topology**: hierarchical-mesh
- **Max Agents**: 15
- **Memory**: hybrid
- **HNSW**: Enabled
- **Neural**: Enabled

## Speed Execution Rules (Always Active)

These rules fire on every task. They are not optional.

- **Parallel first**: All independent operations in ONE message — reads, writes, agents, bash commands
- **Act before explaining**: Never narrate what you're about to do — just do it
- **Route by complexity**: Mechanical tasks → Tier 1 (instant). Simple tasks → Tier 2 (Haiku). Complex → Tier 3 (Sonnet/Opus)
- **Compress output**: No filler, no restatements, no obvious comments in code
- **Worktree agents**: When 2+ independent streams exist → spawn parallel agents in isolated git worktrees
- **Persona switching**: Auto-activate specialist persona based on task (`--architect`, `--security`, `--quant`, `--blockchain`, `--performance`)
- **Rapid loop**: write → auto-verify (hooks) → fix → ship. Never manual test runs.
- **Reference don't repeat**: Already-established context gets a reference, not a re-explanation

## Rapid Deployment Commands

These commands are part of CLAUDEMAX's built-in rapid deployment toolkit (includes [gstack](https://github.com/garrytan/gstack) by Garry Tan / YC):

### Runtime & Language
- **Bun v1.0+** — primary runtime for all projects (Node.js fallback on Windows only)
- **TypeScript** — default language for all new code

### Infrastructure Defaults
- **Supabase** — database, auth, and storage backend
- **Playwright** — browser automation and end-to-end testing
- **GitHub Actions** — CI/CD pipeline

### gstack Slash Commands (28 built-in skills)

| Category | Commands |
|---|---|
| Planning | `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/autoplan` |
| Development | `/ship`, `/review`, `/investigate`, `/land-and-deploy` |
| QA & Testing | `/qa`, `/qa-only`, `/benchmark`, `/canary` |
| Security | `/cso` (OWASP + STRIDE audits) |
| Browser | `/browse`, `/connect-chrome`, `/setup-browser-cookies` |
| Safety | `/careful`, `/freeze`, `/guard`, `/unfreeze` |
| Utilities | `/codex`, `/retro`, `/setup-deploy`, `/gstack-upgrade` |

- Always use **Bun** instead of npm/node for new projects
- Use `/cso` for security review before any deployment
- Use `/qa` after feature completion — never run tests locally
- Use `/ship` for end-to-end deploy coordination

## Autopilot Mode (Always On)

- **All tool permissions pre-approved** — no prompts for Bash, Read, Write, Edit, Task, Agent, WebFetch, MCP
- Hard deny: `.env` and `.env.*` are never read (secrets protection)
- Applies globally across all projects

## Build & Test

All builds and tests run via **GitHub CI/CD — never run builds or tests locally**.

- NEVER run `npm run build`, `npm test`, or `npm run lint` in the terminal
- Builds are validated automatically via GitHub Actions on push/PR
- Monitor CI status on GitHub to verify correctness
- Do not block commits on local build results — push and let CI validate

## Security Rules

- NEVER hardcode API keys, secrets, or credentials in source files
- NEVER commit .env files or any file containing secrets
- Always validate user input at system boundaries
- Always sanitize file paths to prevent directory traversal
- Run `npx @claude-flow/cli@latest security scan` after security-related changes

## Concurrency: 1 MESSAGE = ALL RELATED OPERATIONS

- All operations MUST be concurrent/parallel in a single message
- Use Claude Code's Task tool for spawning agents, not just MCP
- ALWAYS batch ALL todos in ONE TodoWrite call (5-10+ minimum)
- ALWAYS spawn ALL agents in ONE message with full instructions via Task tool
- ALWAYS batch ALL file reads/writes/edits in ONE message
- ALWAYS batch ALL Bash commands in ONE message

## Swarm Orchestration

- MUST initialize the swarm using CLI tools when starting complex tasks
- MUST spawn concurrent agents using Claude Code's Task tool
- Never use CLI tools alone for execution — Task tool agents do the actual work
- MUST call CLI tools AND Task tool in ONE message for complex work

### 3-Tier Model Routing (ADR-026)

| Tier | Handler | Latency | Cost | Use Cases |
|------|---------|---------|------|-----------|
| **1** | Agent Booster (WASM) | <1ms | $0 | Simple transforms (var→const, add types) — Skip LLM |
| **2** | Haiku | ~500ms | $0.0002 | Simple tasks, low complexity (<30%) |
| **3** | **Opus 4.6** (Max) | 2-5s | $0.015 | Complex reasoning, architecture, security, DeFi (>30%) |

- Always check for `[AGENT_BOOSTER_AVAILABLE]` or `[TASK_MODEL_RECOMMENDATION]` before spawning agents
- Use Edit tool directly when `[AGENT_BOOSTER_AVAILABLE]`

## Swarm Configuration & Anti-Drift

- ALWAYS use hierarchical topology for coding swarms
- Keep maxAgents at 6-8 for tight coordination
- Use specialized strategy for clear role boundaries
- Use `raft` consensus for hive-mind (leader maintains authoritative state)
- Run frequent checkpoints via `post-task` hooks
- Keep shared memory namespace for all agents

```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

## Swarm Execution Rules

- ALWAYS use `run_in_background: true` for all agent Task calls
- ALWAYS put ALL agent Task calls in ONE message for parallel execution
- After spawning, STOP — do NOT add more tool calls or check status
- Never poll TaskOutput or check swarm status — trust agents to return
- When agent results arrive, review ALL results before proceeding

## V3 CLI Commands

### Core Commands

| Command | Subcommands | Description |
|---------|-------------|-------------|
| `init` | 4 | Project initialization |
| `agent` | 8 | Agent lifecycle management |
| `swarm` | 6 | Multi-agent swarm coordination |
| `memory` | 11 | AgentDB memory with HNSW search |
| `task` | 6 | Task creation and lifecycle |
| `session` | 7 | Session state management |
| `hooks` | 17 | Self-learning hooks + 12 workers |
| `hive-mind` | 6 | Byzantine fault-tolerant consensus |

### Quick CLI Examples

```bash
npx @claude-flow/cli@latest init --wizard
npx @claude-flow/cli@latest agent spawn -t coder --name my-coder
npx @claude-flow/cli@latest swarm init --v3-mode
npx @claude-flow/cli@latest memory search --query "authentication patterns"
npx @claude-flow/cli@latest doctor --fix
```

## Available Agents (60+ Types)

### Core Development
`coder`, `reviewer`, `tester`, `planner`, `researcher`

### Specialized
`security-architect`, `security-auditor`, `memory-specialist`, `performance-engineer`

### Swarm Coordination
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`

### GitHub & Repository
`pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`

### SPARC Methodology
`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`

## Memory Commands Reference

```bash
# Store (REQUIRED: --key, --value; OPTIONAL: --namespace, --ttl, --tags)
npx @claude-flow/cli@latest memory store --key "pattern-auth" --value "JWT with refresh" --namespace patterns

# Search (REQUIRED: --query; OPTIONAL: --namespace, --limit, --threshold)
npx @claude-flow/cli@latest memory search --query "authentication patterns"

# List (OPTIONAL: --namespace, --limit)
npx @claude-flow/cli@latest memory list --namespace patterns --limit 10

# Retrieve (REQUIRED: --key; OPTIONAL: --namespace)
npx @claude-flow/cli@latest memory retrieve --key "pattern-auth" --namespace patterns
```

## Quick Setup

```bash
claude mcp add claude-flow -- npx -y @claude-flow/cli@latest
npx @claude-flow/cli@latest daemon start
npx @claude-flow/cli@latest doctor --fix
```

## Claude Code vs CLI Tools

- Claude Code's Task tool handles ALL execution: agents, file ops, code generation, git
- CLI tools handle coordination via Bash: swarm init, memory, hooks, routing
- NEVER use CLI tools as a substitute for Task tool agents

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues
