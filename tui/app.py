#!/usr/bin/env python3
"""
econ.vibe — The AI Development Operating System
A Notion-style kanban TUI that visualizes Claude Code + Ruflo agents in real time.
"""
import asyncio
import json
import socket
import subprocess
import time
from pathlib import Path
from typing import Optional

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Container, Horizontal, Vertical, ScrollableContainer
from textual.screen import Screen
from textual.widgets import (
    Footer, Header, Input, Label, LoadingIndicator,
    ProgressBar, Static, Button,
)
from textual.reactive import reactive
from textual.timer import Timer
from rich.text import Text

from ruflo_bridge import RufloBridge, AgentState
from agent_tracker import AgentTracker
from session_store import SessionStore


# ── Load config ──────────────────────────────────────────────────────────────
CONFIG_PATH = Path(__file__).parent / "config.json"
try:
    CONFIG = json.loads(CONFIG_PATH.read_text())
except Exception:
    CONFIG = {}

KANBAN_COLUMNS = CONFIG.get("kanban", {}).get("columns", [
    "Thinking", "Designing", "Developing", "Testing", "Reviewing", "Deploying", "Done"
])
POLL_PORTS = CONFIG.get("ports", [3000, 3001, 5173, 8080, 4000])
REFRESH_RATE = CONFIG.get("app", {}).get("refresh_rate", 2)
MIN_WIDTH = CONFIG.get("app", {}).get("min_width", 140)
MIN_HEIGHT = CONFIG.get("app", {}).get("min_height", 42)

COL_COLORS = {
    "Thinking":   ("col-thinking",   "🧠", "#7c3aed"),
    "Designing":  ("col-designing",  "✏️", "#2563eb"),
    "Developing": ("col-developing", "⚙️", "#0891b2"),
    "Testing":    ("col-testing",    "🧪", "#d97706"),
    "Reviewing":  ("col-reviewing",  "🔍", "#9333ea"),
    "Deploying":  ("col-deploying",  "🚀", "#16a34a"),
    "Done":       ("col-done",       "✅", "#374151"),
}

STATUS_ICONS = {
    "idle":     "○",
    "thinking": "◉",
    "working":  "◈",
    "done":     "✓",
    "error":    "✗",
}

TEMPLATES = {
    "✨ Feature":     "Build {feature} for {project}. Coordinate frontend React/Next.js, backend Node.js/Supabase, and tests in parallel.",
    "🐛 Fix Bug":     "Fix {bug}. Identify affected files, implement fix, verify with tests.",
    "⛓️ Contract":    "Build and audit {contract} smart contract in Solidity with Hardhat. Deploy to testnet after audit passes.",
    "🚀 Full Build":  "Build complete {description}. Full stack: frontend, backend, tests, deploy.",
}


# ── Widgets ───────────────────────────────────────────────────────────────────

class AgentCard(Static):
    """A single agent card in the kanban board."""

    def __init__(self, agent: AgentState, **kwargs):
        super().__init__(**kwargs)
        self.agent = agent
        self.update_card()

    def update_card(self):
        a = self.agent
        icon = STATUS_ICONS.get(a.status, "○")
        task_short = (a.task[:36] + "…") if len(a.task) > 36 else (a.task or "Idle")
        elapsed = f"{a.elapsed_sec // 60}m {a.elapsed_sec % 60}s" if a.elapsed_sec else "0s"
        cost = f"${a.cost_usd:.3f}" if a.cost_usd > 0 else "$0.000"
        bar_filled = int(a.progress / 10)
        bar_empty = 10 - bar_filled
        bar = "█" * bar_filled + "░" * bar_empty

        content = Text()
        content.append(f"{icon} {a.name}\n", style="bold #ededed")
        content.append(f"{task_short}\n", style="#666666")
        content.append(f"{bar} {a.progress}%\n", style="#5865f2")
        content.append(f"{elapsed} · {cost}", style="#444444")
        self.update(content)

        # Update CSS class for border color
        self.remove_class("status-idle", "status-thinking", "status-working", "status-done", "status-error")
        self.add_class(f"status-{a.status}")

    def on_click(self):
        self.app.show_agent_detail(self.agent)


