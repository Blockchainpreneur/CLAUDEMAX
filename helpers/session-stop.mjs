#!/usr/bin/env node
// Stop hook — writes session summary to daemon
// Always exits 0.
import { request } from 'http';

const cwd = process.cwd();
const payload = JSON.stringify({ cwd, summary: `Session ended at ${new Date().toISOString()}` });
try {
  const req = request({ hostname: 'localhost', port: 57821, path: '/session/end', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } });
  req.on('error', () => {});
  req.write(payload);
  req.end();
} catch {}

setTimeout(() => process.exit(0), 500);
