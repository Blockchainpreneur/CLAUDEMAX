#!/usr/bin/env python3
"""
econ.vibe — The AI Development Operating System
Linear/Vercel-aesthetic kanban TUI for Claude Code + Ruflo.
"""
import asyncio
import json
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

# ── Add user site-packages to path for pip --user installs ────────────────────
import site
sys.path.insert(0, site.getusersitepackages())

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical, ScrollableContainer
from textual.screen import Screen
from textual.widgets import Input, ProgressBar, Static, Button
from textual.reactive import reactive
from textual.timer import Timer
from rich.text import Text
from rich.style import Style

from ruflo_bridge import RufloBridge, AgentState
from agent_tracker import AgentTracker
from session_store import SessionStore


# ── Config ─────────────────────────────────────────────────────────────────────
CONFIG_PATH = Path(__file__).parent / "config.json"
try:
    CONFIG = json.loads(CONFIG_PATH.read_text())
except Exception:
    CONFIG = {}

COLUMNS      = CONFIG.get("kanban", {}).get("columns",
               ["Thinking","Designing","Developing","Testing","Reviewing","Deploying","Done"])
POLL_PORTS   = CONFIG.get("ports", [3000, 3001, 5173, 8080, 4000])
REFRESH      = CONFIG.get("app", {}).get("refresh_rate", 2)
MIN_W        = CONFIG.get("app", {}).get("min_width",  140)
MIN_H        = CONFIG.get("app", {}).get("min_height",  42)

# ── Visual constants ────────────────────────────────────────────────────────────
SPINNER   = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
BAR_CHARS = " ▏▎▍▌▋▊▉█"

COL_META = {
    "Thinking":   ("col-thinking",   "󰙅",  "#7c3aed", "status-thinking"),
    "Designing":  ("col-designing",  "",  "#3b82f6", "status-designing"),
    "Developing": ("col-developing", "",  "#06b6d4", "status-working"),
    "Testing":    ("col-testing",    "󰙨",  "#f59e0b", "status-testing"),
    "Reviewing":  ("col-reviewing",  "",  "#a855f7", "status-reviewing"),
    "Deploying":  ("col-deploying",  "",  "#22c55e", "status-deploying"),
    "Done":       ("col-done",       "󰸞",  "#374151", "status-done"),
}

# Use ASCII fallbacks if nerd fonts not available
COL_ICONS = {
    "Thinking":   "~",
    "Designing":  "*",
    "Developing": "#",
    "Testing":    "T",
    "Reviewing":  "?",
    "Deploying":  "^",
    "Done":       "v",
}

COL_COLORS = {
    "Thinking":   "#7c3aed",
    "Designing":  "#3b82f6",
    "Developing": "#06b6d4",
    "Testing":    "#f59e0b",
    "Reviewing":  "#a855f7",
    "Deploying":  "#22c55e",
    "Done":       "#374151",
}

STATUS_DOT = {
    "idle":     ("●", "#1e1e1e"),
    "thinking": ("●", "#7c3aed"),
    "working":  ("●", "#06b6d4"),
    "done":     ("●", "#22c55e"),
    "error":    ("●", "#ef4444"),
}

TEMPLATES = [
    ("✦ Feature",  "Build {feature} for {project}. Coordinate frontend React/Next.js, backend Node.js/Supabase, and tests in parallel."),
    ("⚑ Fix Bug",  "Fix {bug}. Identify affected files, implement fix, verify with tests."),
    ("◈ Contract", "Build and audit {contract} smart contract in Solidity with Hardhat. Deploy to testnet after audit passes."),
    ("▶ Full Build","Build complete {description}. Full stack: frontend, backend, tests, deploy."),
]


# ── Helpers ─────────────────────────────────────────────────────────────────────
def smooth_bar(pct: int, width: int = 14) -> str:
    """Returns a smooth Unicode progress bar."""
    filled_eighths = int(pct / 100 * width * 8)
    full  = filled_eighths // 8
    frac  = filled_eighths % 8
    bar   = "█" * full
    if frac and full < width:
        bar += BAR_CHARS[frac]
    return bar.ljust(width, "░")


def fmt_elapsed(sec: int) -> str:
    if sec < 60:
        return f"{sec}s"
    return f"{sec // 60}m {sec % 60}s"


# ═══════════════════════════════════════════════════════════════════════════════
# WIDGETS
# ═══════════════════════════════════════════════════════════════════════════════