class KanbanColumn(Vertical):
    """A single column in the kanban board."""
    col_name: reactive[str] = reactive("")
    card_count: reactive[int] = reactive(0)

    def __init__(self, name: str, **kwargs):
        super().__init__(**kwargs)
        self.col_name = name
        css_class, _, _ = COL_COLORS.get(name, ("col-developing", "⚙️", "#0891b2"))
        self.add_class("kanban-column", css_class)

    def compose(self) -> ComposeResult:
        css_class, emoji, _ = COL_COLORS.get(self.col_name, ("col-developing", "⚙️", "#0891b2"))
        yield Static(
            Text.assemble(
                (f"{emoji} {self.col_name}  ", "bold #ededed"),
                ("0", "#444444"),
            ),
            id=f"header-{self.col_name.lower()}",
            classes="column-header",
        )
        yield ScrollableContainer(id=f"cards-{self.col_name.lower()}", classes="column-cards")

    def set_count(self, count: int):
        self.card_count = count
        try:
            css_class, emoji, _ = COL_COLORS.get(self.col_name, ("col-developing", "⚙️", "#0891b2"))
            header = self.query_one(f"#header-{self.col_name.lower()}", Static)
            header.update(Text.assemble(
                (f"{emoji} {self.col_name}  ", "bold #ededed"),
                (str(count), "#5865f2" if count > 0 else "#444444"),
            ))
        except Exception:
            pass


class Sidebar(Vertical):
    """Left sidebar with projects, sessions, memory, and status."""

    def __init__(self, **kwargs):
        super().__init__(id="sidebar", **kwargs)
        self.projects = ["Econ Markets", "EconCash"]
        self.active_project = "Econ Markets"
        self.sessions = []
        self.memory_entries = []
        self.cost_today = 0.0
        self.fast_mode = True
        self.agent_count = 0

    def compose(self) -> ComposeResult:
        yield Static("econ.vibe", id="app-title")
        yield Static("PROJECTS", classes="sidebar-section-label")
        for p in self.projects:
            yield Static(f"▶ {p}" if p == self.active_project else f"  {p}",
                        classes="sidebar-item sidebar-item-active" if p == self.active_project else "sidebar-item",
                        id=f"project-{p.replace(' ', '_')}")
        yield Static("  + New Project", classes="sidebar-item")
        yield Static("SESSIONS", classes="sidebar-section-label")
        yield Static("  No sessions yet", classes="sidebar-item", id="sessions-list")
        yield Static("RUFLO MEMORY", classes="sidebar-section-label")
        yield Static("  (loading...)", classes="sidebar-item", id="memory-list")
        yield Static(f"💰 ${self.cost_today:.2f} today", classes="sidebar-cost", id="cost-today")
        yield Static("⚡ Fast Mode ON" if self.fast_mode else "⚡ Fast Mode OFF",
                    classes="sidebar-status", id="fast-mode")
        yield Static(f"🤖 {self.agent_count} agents active", classes="sidebar-status", id="agent-count")

    def refresh_data(self, sessions: list, memory: list, cost: float, agents: int):
        self.sessions = sessions
        self.memory_entries = memory
        self.cost_today = cost
        self.agent_count = agents

        # Update sessions
        try:
            sl = self.query_one("#sessions-list", Static)
            if sessions:
                lines = "\n".join(f"  {s['_label']} {s['_cost_fmt']}" for s in sessions[:3])
            else:
                lines = "  No sessions yet"
            sl.update(lines)
        except Exception:
            pass

        # Update memory
        try:
            ml = self.query_one("#memory-list", Static)
            if memory:
                lines = "\n".join(f"  {m[:20]}" for m in memory[:4])
            else:
                lines = "  (no patterns yet)"
            ml.update(lines)
        except Exception:
            pass

        # Update cost and agent count
        try:
            self.query_one("#cost-today", Static).update(f"💰 ${cost:.2f} today")
            self.query_one("#agent-count", Static).update(f"🤖 {agents} agents active")
        except Exception:
            pass


