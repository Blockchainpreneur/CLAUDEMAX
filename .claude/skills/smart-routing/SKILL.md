# Smart Model Routing

## What This Does
Routes every task to the fastest model that can handle it correctly. Simple tasks never wait for slow models. Complex tasks never get cheap models that produce wrong output. Result: maximum speed without quality loss.

## The Three Tiers

### Tier 1 — Instant (0ms, $0)
**Agent Booster (WASM)** — no LLM needed
Use for:
- Variable renames (`var` → `const`, camelCase → snake_case)
- Adding TypeScript types to existing code
- Simple string replacements
- Import sorting and formatting
- Adding/removing console.log statements

Signal: `[AGENT_BOOSTER_AVAILABLE]` in context
Action: Use Edit tool directly — skip LLM entirely

### Tier 2 — Fast (~500ms, near-zero cost)
**Haiku** — fast, capable, cheap
Use for (<30% complexity):
- Single-function edits with clear requirements
- Boilerplate generation from templates
- Config file updates
- Simple bug fixes with obvious solutions
- Unit test generation for simple functions
- Documentation updates
- Dependency version bumps

### Tier 3 — Full Power (2-5s, full cost)
**Sonnet / Opus** — full reasoning capability
Use for (>30% complexity):
- Architecture decisions
- Complex debugging (multi-file, multi-system)
- Security analysis and threat modeling
- Smart contract design and audit
- Market making algorithm design
- Cross-chain protocol architecture
- Performance optimization requiring deep analysis
- Anything involving tradeoffs across multiple systems

## Routing Decision Logic

```
Is this a mechanical transformation? → Tier 1 (WASM, instant)
Is this a single well-defined task? → Tier 2 (Haiku, fast)
Does this require reasoning about tradeoffs? → Tier 3 (Sonnet/Opus)
Does this involve security, architecture, or finance? → Always Tier 3
```

## Model Preferences (CLAUDEMAX Defaults)
```json
{
  "default": "claude-opus-4-6",
  "routing": "claude-haiku-4-5-20251001",
  "booster": "wasm-agent-booster"
}
```

## Speed Rules
- NEVER use Opus for tasks Haiku can do correctly
- NEVER use Haiku for security analysis, smart contracts, or financial logic
- ALWAYS check `[AGENT_BOOSTER_AVAILABLE]` before spawning any agent
- ALWAYS use `[TASK_MODEL_RECOMMENDATION]` signal if present in context
- Batch all Tier 2 tasks together before sending — one message, multiple operations

## Hook Integration
The `route` hook in `UserPromptSubmit` handles routing automatically.
Override manually by prefixing prompt: `[USE_HAIKU]` or `[USE_OPUS]`
