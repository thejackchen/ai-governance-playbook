#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { KIT_ROOT, parseArgs } from './lib.mjs';
const args = parseArgs(process.argv.slice(2));
if (!args.target) { console.error('需要 --target'); process.exit(2); }
const root = resolve(String(args.target));
let lock;
try { lock = JSON.parse(readFileSync(join(root, 'governance.lock.json'), 'utf8')); }
catch { console.error('铭牌不可读'); process.exit(1); }
if (lock.schemaVersion !== 2) await import('./doctor-v4.mjs');
else {
  const result = spawnSync(process.execPath, [join(KIT_ROOT, 'scripts/governance.mjs'), 'check', '--root', root], {stdio:'inherit'});
  process.exitCode = result.status ?? 1;
}