class RightPanel(Vertical):
    """Right panel with live preview, deploy, and session stats."""

    def __init__(self, **kwargs):
        super().__init__(id="right-panel", **kwargs)
        self.preview_port: Optional[int] = None
        self.cost = 0.0
        self.savings = 0.0
        self.agent_count = 0
        self.tasks_done = 0
        self.elapsed = "00:00:00"

    def compose(self) -> ComposeResult:
        yield Static("LIVE PREVIEW", classes="panel-label")
        yield Static("No server detected", classes="panel-value", id="preview-status")
        yield Button("Open Preview", id="btn-preview", disabled=True, classes="template-btn")
        yield Static("─" * 18, classes="panel-value")
        yield Static("DEPLOY", classes="panel-label")
        yield Button("Deploy to Vercel", id="btn-deploy", classes="template-btn")
        yield Static("Last: —", classes="panel-value", id="deploy-status")
        yield Static("─" * 18, classes="panel-value")
        yield Static("SESSION STATS", classes="panel-label")
        yield Static(f"Cost:  $0.0000", classes="panel-value-cost", id="stat-cost")
        yield Static(f"Saved: ~$0.0000", classes="panel-value-success", id="stat-saved")
        yield Static(f"Agents: 0 active", classes="panel-value", id="stat-agents")
        yield Static(f"Tasks:  0 done", classes="panel-value", id="stat-tasks")
        yield Static(f"Time:  00:00:00", classes="panel-value", id="stat-time")

    def refresh_stats(self, cost: float, savings: float, agents: int, tasks: int, elapsed: str, port: Optional[int]):
        self.cost = cost
        self.savings = savings
        self.agent_count = agents
        self.tasks_done = tasks
        self.elapsed = elapsed
        self.preview_port = port

        try:
            self.query_one("#stat-cost", Static).update(f"Cost:  ${cost:.4f}")
            self.query_one("#stat-saved", Static).update(f"Saved: ~${savings:.4f}")
            self.query_one("#stat-agents", Static).update(f"Agents: {agents} active")
            self.query_one("#stat-tasks", Static).update(f"Tasks:  {tasks} done")
            self.query_one("#stat-time", Static).update(f"Time:  {elapsed}")
        except Exception:
            pass

        try:
            preview_btn = self.query_one("#btn-preview", Button)
            preview_status = self.query_one("#preview-status", Static)
            if port:
                preview_btn.disabled = False
                preview_status.update(f"localhost:{port} ●")
            else:
                preview_btn.disabled = True
                preview_status.update("No server detected")
        except Exception:
            pass

    def on_button_pressed(self, event: Button.Pressed):
        if event.button.id == "btn-preview" and self.preview_port:
            subprocess.Popen(["open", f"http://localhost:{self.preview_port}"])
        elif event.button.id == "btn-deploy":
            self.app.run_deploy()


class BottomBar(Vertical):
    """Bottom prompt bar with template buttons."""

    def compose(self) -> ComposeResult:
        with Horizontal(id="prompt-row"):
            yield Static("QB ▶", id="prompt-prefix")
            yield Input(placeholder="Describe what to build...", id="prompt-input")
        with Horizontal(id="template-row"):
            for label in TEMPLATES:
                yield Button(label, classes="template-btn", id=f"tpl-{label[:3].strip()}")
            yield Button("⚡ Go", id="go-btn")
        yield Static(
            "Tab: panels  Enter: dispatch  P: preview  D: deploy  R: memory  Q: quit",
            id="keybind-row",
        )

    def on_button_pressed(self, event: Button.Pressed):
        if event.button.id == "go-btn":
            inp = self.query_one("#prompt-input", Input)
            if inp.value.strip():
                self.app.dispatch_task(inp.value.strip())
                inp.value = ""
        elif event.button.id and event.button.id.startswith("tpl-"):
            for label, template in TEMPLATES.items():
                if event.button.id == f"tpl-{label[:3].strip()}":
                    self.query_one("#prompt-input", Input).value = template
                    self.query_one("#prompt-input", Input).focus()
                    break

    def on_input_submitted(self, event: Input.Submitted):
        if event.value.strip():
            self.app.dispatch_task(event.value.strip())
            event.input.value = ""


# ── Screens ───────────────────────────────────────────────────────────────────