class AgentCard(Static):
    """Animated agent card with spinner and smooth progress bar."""

    DEFAULT_CSS = ""

    def __init__(self, agent: AgentState, frame: int = 0, **kwargs):
        super().__init__(**kwargs)
        self.agent = agent
        self.frame = frame
        self._render_card()

    def _render_card(self):
        a    = self.agent
        spin = SPINNER[self.frame % len(SPINNER)]

        # Status indicator
        if a.status == "thinking":
            icon  = f"[bold #7c3aed]{spin}[/]"
            ntag  = "bold #c4b5fd"
        elif a.status == "working":
            icon  = f"[bold #06b6d4]{spin}[/]"
            ntag  = "bold #a5f3fc"
        elif a.status == "done":
            icon  = "[#166534]✓[/]"
            ntag  = "#374151"
        elif a.status == "error":
            icon  = "[bold #ef4444]✗[/]"
            ntag  = "bold #ef4444"
        else:
            icon  = "[#222222]○[/]"
            ntag  = "#333333"

        bar   = smooth_bar(a.progress)
        pct   = a.progress
        cost  = f"${a.cost_usd:.3f}" if a.cost_usd > 0 else "$0.000"
        ela   = fmt_elapsed(a.elapsed_sec)

        # Truncate task text
        task  = a.task or "Waiting…"
        task  = (task[:24] + "…") if len(task) > 24 else task

        t = Text(no_wrap=True, overflow="ellipsis")
        t.append(f" {icon} ", style="")
        t.append(f"{a.name}\n", style=ntag)
        t.append(f"   {task}\n", style="#3a3a3a")

        if a.status in ("thinking", "working"):
            bar_style = "#4f46e5"
            pct_style = "#818cf8"
        elif a.status == "done":
            bar_style = "#166534"
            pct_style = "#4ade80"
        else:
            bar_style = "#1e1e1e"
            pct_style = "#333333"

        t.append(f"   {bar}", style=bar_style)
        t.append(f" {pct:3d}%\n", style=pct_style)
        t.append(f"   {ela}  ·  {cost}", style="#2a2a2a")

        self.update(t)

        # CSS status class for border colour
        for s in ("idle","thinking","working","done","error"):
            self.remove_class(f"status-{s}")
        self.add_class(f"status-{a.status}")

    def tick(self, frame: int):
        self.frame = frame
        self._render_card()

    def on_click(self):
        self.app.show_agent_detail(self.agent)


class KanbanColumn(Vertical):
    """A single kanban column with colored header and scrollable cards."""

    def __init__(self, name: str, **kwargs):
        super().__init__(**kwargs)
        self.col_name  = name
        self.css_class = COL_META.get(name, ("col-developing","#","#06b6d4",""))[0]
        self.col_color = COL_COLORS.get(name, "#06b6d4")
        self.add_class("kanban-column", self.css_class)

    def compose(self) -> ComposeResult:
        yield Static(id=f"hdr-{self.col_name}", classes="column-header")
        yield ScrollableContainer(id=f"cards-{self.col_name}", classes="column-cards")

    def on_mount(self):
        self._set_header(0)

    def _set_header(self, count: int):
        icon   = COL_ICONS.get(self.col_name, "·")
        color  = self.col_color
        badge  = f"[bold {color}]{count}[/]" if count else "[#222222]0[/]"
        t = Text(no_wrap=True)
        t.append(f" [{color}]{icon}[/] ")
        t.append(f"[bold #cccccc]{self.col_name}[/]")
        t.append("  ")
        t.append_text(Text.from_markup(badge))
        try:
            self.query_one(f"#hdr-{self.col_name}", Static).update(t)
        except Exception:
            pass

    def set_count(self, n: int):
        self._set_header(n)


