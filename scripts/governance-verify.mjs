#!/usr/bin/env node
// Mother orchestration and v4 compatibility; never installed into Lite projects.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { KIT_ROOT } from './lib.mjs';
const args = process.argv.slice(2);
if (args.some(a => !['--ci', '--fast'].includes(a))) { console.error('用法: governance-verify.mjs [--ci|--fast]'); process.exit(2); }
const root = process.cwd();
const lock = JSON.parse(readFileSync(join(root, 'governance.lock.json'), 'utf8'));
function run(command, argv, shell = false) {
  const result = spawnSync(command, argv, {cwd:root, stdio:'inherit', shell});
  if (result.status !== 0) process.exit(result.status || 1);
}
if (lock.schemaVersion !== 2) {
  run(process.execPath, [join(KIT_ROOT, 'templates/common/scripts/governance-verify.mjs'), ...args]);
} else {
  run(process.execPath, [join(KIT_ROOT, 'scripts/governance.mjs'), 'check', '--root', root]);
  const policy = JSON.parse(readFileSync(join(root, 'governance/policy.json'), 'utf8'));
  const mode = args.includes('--ci') ? 'ciChecks' : 'fastChecks';
  for (const command of policy[mode] || []) run(command, [], true);
  console.log(`[governance] verify ${mode} 通过`);
}
