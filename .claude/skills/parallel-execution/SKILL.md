# Parallel Execution Engine

## What This Does
Runs 4-5 independent workstreams simultaneously in isolated git worktrees. Each agent gets its own branch and working directory — no conflicts, no waiting. Results merge when complete. This is the single highest shipping velocity multiplier available.

## When to Activate
Activate automatically when any task can be split into 2+ independent workstreams:
- Multiple features being built simultaneously
- Research + implementation running in parallel
- Tests being written while code is being written
- Security review running while new features are built
- Documentation being written while code ships

## How to Use Git Worktrees

### Spawn parallel workstreams
```bash
# Create isolated worktrees for each agent
git worktree add -b feat/agent-1 ../worktree-1
git worktree add -b feat/agent-2 ../worktree-2
git worktree add -b feat/agent-3 ../worktree-3

# Each agent works in its own directory — zero conflicts
```

### Coordinate agents
```
Agent 1 → worktree-1/ → feature A
Agent 2 → worktree-2/ → feature B
Agent 3 → worktree-3/ → tests for A+B
Agent 4 → worktree-4/ → security review
```

### Merge winning results
```bash
# Cherry-pick the best implementation
git cherry-pick <winning-commit>

# Or merge feature branches
git merge feat/agent-1 feat/agent-2

# Clean up worktrees
git worktree remove ../worktree-1
git worktree prune
```

## Task Decomposition Rules

Before any task starts, decompose into parallel streams:
```
SEQUENTIAL (wrong):
  Step 1 → Step 2 → Step 3 → Step 4

PARALLEL (right):
  Stream A: Steps 1+2 simultaneously
  Stream B: Steps 3+4 simultaneously
  Merge: Combine A+B results
```

## Parallel Tool Call Rules

ALWAYS batch independent operations in ONE message:
- Read multiple files → one message with all Read calls
- Multiple file writes → one message with all Write calls
- Multiple Bash commands that don't depend on each other → one message
- Multiple agent spawns → one message, ALL agents, `run_in_background: true`

NEVER do this:
```
Read file A → wait → Read file B → wait → Read file C
```

ALWAYS do this:
```
Read file A + Read file B + Read file C (simultaneously)
```

## Speed Rules
- Spawn agents BEFORE reading all files — start early
- Assign the largest/most complex stream to the most capable agent
- Never block on agent results unless the next step literally requires them
- When agents return, synthesize ALL results before taking next action
- Prefer 4 agents doing 25% each over 1 agent doing 100% sequentially

## Swarm Init Command
```bash
npx @claude-flow/cli@latest swarm init \
  --topology hierarchical \
  --max-agents 8 \
  --strategy specialized \
  --parallel
```