class Sidebar(Vertical):
    """Left sidebar — projects, sessions, memory, status."""

    def __init__(self, **kwargs):
        super().__init__(id="sidebar", **kwargs)
        self.projects      = ["Econ Markets", "EconCash"]
        self.active        = "Econ Markets"
        self._sessions     = []
        self._memory       = []
        self._cost         = 0.0
        self._agents       = 0

    def compose(self) -> ComposeResult:
        yield Static(id="sb-title",   classes="sb-title-area")
        yield Static(id="sb-projs",   classes="sb-section")
        yield Static(id="sb-sess",    classes="sb-section")
        yield Static(id="sb-mem",     classes="sb-section")
        yield Static(id="sb-footer",  classes="sb-footer")

    def on_mount(self):
        self._draw_all()

    def _draw_all(self):
        self._draw_title()
        self._draw_projects()
        self._draw_sessions()
        self._draw_memory()
        self._draw_footer()

    def _draw_title(self):
        t = Text(justify="center")
        t.append("\n")
        t.append("  econ", style="bold #4f46e5")
        t.append(".", style="bold #818cf8")
        t.append("vibe\n", style="bold #4f46e5")
        t.append("  AI Dev OS\n", style="#1e1e1e")
        try:
            self.query_one("#sb-title", Static).update(t)
        except Exception:
            pass

    def _draw_projects(self):
        t = Text()
        t.append("  PROJECTS\n", style="bold #1e1e1e")
        for p in self.projects:
            if p == self.active:
                t.append("  ● ", style="#4f46e5")
                t.append(f"{p}\n", style="bold #c7d2fe")
            else:
                t.append("  ○ ", style="#1a1a1a")
                t.append(f"{p}\n", style="#333333")
        t.append("  + new project\n", style="#1a1a1a")
        try:
            self.query_one("#sb-projs", Static).update(t)
        except Exception:
            pass

    def _draw_sessions(self):
        t = Text()
        t.append("  SESSIONS\n", style="bold #1e1e1e")
        if self._sessions:
            for s in self._sessions[:3]:
                label = s.get("_label", "—")
                cost  = s.get("_cost_fmt", "$0.00")
                t.append(f"  {label}", style="#2a2a2a")
                t.append(f"  {cost}\n", style="#6b21a8")
        else:
            t.append("  no sessions yet\n", style="#1a1a1a")
        try:
            self.query_one("#sb-sess", Static).update(t)
        except Exception:
            pass

    def _draw_memory(self):
        t = Text()
        t.append("  MEMORY\n", style="bold #1e1e1e")
        if self._memory:
            for m in self._memory[:5]:
                snippet = m[:20].strip()
                if snippet:
                    t.append("  ‣ ", style="#1e1b4b")
                    t.append(f"{snippet}\n", style="#2a2a3a")
        else:
            t.append("  no patterns yet\n", style="#1a1a1a")
        try:
            self.query_one("#sb-mem", Static).update(t)
        except Exception:
            pass

    def _draw_footer(self):
        t = Text()
        t.append(f"  ◆ ${self._cost:.4f} today\n", style="bold #9d174d")
        t.append("  ⚡ Fast Mode ON\n",             style="#1e1e1e")
        t.append(f"  ◎ {self._agents} active\n",   style="#1e1e1e")
        try:
            self.query_one("#sb-footer", Static).update(t)
        except Exception:
            pass

    def refresh_data(self, sessions, memory, cost, agents):
        self._sessions = sessions
        self._memory   = memory
        self._cost     = cost
        self._agents   = agents
        self._draw_sessions()
        self._draw_memory()
        self._draw_footer()


