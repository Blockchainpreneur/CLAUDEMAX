# CLAUDEMAX

> The complete AI development operating system — RuFlo V3 swarm orchestration + gstack + global Claude Code setup, unified into one open-source environment.

CLAUDEMAX is the compound global setup that transforms Claude Code into a full engineering team. It combines:

- **RuFlo V3** — hierarchical multi-agent swarms, hybrid HNSW memory, self-learning hooks, 15-agent orchestration
- **gstack** (by Garry Tan / YC) — Bun runtime, TypeScript, Supabase, Playwright, 28 slash command skills
- **Global Claude hooks** — memory enrichment, PII redaction, pattern learning, session restore
- **60+ specialized agents** — coders, reviewers, security architects, performance engineers, and more
- **MCP server ecosystem** — claude-flow, context7, playwright, supabase, sequential-thinking, GitHub

One install. Every project. Maximum velocity.

---

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/Blockchainpreneur/CLAUDEMAX/main/install.sh | bash
```

What gets installed:
- Claude Code (global)
- Bun runtime
- RuFlo / claude-flow orchestration daemon
- gstack skills (28 slash commands)
- Global Claude hooks (memory, PII, learning)
- MCP servers (context7, playwright, supabase, sequential-thinking)

---

## What's Inside

### RuFlo V3 Swarm Engine
- Up to 15 parallel agents in hierarchical-mesh topology
- Byzantine fault-tolerant consensus (hive-mind mode)
- HNSW vector memory with semantic search
- Self-learning from every session (patterns, decisions, code)
- 10+ background daemon workers (audit, optimize, document, benchmark)

### gstack Integration
- **Bun v1.0+** — fastest JS runtime, replaces npm/node
- **TypeScript** — default for all new projects
- **Supabase** — DB, auth, storage out of the box
- **Playwright** — real browser testing, no mocks
- **28 slash commands**: `/ship`, `/review`, `/qa`, `/cso`, `/investigate`, `/autoplan`, `/canary`, `/benchmark`, `/freeze`, `/guard` and more

### Global Claude Config
- Memory hooks fire every session — no repeated context
- PII redactor runs on every tool use
- 3-tier model routing (WASM booster → Haiku → Sonnet/Opus)
- Agent Teams with mailbox coordination
- Security scanning, ADR auto-generation, DDD tracking

---

## $5,000,000 Contributor Grant Program

CLAUDEMAX runs an open grant program. **Remarkable contributions can earn up to $5,000,000 USD** in grant funding.

### How It Works

Contributions are evaluated on two dimensions — both must rate the contribution as **remarkable**:

| Evaluator | Weight | What They Assess |
|---|---|---|
| **Community** | 50% | Stars, forks, usage, PRs built on top, ecosystem impact |
| **Owner** | 50% | Technical depth, architectural alignment, transformative value |

A contribution must be rated remarkable by **both** community and owner to unlock grant consideration. Either alone is not sufficient.

### Grant Tiers

| Rating | Grant Range | Examples |
|---|---|---|
| **Remarkable** | $50K – $250K | Significant agent, memory system, new MCP integration |
| **Transformative** | $250K – $1M | New orchestration topology, breakthrough performance, major new capability |
| **Foundational** | $1M – $5M | Core architectural innovation that changes what CLAUDEMAX can do at scale |

### What Qualifies

- New agent types that the community immediately adopts
- Memory or learning systems that measurably improve multi-session intelligence
- New swarm coordination protocols with proven fault tolerance
- gstack skill extensions with real-world demonstrated results
- Security or performance improvements with benchmark evidence
- Cross-project integrations that multiply developer output

### What Does NOT Qualify

- Documentation-only PRs
- Minor bug fixes
- Cosmetic changes
- Improvements without measurable impact

### How to Submit

1. Fork this repo and build your contribution
2. Open a PR with: description, benchmarks/evidence, and impact statement
3. Community review period: minimum 30 days
4. Owner review follows community rating
5. Grant decisions are made within 90 days of PR merge

> Grants are paid in USD via wire transfer or crypto (USDC/ETH). Contributions become MIT licensed upon merge.

---

## Folder Structure

```
CLAUDEMAX/
├── install.sh              # One-command installer
├── CLAUDE.md               # Project-level Claude rules
├── setup/
│   ├── CLAUDE.md           # Global Claude rules (→ ~/.claude/CLAUDE.md)
│   ├── settings.json       # Global Claude settings with hooks
│   ├── mcp-config.json     # MCP server definitions
│   └── claude-preferences.json
├── .claude/
│   └── settings.json       # Project-level Claude + RuFlo settings
├── .mcp.json               # claude-flow MCP server
└── scripts/
    ├── update.sh
    └── ram-manager.sh
```

---

## Architecture

```
Claude Code
    │
    ├── RuFlo V3 (hierarchical-mesh, 15 agents)
    │       ├── Swarm coordinator
    │       ├── Memory (HNSW + hybrid backend)
    │       ├── Hook system (17 hook types)
    │       └── Daemon workers (10 background tasks)
    │
    ├── gstack skills (28 slash commands)
    │       ├── /ship → end-to-end deployment
    │       ├── /cso → OWASP + STRIDE security
    │       ├── /qa → Playwright browser tests
    │       └── /review → multi-AI code review
    │
    └── MCP Servers
            ├── claude-flow (coordination)
            ├── context7 (library docs)
            ├── playwright (browser)
            ├── supabase (database)
            └── sequential-thinking (reasoning)
```

---

## Contributing

See the **$5M Grant Program** above.

All contributions must:
- Follow the existing code style
- Include evidence of impact (benchmarks, demos, usage data)
- Pass security review (`/cso` scan)
- Have tests where applicable

PRs that don't follow the contribution guidelines will be closed without review.

---

## License

MIT — free to use, modify, and distribute.

---

## Credits

- **RuFlo V3** — built on [claude-flow](https://github.com/ruvnet/claude-flow) by ruvnet
- **gstack** — by [Garry Tan](https://github.com/garrytan/gstack) (YC)
- **Claude Code** — by Anthropic

---

*CLAUDEMAX: One setup. Every project. Maximum velocity.*
