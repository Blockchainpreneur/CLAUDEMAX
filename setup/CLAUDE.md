# Global Claude Code Configuration

## MEMORY INTEGRATION RULES (Active Every Session)

- At the start of every session, acknowledge that memory has been loaded and mention in one sentence what relevant past context was found for the current project
- Before executing any task involving architecture decisions, check stored memory for past decisions on this project
- After completing any task, confirm that learnings have been saved to memory
- When spawning subagents or using Agent Teams, use Ruflo as the coordination layer
- If a task is similar to something done before in this project, apply the same patterns unless explicitly asked for something different
- Never re-explain context that was already established in a previous session — reference it instead

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