class RightPanel(Vertical):
    """Right panel — preview, deploy, session stats."""

    def __init__(self, **kwargs):
        super().__init__(id="right-panel", **kwargs)
        self.preview_port: Optional[int] = None
        self.cost    = 0.0
        self.savings = 0.0
        self.agents  = 0
        self.tasks   = 0
        self.elapsed = "00:00:00"

    def compose(self) -> ComposeResult:
        with Vertical(classes="rp-section"):
            yield Static("  PREVIEW",       classes="rp-label")
            yield Static(id="rp-prev-url",  classes="rp-val")
            yield Button("  Open Preview",  id="btn-preview", disabled=True, classes="rp-btn")
        with Vertical(classes="rp-section"):
            yield Static("  DEPLOY",        classes="rp-label")
            yield Static(id="rp-last-dep",  classes="rp-val")
            yield Button("  ▶ Vercel",      id="btn-deploy",  classes="rp-btn-deploy")
        with Vertical(classes="rp-section"):
            yield Static("  SESSION",       classes="rp-label")
            yield Static(id="rp-cost",      classes="rp-val-cost")
            yield Static(id="rp-saved",     classes="rp-val-save")
            yield Static(id="rp-agents",    classes="rp-val")
            yield Static(id="rp-tasks",     classes="rp-val")
            yield Static(id="rp-time",      classes="rp-val-hi")

    def on_mount(self):
        self._draw()

    def _draw(self):
        try:
            if self.preview_port:
                self.query_one("#rp-prev-url", Static).update(
                    Text.from_markup(f"  [#22c55e]●[/] localhost:{self.preview_port}"))
                self.query_one("#btn-preview", Button).disabled = False
                self.query_one("#btn-preview", Button).add_class("rp-btn-live")
                self.query_one("#btn-preview", Button).remove_class("rp-btn")
            else:
                self.query_one("#rp-prev-url", Static).update(
                    Text.from_markup("  [#1a1a1a]●[/] no server"))
                self.query_one("#btn-preview", Button).disabled = True

            self.query_one("#rp-cost",   Static).update(f"  ◆ ${self.cost:.4f}")
            self.query_one("#rp-saved",  Static).update(f"  ↑ ~${self.savings:.4f} saved")
            self.query_one("#rp-agents", Static).update(f"  ◎ {self.agents} active")
            self.query_one("#rp-tasks",  Static).update(f"  ✓ {self.tasks} done")
            self.query_one("#rp-time",   Static).update(f"  ◷ {self.elapsed}")
            self.query_one("#rp-last-dep", Static).update("  last: —")
        except Exception:
            pass

    def refresh_stats(self, cost, savings, agents, tasks, elapsed, port):
        self.cost    = cost
        self.savings = savings
        self.agents  = agents
        self.tasks   = tasks
        self.elapsed = elapsed
        self.preview_port = port
        self._draw()

    def on_button_pressed(self, event: Button.Pressed):
        if event.button.id == "btn-preview" and self.preview_port:
            subprocess.Popen(["open", f"http://localhost:{self.preview_port}"])
        elif event.button.id == "btn-deploy":
            self.app.run_deploy()


class BottomBar(Vertical):
    """Bottom prompt bar + template buttons + keybinds."""

    def compose(self) -> ComposeResult:
        with Horizontal(id="prompt-area"):
            yield Static(" QB ▶ ", id="prompt-label")
            yield Input(placeholder="Describe what to build…", id="prompt-input")
        with Horizontal(id="actions-area"):
            for label, _ in TEMPLATES:
                safe_id = "tpl-" + label[:4].strip().replace(" ", "")
                yield Button(label, classes="action-btn", id=safe_id)
            yield Button("▶ Go", id="dispatch-btn")
            yield Static(
                "  enter:dispatch  p:preview  d:deploy  r:memory  q:quit",
                id="keybinds"
            )

    def on_button_pressed(self, event: Button.Pressed):
        if event.button.id == "dispatch-btn":
            inp = self.query_one("#prompt-input", Input)
            if inp.value.strip():
                self.app.dispatch_task(inp.value.strip())
                inp.value = ""
        else:
            for label, template in TEMPLATES:
                safe_id = "tpl-" + label[:4].strip().replace(" ", "")
                if event.button.id == safe_id:
                    inp = self.query_one("#prompt-input", Input)
                    inp.value = template
                    inp.focus()
                    break

    def on_input_submitted(self, event: Input.Submitted):
        if event.value.strip():
            self.app.dispatch_task(event.value.strip())
            event.input.value = ""


# ═══════════════════════════════════════════════════════════════════════════════
# SCREENS
# ═══════════════════════════════════════════════════════════════════════════════

LOGO = r"""
  ███████╗ ██████╗ ██████╗ ███╗  ██╗
  ██╔════╝██╔════╝██╔═══██╗████╗ ██║
  █████╗  ██║     ██║   ██║██╔██╗██║
  ██╔══╝  ██║     ██║   ██║██║╚████║
  ███████╗╚██████╗╚██████╔╝██║ ╚███║
  ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚══╝
           .  v  i  b  e
"""

LOADING_STEPS = [
    "initializing memory…",
    "connecting to Ruflo…",
    "loading MCP servers…",
    "warming up agents…",
    "ready",
]