class SizeWarningScreen(Screen):
    def compose(self) -> ComposeResult:
        yield Static(
            "⚠️  Please make this terminal window larger\n"
            f"Minimum size: {MIN_WIDTH}×{MIN_HEIGHT}\n"
            "Resize and the app will continue automatically.",
            id="size-warning",
        )


class LoadingScreen(Screen):
    progress: reactive[int] = reactive(0)

    def compose(self) -> ComposeResult:
        yield Static("econ.vibe", id="loading-title")
        yield Static("The AI Development Operating System", id="loading-sub")
        yield ProgressBar(total=100, show_eta=False, id="loading-bar")

    async def on_mount(self):
        self.set_interval(0.05, self.tick)

    def tick(self):
        self.progress = min(self.progress + 3, 100)
        try:
            self.query_one("#loading-bar", ProgressBar).advance(3)
        except Exception:
            pass
        if self.progress >= 100:
            self.app.pop_screen()


class MainScreen(Screen):
    BINDINGS = [
        Binding("q", "quit", "Quit"),
        Binding("p", "open_preview", "Preview"),
        Binding("d", "deploy", "Deploy"),
        Binding("r", "refresh_memory", "Memory"),
        Binding("escape", "clear_focus", "Clear"),
    ]

    def compose(self) -> ComposeResult:
        with Horizontal(id="layout"):
            yield Sidebar()
            with ScrollableContainer(id="kanban-scroll"):
                with Horizontal(id="kanban"):
                    for col in KANBAN_COLUMNS:
                        yield KanbanColumn(col, id=f"col-{col.lower()}")
            yield RightPanel()
        yield BottomBar()

    def action_quit(self):
        self.app.exit()

    def action_open_preview(self):
        panel = self.query_one(RightPanel)
        if panel.preview_port:
            subprocess.Popen(["open", f"http://localhost:{panel.preview_port}"])

    def action_deploy(self):
        self.app.run_deploy()

    def action_refresh_memory(self):
        asyncio.create_task(self.app.refresh_memory())

    def action_clear_focus(self):
        self.query_one("#prompt-input", Input).blur()


# ── Main App ──────────────────────────────────────────────────────────────────

