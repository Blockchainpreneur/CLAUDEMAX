# Rapid Iteration Loop

## What This Does
Structures every build cycle as a tight write→verify→ship loop. Eliminates wasted cycles. Catches problems at the earliest possible moment. Ships working code faster than any sequential approach.

## The Loop

```
1. PLAN (30 seconds)
   → What's the output? What's the test that proves it works?
   → Decompose into parallel streams
   → Assign streams to agents

2. BUILD (parallel)
   → All agents write simultaneously in isolated worktrees
   → No waiting, no sequential hand-offs

3. VERIFY (automated)
   → Tests run automatically on every file write (PostToolUse hook)
   → Security scan on every .sol file
   → Type check on every .ts file

4. SHIP
   → Merge winning stream
   → Deploy via /ship command
   → Monitor via Sentio/OpenTelemetry

5. LEARN
   → Memory hooks capture what worked
   → Pattern stored for next similar task
   → Loop time decreases with each iteration
```

## Speed Rules Per Phase

### Plan Phase
- Plan in 1-2 sentences max, not paragraphs
- If the plan needs more than 5 bullet points, decompose further
- Assign 1 agent per stream, never 1 agent for everything

### Build Phase
- Start the build before finishing the plan (overlap phases)
- Use existing patterns from memory before inventing new ones
- Write the test first (it's faster — defines the target clearly)
- Use Tier 1/2 models for mechanical tasks, Tier 3 for decisions

### Verify Phase
- Never manually run tests — hooks run them automatically
- If a test fails, fix the specific failure. Don't rewrite the function.
- Security scan results are not optional — fix or document exception

### Ship Phase
- `/ship` handles: test → build → deploy → verify in one command
- Don't ship without monitoring configured
- Canary deploy for anything affecting financial state

### Learn Phase
- Memory hooks capture patterns automatically
- If something took longer than expected, note why in commit message
- Patterns discovered in this session are available next session

## Fast Feedback Signals

### Green signals (continue):
- `forge test` passes in < 30 seconds
- TypeScript compiles without errors
- Slither shows 0 high/critical findings
- Response from deployed contract matches expected

### Red signals (stop and fix):
- Any `forge test` failure — fix before continuing
- Any Slither high/critical finding — fix before deploying
- Any TypeScript error — fix before moving to next file
- Gas cost increase > 20% from baseline — investigate

## Cycle Time Targets

| Task Type | Target Cycle Time |
|---|---|
| Bug fix (single function) | < 5 minutes |
| New feature (single file) | < 15 minutes |
| New feature (multi-file) | < 45 minutes |
| Smart contract (ERC standard) | < 2 hours |
| Protocol design + implementation | < 1 day |
| Full market making strategy | < 3 days |

## Anti-Patterns That Kill Speed

❌ Reading files you don't need to change
❌ Explaining what you're about to do before doing it
❌ Writing code then realizing you don't have the interface
❌ Skipping tests "to save time" (creates 10x more time fixing bugs later)
❌ Using sequential agents when parallel agents would work
❌ Asking for clarification on things that can be inferred from context
❌ Refactoring while building (separate tasks, separate worktrees)