class LoadingScreen(Screen):
    progress: reactive[int] = reactive(0)
    _step_idx = 0

    def compose(self) -> ComposeResult:
        yield Static(id="loading-logo",     classes="loading-logo")
        yield Static(id="loading-tagline",  classes="loading-tagline")
        yield ProgressBar(total=100, show_eta=False, id="loading-progress")
        yield Static(id="loading-steps",    classes="loading-steps")

    def on_mount(self):
        logo_t = Text(LOGO, style="bold #3730a3", justify="center")
        try:
            self.query_one("#loading-logo", Static).update(logo_t)
            self.query_one("#loading-tagline", Static).update(
                Text("The AI Development Operating System", style="#1e1e1e", justify="center"))
        except Exception:
            pass
        self.set_interval(0.06, self._tick)

    def _tick(self):
        self.progress = min(self.progress + 2, 100)
        try:
            self.query_one("#loading-progress", ProgressBar).advance(2)
        except Exception:
            pass

        step_at = int(self.progress / 100 * len(LOADING_STEPS))
        if step_at < len(LOADING_STEPS) and step_at != self._step_idx:
            self._step_idx = step_at
            try:
                self.query_one("#loading-steps", Static).update(
                    Text(LOADING_STEPS[step_at], style="#222222", justify="center"))
            except Exception:
                pass

        if self.progress >= 100:
            self.app.pop_screen()


class SizeWarningScreen(Screen):
    def compose(self) -> ComposeResult:
        yield Static(
            f"\n  ⚠  Terminal too small\n\n"
            f"  Minimum: {MIN_W} × {MIN_H}\n\n"
            f"  Resize to continue\n",
            id="size-msg",
        )


class MainScreen(Screen):
    BINDINGS = [
        Binding("q",      "quit",           "Quit"),
        Binding("p",      "open_preview",   "Preview"),
        Binding("d",      "deploy",         "Deploy"),
        Binding("r",      "refresh_memory", "Memory"),
        Binding("escape", "clear_input",    "Clear"),
    ]

    def compose(self) -> ComposeResult:
        with Horizontal(id="layout"):
            yield Sidebar()
            with ScrollableContainer(id="kanban-scroll"):
                with Horizontal(id="kanban"):
                    for col in COLUMNS:
                        yield KanbanColumn(col, id=f"col-{col}")
            yield RightPanel()
        yield BottomBar(id="bottom-bar")

    def action_quit(self):          self.app.exit()
    def action_open_preview(self):  self.app.open_preview()
    def action_deploy(self):        self.app.run_deploy()
    def action_refresh_memory(self):
        asyncio.create_task(self.app.refresh_memory())
    def action_clear_input(self):
        try:
            self.query_one("#prompt-input", Input).blur()
        except Exception:
            pass


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN APP
# ═══════════════════════════════════════════════════════════════════════════════

