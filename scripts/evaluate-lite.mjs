#!/usr/bin/env node
// Local-only acceptance replay. All mutations are confined to fresh /tmp repositories.
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { KIT_ROOT } from './lib.mjs';
const run = (cwd, args, input = {}, env = {}) =>
  spawnSync(process.execPath, args, {
    cwd,
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
function git(root, ...args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}
function install(tools) {
  const root = mkdtempSync('/tmp/governance-lite-eval-');
  git(root, 'init', '-q');
  const result = run(KIT_ROOT, ['scripts/init.mjs', '--target', root, '--tools', tools, '--write']);
  assert.equal(result.status, 0, result.stderr);
  return root;
}
function files(root) {
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.name !== '.git')
    .flatMap((e) => (e.isDirectory() ? files(join(root, e.name)) : [join(root, e.name)]));
}
const invoke = (root, sub, input = {}, env = {}) =>
  run(root, [join(root, 'scripts/governance.mjs'), sub, '--runtime', 'codex'], input, env);
function metrics(root) {
  const list = files(root),
    code = list.filter((p) => p.endsWith('.mjs'));
  const installedFiles = list.map((p) => ({
    file: p.slice(root.length + 1),
    lines: readFileSync(p, 'utf8').split('\n').length - 1,
  }));
  const times = [],
    bytes = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now(),
      r = invoke(root, 'session-start', { session_id: 'measurement' });
    assert.equal(r.status, 0, r.stderr);
    times.push(Number((performance.now() - start).toFixed(2)));
    bytes.push(Buffer.byteLength(JSON.parse(r.stdout).hookSpecificOutput.additionalContext));
  }
  const result = {
    installedFiles,
    files: list.length,
    lines: list.reduce((n, p) => n + readFileSync(p, 'utf8').split('\n').length - 1, 0),
    codeFiles: code.length,
    codeLines: code.reduce((n, p) => n + readFileSync(p, 'utf8').split('\n').length - 1, 0),
    startMs: times,
    startMedianMs: [...times].sort((a, b) => a - b)[2],
    injectionBytes: bytes[0],
    checkFunctions: code.reduce((n, p) => n + (readFileSync(p, 'utf8').match(/function check/g) || []).length, 0),
  };
  assert.ok(result.lines <= 800);
  assert.ok(result.startMedianMs < 1000);
  return result;
}
const two = install('claude-code,codex'),
  root = install('claude-code,codex,grok');
const scanner = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
assert.equal(scanner.status, 0, scanner.stderr);
const report = {
  gitleaks: scanner.stdout.trim(),
  scope: 'local script/static wiring only; no client trust or independent cold-start exam',
  twoTools: metrics(two),
  threeTools: metrics(root),
  probes: [],
  repositories: [two, root],
};
// Measure a fresh installation before its first commit, matching the v4 baseline fixtures.
for (const repository of [two, root]) {
  git(repository, 'add', '.');
  git(
    repository,
    '-c',
    'user.name=Governance Eval',
    '-c',
    'user.email=eval@example.invalid',
    'commit',
    '-qm',
    'baseline',
  );
}
function probe(name, fn) {
  try {
    const detail = fn();
    report.probes.push({ name, pass: true, detail });
    console.log(`PASS ${name}: ${detail}`);
  } catch (error) {
    report.probes.push({ name, pass: false, error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}
function rejected(pattern) {
  const r = invoke(root, 'check');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, pattern);
  return `exit=${r.status}; ${r.stderr
    .trim()
    .split('\n')
    .filter((s) => s.includes('ERROR'))
    .join(' | ')}`;
}
probe('remove Stop wiring', () => {
  const p = join(root, '.codex/hooks.json'),
    before = readFileSync(p, 'utf8');
  const obj = JSON.parse(before);
  delete obj.hooks.Stop;
  writeFileSync(p, JSON.stringify(obj));
  try {
    return rejected(/codex Stop/);
  } finally {
    writeFileSync(p, before);
  }
});
probe('stale cursor date', () => {
  const p = join(root, 'ROADMAP.md'),
    before = readFileSync(p, 'utf8');
  writeFileSync(p, before.replace(/20\d{2}-\d{2}-\d{2}/g, '2000-01-01'));
  try {
    return rejected(/游标日期/);
  } finally {
    writeFileSync(p, before);
  }
});
probe('compact in /tmp', () => {
  const r = invoke(root, 'session-start', { source: 'compact', session_id: 'compact' });
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  for (const re of [/目录:/, /分支:/, /HEAD:/, /坐标告警:.*临时盘/]) assert.match(s, re);
  return 'coordinates + temporary directory warning';
});
probe('cd x && /usr/bin/git reset --hard', () => {
  const r = invoke(root, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'cd x && /usr/bin/git reset --hard' },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny');
  return 'permissionDecision=deny; command not executed';
});
probe('real gitleaks rejects synthetic staged credential', () => {
  const p = join(root, 'credential-probe.txt');
  writeFileSync(p, `github_token=${['gh', 'p_', randomBytes(18).toString('hex')].join('')}\n`);
  git(root, 'add', 'credential-probe.txt');
  try {
    return rejected(/gitleaks.*失败/);
  } finally {
    git(root, 'rm', '--cached', '-q', 'credential-probe.txt');
    rmSync(p);
  }
});
probe('missing gitleaks fails closed', () => {
  const bin = join(root, '.git', 'isolated-bin');
  mkdirSync(bin);
  const gitPath = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
  symlinkSync(gitPath, join(bin, 'git'));
  const r = invoke(root, 'check', {}, { PATH: bin });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /缺少 gitleaks.*fail-closed/);
  return `exit=${r.status}; ${r.stderr
    .trim()
    .split('\n')
    .filter((s) => s.includes('ERROR'))
    .join(' | ')}`;
});
probe('staged external absolute symlink', () => {
  const p = join(root, 'outside-link');
  symlinkSync('/tmp/outside-governance-authority', p);
  git(root, 'add', 'outside-link');
  // Worktree repair must not mask the staged absolute target.
  rmSync(p);
  symlinkSync('ROADMAP.md', p);
  try {
    return rejected(/仓外绝对路径软链接/);
  } finally {
    // The index deliberately differs from the worktree; remove only this owned fixture's index entry.
    git(root, 'rm', '--cached', '-f', '-q', 'outside-link');
    rmSync(p);
  }
});
probe('Stop prompts once for changes without cursor update', () => {
  const input = { session_id: 'stop-replay' };
  invoke(root, 'session-start', input);
  const p = join(root, 'implementation.js');
  writeFileSync(p, 'export const result=1;\n');
  try {
    assert.equal(JSON.parse(invoke(root, 'stop', input).stdout).decision, 'block');
    assert.deepEqual(JSON.parse(invoke(root, 'stop', input).stdout), {});
    return 'first block, second allow';
  } finally {
    rmSync(p);
  }
});
const clean = invoke(root, 'check');
assert.equal(clean.status, 0, clean.stderr);
console.log(`METRICS ${JSON.stringify({ twoTools: report.twoTools, threeTools: report.threeTools })}`);
writeFileSync('/tmp/governance-lite-evaluation.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  `RESULT ${report.probes.filter((p) => p.pass).length}/${report.probes.length}; report=/tmp/governance-lite-evaluation.json`,
);
