# CLAUDEMAX — Global Claude Code Configuration

## MEMORY INTEGRATION RULES (Active Every Session)

- At the start of every session, acknowledge that memory has been loaded and mention in one sentence what relevant past context was found for the current project
- Before executing any task involving architecture decisions, check stored memory for past decisions on this project
- After completing any task, confirm that learnings have been saved to memory
- When spawning subagents or using Agent Teams, use Ruflo as the coordination layer
- If a task is similar to something done before in this project, apply the same patterns unless explicitly asked for something different
- Never re-explain context that was already established in a previous session — reference it instead

## Speed Execution Rules (Always Active)

- **Parallel first**: All independent operations in ONE message
- **Act before explaining**: Never narrate — just do it
- **Route by complexity**: Mechanical → Tier 1 instant. Simple → Tier 2 Haiku. Complex → Tier 3 Opus
- **Compress output**: No filler, no restatements, no obvious code comments
- **Worktree agents**: 2+ independent streams → parallel agents in isolated git worktrees
- **Persona switching**: Auto-activate `--architect`, `--security`, `--quant`, `--blockchain`, `--performance` by task type
- **Reference don't repeat**: Already-established context gets a reference, not a re-explanation

## Rapid Deployment Toolkit

Part of CLAUDEMAX. Includes [gstack](https://github.com/garrytan/gstack) (Garry Tan / YC) rapid deployment commands:

- **Runtime**: Bun v1.0+ (Node.js fallback Windows only)
- **Language**: TypeScript by default
- **Backend**: Supabase (DB, auth, storage)
- **Testing**: Playwright (browser + E2E)
- **CI/CD**: GitHub Actions
- **28 slash commands**: `/ship`, `/review`, `/qa`, `/cso`, `/investigate`, `/autoplan`, `/benchmark`, `/canary`, and more
- Always use Bun, never npm/node for new projects
- Use `/cso` before any deployment (OWASP + STRIDE security scan)
- Use `/qa` after features — never run tests locally

## Build & Environment

- NEVER run local builds — all builds and tests execute in GitHub CI/CD
- NEVER run `npm run build`, `npm test`, or `npm run lint` locally
- Default environment is cloud/remote — not local machine
- Push to branch and let GitHub Actions validate correctness

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

## Memory & Learning System

- Memory hooks fire automatically on every session (SessionStart, Stop, UserPromptSubmit, PostToolUse)
- Patterns are stored in .claude-flow/data/learned-patterns.json per project
- Session memory is synced via auto-memory-hook.mjs on session end
- All hooks are non-blocking — they enhance but never delay Claude Code

## Agent Teams & Swarm

- CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 is active globally
- Default topology: hierarchical-mesh with max 15 agents
- Ruflo coordinates all multi-agent tasks
- Use specialized strategy for clear role boundaries
