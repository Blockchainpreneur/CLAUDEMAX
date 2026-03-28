# CLAUDEMAX — The AI Development Operating System

> A complete Claude Code + Ruflo global setup with a Notion-style kanban TUI that visualizes every agent in real time.

---

## One-command install

```bash
curl -fsSL https://raw.githubusercontent.com/Blockchainpreneur/CLAUDEMAX/main/install.sh | bash
```

Or clone and run locally:

```bash
git clone https://github.com/Blockchainpreneur/CLAUDEMAX ~/claudemax
cd ~/claudemax && bash install.sh
```

---

## What's included

| Component | Description |
|---|---|
| **Kanban TUI** | Real-time agent visualization with 7 columns (Thinking → Done) |
| **Ruflo bridge** | Polls hive-mind status every 2s, maps agents to columns automatically |
| **QB Dispatch** | Type a prompt, hit Enter — agents spawn and appear as cards |
| **Memory sidebar** | Shows Ruflo memory patterns for the current project |
| **Session tracking** | Saves cost, time, tokens per session with history |
| **Live preview** | Auto-detects local dev servers on ports 3000/5173/8080 |
| **Deploy button** | One-click Vercel deploy with live output |
| **PII redaction** | Strips wallet addresses, keys, emails before sending to AI |
| **Global hooks** | Memory enrichment, learning, and PII scanning on every tool call |

---

## Stack

- **Claude Code** — AI coding engine
- **Ruflo** — Multi-agent orchestration (up to 60 agents)
- **Context7** — Live library documentation MCP
- **GitHub MCP** — Read/write to your repos directly
- **Supabase MCP** — Database management from Claude
- **Sequential Thinking** — Step-by-step reasoning for complex tasks
- **Playwright** — Browser automation and UI testing
- **Textual** — Python terminal UI framework
- **Rich** — Terminal formatting

---

## Layout

```
┌──────────────┬──────────────────────────────────────────┬──────────────┐
│  CLAUDEMAX   │  🧠 Thinking  ✏️ Designing  ⚙️ Developing │ LIVE PREVIEW │
│  ──────────  │  ───────────  ────────────  ─────────────│ ──────────── │
│  PROJECTS    │  ┌─────────┐  ┌──────────┐  ┌──────────┐ │ localhost:3k │
│  ▶ Econ Mkt  │  │ Agent 1 │  │ Agent 2  │  │ Agent 3  │ │ [Open]      │
│  EconCash    │  │ Planning│  │ Designing│  │ Building │ │ ──────────── │
│  ──────────  │  │ ████ 40%│  │ ██░ 25%  │  │ ████ 70% │ │ DEPLOY      │
│  SESSIONS    │  └─────────┘  └──────────┘  └──────────┘ │ [Vercel]    │
│  Today $0.06 │                                           │ ──────────── │
│  ──────────  │  🧪 Testing  🔍 Reviewing  🚀 Deploying  │ SESSION      │
│  MEMORY      │  (empty)     (empty)       (empty)        │ Cost: $0.06  │
│  order book  │                                           │ Saved: $0.12 │
│  ──────────  │                             ✅ Done       │ Time: 12:34  │
│  💰 $0.06    │              ┌──────────┐                 │              │
│  ⚡ Fast ON  │              │ Done ✓   │                 │              │
└──────────────┴──────────────────────────────────────────┴──────────────┘
│ QB ▶ Describe what to build...                                           │
│ [✨ Feature] [🐛 Fix Bug] [⛓️ Contract] [🚀 Full Build]        [⚡ Go] │
│  Tab: panels  Enter: dispatch  P: preview  D: deploy  R: memory  Q: quit │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Dispatch task from QB prompt |
| `P` | Open live preview in browser |
| `D` | Deploy to Vercel |
| `R` | Refresh Ruflo memory |
| `Q` | Quit |
| `Tab` | Cycle panels |
| `Esc` | Clear focus |

---

## Customization

**Change columns:** Edit `tui/config.json` → `kanban.columns`

**Change colors:** Edit `tui/theme.tcss`

**Change poll rate:** Edit `tui/config.json` → `app.refresh_rate`

**Add projects:** Edit `tui/app.py` → `Sidebar.projects`

**Change max agents:** Edit `ruflo/daemon-state.json` → `daemon.maxAgents`

---

## MCP tokens setup

After install, add your tokens:

```bash
# GitHub
claude mcp add -s user github \
  -e GITHUB_TOKEN=your_token \
  -- npx -y @modelcontextprotocol/server-github

# Supabase
claude mcp add -s user supabase \
  -e SUPABASE_ACCESS_TOKEN=your_token \
  -- npx -y @supabase/mcp-server-supabase@latest
```

Get tokens at:
- GitHub: https://github.com/settings/tokens
- Supabase: https://supabase.com/dashboard/account/tokens

---

## Personal Preferences

After install, paste `setup/claude-preferences.json` into **Claude Desktop → Settings → Personal Preferences** (remove the `_instructions` key first).

---

## License

MIT © CLAUDEMAX contributors
