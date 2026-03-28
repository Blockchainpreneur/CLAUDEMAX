#!/usr/bin/env node
// SessionStart hook — outputs CLAUDEMAX welcome panel to stderr

try {
  const C = '\x1b[36m'; // cyan
  const R = '\x1b[0m';  // reset

  const lines = [
    `${C}╭─ ⚡ CLAUDEMAX ──────────────────────────────────────────╮${R}`,
    `${C}│${R}  Your AI autopilot is ready. Just say what you want.    ${C}│${R}`,
    `${C}│${R}                                                         ${C}│${R}`,
    `${C}│  🧭 Auto-routing${R}   every request goes to the right tool ${C}│${R}`,
    `${C}│  👥 Team builder${R}   spins up specialist agents for big   ${C}│${R}`,
    `${C}│${R}                    task — you never have to ask          ${C}│${R}`,
    `${C}│  🔒 Safety guard${R}   blocks secrets & bad code silently   ${C}│${R}`,
    `${C}│  📦 60+ agents${R}     researchers, coders, testers ready   ${C}│${R}`,
    `${C}╰─────────────────────────────────────────────────────────╯${R}`,
  ];

  process.stderr.write(lines.join('\n') + '\n');
} catch (_) {
  // never block the session
}

process.exit(0);
