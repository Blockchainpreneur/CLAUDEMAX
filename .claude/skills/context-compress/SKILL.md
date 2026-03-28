# Context Compression Engine

## What This Does
Reduces token usage by 50-70% without losing information. Faster responses, longer effective sessions, lower cost, more work per context window. Every token saved is speed gained.

## Core Compression Rules

### Never repeat what was already said
- Reference previous decisions instead of re-explaining them
- "Same pattern as auth module" not "Here we use the same JWT pattern we established earlier where..."
- "As discussed" not a full re-statement

### Lead with the action, not the explanation
```
SLOW: "I'm going to read the file to understand the structure before making changes..."
FAST: [reads file, makes changes]

SLOW: "Let me explain what I'm about to do. First I will..."
FAST: [does it]
```

### Code without filler comments
```typescript
// SLOW — obvious comment wastes tokens:
// This function calculates the total price
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0); // Sum all prices
}

// FAST — no comments needed, code is self-evident:
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### Compact status updates
```
SLOW: "I have successfully completed the task of reading the file and now I will proceed to..."
FAST: "Done. Moving to X."
```

### Use references not repetition
- For long code blocks already shown: "same structure as above" + diff only
- For established patterns: pattern name only, not full re-statement
- For multi-file changes: show one, say "same pattern in files B, C, D"

## Output Format Rules

### Code responses
- Show only what changed, not entire file (unless full file was requested)
- Use `// ... existing code ...` for unchanged sections
- Only add comments where logic is non-obvious

### Text responses
- One sentence per idea
- Bullets not paragraphs for lists
- No filler: "Great question!", "Certainly!", "I'd be happy to" — delete always
- No restating the question before answering

### Error responses
- State the error
- State the fix
- Done. No narrative.

## Context Window Management

### When context is getting long (>50% full):
- Stop re-reading files already in context
- Reference by filename:line instead of re-quoting
- Use `/compact` or trigger manual compact before starting new major task

### Pre-task compression checklist:
1. Is this information already in context? → Reference it, don't repeat
2. Does the user already know this? → Skip the explanation
3. Is this comment obvious? → Delete it
4. Is this sentence necessary? → If not, cut it

## Token Budget by Task Type
| Task | Target Token Use |
|---|---|
| Simple edit | < 500 tokens |
| Function rewrite | < 1,000 tokens |
| Feature implementation | < 5,000 tokens |
| Architecture design | < 10,000 tokens |
| Full system design | Unlimited (complexity justified) |

## Speed Impact
- 70% token reduction = responses arrive ~2x faster
- Longer effective sessions = fewer context resets = fewer re-explanations
- More parallel operations fit in one message = more concurrency
