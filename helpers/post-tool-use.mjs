#!/usr/bin/env node
// PostToolUse hook — fire-and-forget to CLAUDEMAX daemon
// Always exits 0. Never blocks. Daemon down = silent skip.
import { request } from 'http';

const cwd = process.cwd();
let body = '';
try {
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    body = Buffer.concat(chunks).toString();
  }
} catch {}

const payload = JSON.stringify({ tool: process.argv[2] || 'unknown', cwd, raw: body.slice(0, 200) });
try {
  const req = request({ hostname: 'localhost', port: 57821, path: '/tool-event', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } });
  req.on('error', () => {});
  req.write(payload);
  req.end();
} catch {}

process.exit(0);