class EconVibeApp(App):
    CSS_PATH = "theme.tcss"
    TITLE    = "econ.vibe"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.bridge  = RufloBridge(project_dir=str(Path.cwd()))
        self.tracker = AgentTracker()
        self.store   = SessionStore(sessions_dir=str(Path(__file__).parent / "sessions"))
        self._frame  = 0
        self._poll_timer: Optional[Timer] = None
        self._spin_timer: Optional[Timer] = None

    # ── Lifecycle ──────────────────────────────────────────────────────────────
    def on_mount(self):
        self.push_screen(LoadingScreen())
        self.push_screen(MainScreen())
        self._poll_timer = self.set_interval(REFRESH,  self._refresh_all)
        self._spin_timer = self.set_interval(0.12,     self._spin_tick)
        asyncio.create_task(self._startup())

    async def _startup(self):
        await asyncio.sleep(1.8)
        self.bridge.add_demo_agents()
        await self.bridge.ensure_daemon()
        await self.bridge.search_memory("recent patterns architecture")
        await self._refresh_all()

    async def on_unmount(self):
        self.store.save()

    # ── Animation tick ─────────────────────────────────────────────────────────
    def _spin_tick(self):
        self._frame += 1
        main = self._main()
        if not main:
            return
        try:
            for card in main.query(AgentCard):
                if card.agent.status in ("thinking", "working"):
                    card.tick(self._frame)
        except Exception:
            pass

    # ── Full refresh ───────────────────────────────────────────────────────────
    async def _refresh_all(self):
        w, h = self.size
        if w < MIN_W or h < MIN_H:
            if not isinstance(self.screen, SizeWarningScreen):
                self.push_screen(SizeWarningScreen())
            return
        else:
            if isinstance(self.screen, SizeWarningScreen):
                self.pop_screen()

        agents = await self.bridge.poll_once()
        main   = self._main()
        if not main:
            return

        # Group by column
        by_col: dict[str, list] = {c: [] for c in COLUMNS}
        for a in agents:
            col = a.column if a.column in COLUMNS else "Developing"
            by_col[col].append(a)

        for col_name in COLUMNS:
            try:
                col_w   = main.query_one(f"#col-{col_name}", KanbanColumn)
                cards_c = col_w.query_one(f"#cards-{col_name}", ScrollableContainer)
                col_a   = by_col[col_name]
                col_w.set_count(len(col_a))

                await cards_c.remove_children()
                if col_a:
                    for a in col_a:
                        await cards_c.mount(
                            AgentCard(a, frame=self._frame, classes="agent-card"))
                else:
                    await cards_c.mount(
                        Static("·  ·  ·", classes="empty-col"))
            except Exception:
                pass

        # Sidebar
        sessions = self.store.load_recent(3)
        try:
            main.query_one(Sidebar).refresh_data(
                sessions=sessions,
                memory=self.bridge.memory_entries,
                cost=self.tracker.estimate_session_cost(),
                agents=len([a for a in agents if a.status in ("thinking","working")]),
            )
        except Exception:
            pass

        # Right panel
        try:
            main.query_one(RightPanel).refresh_stats(
                cost=self.tracker.estimate_session_cost(),
                savings=self.tracker.estimate_savings(),
                agents=len([a for a in agents if a.status in ("thinking","working")]),
                tasks=self.tracker.tasks_done(),
                elapsed=self.tracker.session_elapsed(),
                port=self._detect_port(),
            )
        except Exception:
            pass

    # ── Helpers ────────────────────────────────────────────────────────────────
    def _main(self) -> Optional[MainScreen]:
        for s in self.screen_stack:
            if isinstance(s, MainScreen):
                return s
        return None

    def _detect_port(self) -> Optional[int]:
        for port in POLL_PORTS:
            try:
                with socket.create_connection(("localhost", port), timeout=0.15):
                    return port
            except Exception:
                pass
        return None

    # ── Actions ────────────────────────────────────────────────────────────────
    def dispatch_task(self, prompt: str):
        self.notify(f"{prompt[:60]}…" if len(prompt) > 60 else prompt,
                    title="Dispatching")
        asyncio.create_task(self._do_dispatch(prompt))

    async def _do_dispatch(self, prompt: str):
        agent_id = f"qb-{int(time.time())}"
        a = AgentState(id=agent_id, name="QB Agent",
                       status="thinking", task=prompt[:60], column="Thinking")
        self.bridge.agents[agent_id] = a
        self.tracker.record_task_start(prompt, agent_id)
        ok = await self.bridge.spawn_task(prompt)
        if not ok:
            a.status = "error"
            self.notify("Ruflo daemon not responding.", title="Error", severity="error")

    def open_preview(self):
        port = self._detect_port()
        if port:
            subprocess.Popen(["open", f"http://localhost:{port}"])
        else:
            self.notify("No local server detected.", title="Preview", severity="warning")

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
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=120)
            txt = out.decode("utf-8", errors="replace")
            if "https://" in txt:
                url = [l.strip() for l in txt.splitlines() if "https://" in l][-1]
                self.notify(url, title="Deployed ✓")
            else:
                self.notify("Check terminal for details.", title="Deploy done")
        except asyncio.TimeoutError:
            self.notify("Timed out after 2m.", title="Deploy Error", severity="error")
        except Exception as e:
            self.notify(str(e)[:80], title="Deploy Error", severity="error")

    async def refresh_memory(self):
        self.notify("Refreshing memory…", title="Memory")
        await self.bridge.search_memory("recent patterns architecture decisions")
        n = len(self.bridge.memory_entries)
        self.notify(f"{n} pattern{'s' if n != 1 else ''} found", title="Memory")

    def show_agent_detail(self, agent: AgentState):
        lines = [
            f"[bold]{agent.name}[/]",
            f"Status:  {agent.status}",
            f"Task:    {agent.task[:60]}",
            f"Column:  {agent.column}",
            f"Progress:{agent.progress}%",
            f"Elapsed: {fmt_elapsed(agent.elapsed_sec)}",
            f"Tools:   {agent.tool_calls}",
            f"Cost:    ${agent.cost_usd:.4f}",
        ]
        self.notify("\n".join(lines), title="Agent Detail", timeout=10)


if __name__ == "__main__":
    EconVibeApp().run()