class EconVibeApp(App):
    CSS_PATH = "theme.tcss"
    TITLE = "econ.vibe"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.bridge = RufloBridge(project_dir=str(Path.cwd()))
        self.tracker = AgentTracker()
        self.store = SessionStore(sessions_dir=str(Path(__file__).parent / "sessions"))
        self._poll_timer: Optional[Timer] = None
        self._size_ok = True

    def on_mount(self):
        self.push_screen(LoadingScreen())
        self.push_screen(MainScreen())
        self._poll_timer = self.set_interval(REFRESH_RATE, self.refresh_all)
        asyncio.create_task(self._startup())

    async def _startup(self):
        await asyncio.sleep(1.5)  # Let loading screen show
        self.bridge.add_demo_agents()
        await self.bridge.ensure_daemon()
        await self.bridge.search_memory("recent patterns architecture")
        await self.refresh_all()

    async def refresh_all(self):
        # Size check
        w, h = self.size
        if w < MIN_WIDTH or h < MIN_HEIGHT:
            if not isinstance(self.screen, SizeWarningScreen):
                self.push_screen(SizeWarningScreen())
            return
        else:
            if isinstance(self.screen, SizeWarningScreen):
                self.pop_screen()

        # Poll Ruflo
        agents = await self.bridge.poll_once()

        # Update kanban board
        try:
            main = self._get_main_screen()
            if not main:
                return
            # Group agents by column
            by_col: dict[str, list[AgentState]] = {c: [] for c in KANBAN_COLUMNS}
            for a in agents:
                col = a.column if a.column in KANBAN_COLUMNS else "Developing"
                by_col[col].append(a)

            for col_name in KANBAN_COLUMNS:
                try:
                    col_widget = main.query_one(f"#col-{col_name.lower()}", KanbanColumn)
                    cards_container = col_widget.query_one(f"#cards-{col_name.lower()}", ScrollableContainer)
                    col_agents = by_col[col_name]
                    col_widget.set_count(len(col_agents))

                    # Refresh cards
                    await cards_container.remove_children()
                    if col_agents:
                        for a in col_agents:
                            card = AgentCard(a, classes="agent-card")
                            await cards_container.mount(card)
                    else:
                        empty = Static("Type a prompt\nbelow to start", classes="empty-state")
                        await cards_container.mount(empty)
                except Exception:
                    pass

            # Update sidebar
            sessions = self.store.load_recent(3)
            sidebar = main.query_one(Sidebar)
            sidebar.refresh_data(
                sessions=sessions,
                memory=self.bridge.memory_entries,
                cost=self.tracker.estimate_session_cost(),
                agents=len([a for a in agents if a.status not in ("idle", "done")]),
            )

            # Update right panel
            panel = main.query_one(RightPanel)
            active_port = self._detect_port()
            panel.refresh_stats(
                cost=self.tracker.estimate_session_cost(),
                savings=self.tracker.estimate_savings(),
                agents=len([a for a in agents if a.status not in ("idle", "done")]),
                tasks=self.tracker.tasks_done(),
                elapsed=self.tracker.session_elapsed(),
                port=active_port,
            )
        except Exception:
            pass

    def _get_main_screen(self) -> Optional[MainScreen]:
        for screen in self.screen_stack:
            if isinstance(screen, MainScreen):
                return screen
        return None

    def _detect_port(self) -> Optional[int]:
        for port in POLL_PORTS:
            try:
                with socket.create_connection(("localhost", port), timeout=0.2):
                    return port
            except Exception:
                pass
        return None

    def dispatch_task(self, prompt: str):
        self.notify(f"Dispatching: {prompt[:50]}…", title="QB")
        asyncio.create_task(self._do_dispatch(prompt))

    async def _do_dispatch(self, prompt: str):
        # Add an optimistic card in Thinking column
        from ruflo_bridge import AgentState
        import time
        agent_id = f"qb-{int(time.time())}"
        a = AgentState(
            id=agent_id,
            name="QB Agent",
            status="thinking",
            task=prompt[:60],
            column="Thinking",
        )
        self.bridge.agents[agent_id] = a
        self.tracker.record_task_start(prompt, agent_id)

        # Dispatch to Ruflo
        ok = await self.bridge.spawn_task(prompt)
        if not ok:
            a.status = "error"
            self.notify("Ruflo daemon not responding. Check that it's running.", title="Error", severity="error")

    def run_deploy(self):
        self.notify("Starting Vercel deploy…", title="Deploy")
        asyncio.create_task(self._do_deploy())

    async def _do_deploy(self):
        try:
            proc = await asyncio.create_subprocess_shell(
                "npx vercel --yes 2>&1",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(Path.cwd()),
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=120)
            output = stdout.decode("utf-8", errors="replace")
            if "https://" in output:
                url = [l.strip() for l in output.splitlines() if "https://" in l][-1]
                self.notify(f"Deployed: {url}", title="Deploy ✅", severity="information")
            else:
                self.notify("Deploy finished. Check terminal for details.", title="Deploy")
        except asyncio.TimeoutError:
            self.notify("Deploy timed out after 2 minutes.", title="Deploy Error", severity="error")
        except Exception as e:
            self.notify(f"Deploy error: {str(e)[:60]}", title="Deploy Error", severity="error")

    async def refresh_memory(self):
        self.notify("Refreshing Ruflo memory…", title="Memory")
        await self.bridge.search_memory("recent patterns architecture decisions")
        self.notify(f"Found {len(self.bridge.memory_entries)} patterns", title="Memory")

    def show_agent_detail(self, agent: AgentState):
        detail = (
            f"Agent: {agent.name}\n"
            f"Status: {agent.status}\n"
            f"Task: {agent.task}\n"
            f"Progress: {agent.progress}%\n"
            f"Elapsed: {agent.elapsed_sec}s\n"
            f"Tool calls: {agent.tool_calls}\n"
            f"Cost: ${agent.cost_usd:.4f}"
        )
        self.notify(detail, title=f"Agent Detail: {agent.name}", timeout=8)

    async def on_unmount(self):
        self.store.save()


if __name__ == "__main__":
    app = EconVibeApp()
    app.run()
