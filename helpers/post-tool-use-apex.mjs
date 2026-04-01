#!/usr/bin/env node
/**
 * PostToolUse APEX — CLAUDEMAX 2.0
 * Accumulates tool events per-turn into ~/.claudemax/turn-events.jsonl
 * so the Stop hook can render a completion diagram.
 * Also forwards to daemon (existing behavior).
 * Always exits 0. Non-blocking.
 */
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { request } from 'http';

const DIR         = join(homedir(), '.claudemax');
const EVENTS_FILE = join(DIR, 'turn-events.jsonl');

try {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

  let body = '';
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    body = Buffer.concat(chunks).toString();
  }

  let event = {};
  try { event = JSON.parse(body); } catch {}

  const toolName = event.tool_name || 'unknown';
  const input    = event.tool_input || {};

  // Lightweight entry — only what the completion diagram needs
  const entry = { tool: toolName, ts: Date.now() };
  if (input.file_path) entry.file = input.file_path;
  if (input.command)   entry.cmd  = String(input.command).slice(0, 80);

  appendFileSync(EVENTS_FILE, JSON.stringify(entry) + '\n');

  // Forward to daemon
  const payload = JSON.stringify({ tool: toolName, cwd: process.cwd(), raw: body.slice(0, 200) });
  const req = request({
    hostname: 'localhost', port: 57821, path: '/tool-event', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
  });
  req.on('error', () => {});
  req.write(payload);
  req.end();
} catch {}

process.exit(0);
