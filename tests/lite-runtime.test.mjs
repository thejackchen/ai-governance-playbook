import test from 'node:test';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  readdirSync,
  symlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { preTool, DANGERS } from '../scripts/governance.mjs';
const kit = fileURLToPath(new URL('..', import.meta.url));
const run = (cwd, args, input, env = {}) =>
  spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    input: JSON.stringify(input || {}),
    env: { ...process.env, ...env },
  });
function git(root, ...args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}
function project(t, tools = 'claude-code,codex') {
  const root = mkdtempSync('/tmp/gov-lite-test-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q');
  const result = run(kit, ['scripts/init.mjs', '--target', root, '--tools', tools, '--write']);
  assert.equal(result.status, 0, result.stderr);
  git(root, 'add', '.');
  git(root, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'fixture');
  return root;
}
const hook = (root, sub, input = {}, runtime = 'codex', env = {}) =>
  run(root, [join(root, 'scripts/governance.mjs'), sub, '--runtime', runtime], input, env);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const putJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
function files(root) {
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.name !== '.git')
    .flatMap((e) => (e.isDirectory() ? files(join(root, e.name)) : [join(root, e.name)]));
}

test('Lite installs only selected tools and stays within the honest file/line budget', (t) => {
  const root = project(t);
  const list = files(root);
  assert.equal(list.length, 12);
  assert.ok(list.reduce((n, p) => n + readFileSync(p, 'utf8').split('\n').length - 1, 0) <= 800);
  assert.deepEqual(readJson(join(root, 'governance.lock.json')).tools, ['claude-code', 'codex']);
  assert.equal(readJson(join(root, 'governance.lock.json')).installedFiles, undefined);
  for (const p of [
    '.grok',
    'scripts/lib',
    'scripts/governance-hooks',
    'scripts/claim.mjs',
    'scripts/requirements-check.mjs',
    'scripts/governance-update.mjs',
    'docs/requirements',
    'docs/decisions',
    'docs/architecture',
    'docs/ops',
    'governance/registry.md',
    'governance/cases',
  ])
    assert.equal(existsSync(join(root, p)), false, p);
  assert.ok(readFileSync(join(root, 'AGENTS.md'), 'utf8').split('\n').length <= 80);
  assert.equal(hook(root, 'check').status, 0);
});

test('tools option respects each runtime instead of installing all three', (t) => {
  for (const tool of ['claude-code', 'codex', 'grok', 'generic']) {
    const root = project(t, tool);
    for (const [name, path] of [
      ['claude-code', '.claude'],
      ['codex', '.codex'],
      ['grok', '.grok'],
    ])
      assert.equal(existsSync(join(root, path)), tool === name);
  }
});

test('fresh dry run and rerun preserve project facts, WIP and unrelated hooks', (t) => {
  const root = project(t);
  writeFileSync(join(root, 'AGENTS.md'), readFileSync(join(root, 'AGENTS.md'), 'utf8') + '\nProject owner intent.\n');
  writeFileSync(join(root, 'wip.txt'), 'keep');
  const before = files(root).map((p) => [p, readFileSync(p, 'utf8')]);
  const r = run(kit, ['scripts/init.mjs', '--target', root, '--tools', 'claude-code,codex', '--write']);
  assert.equal(r.status, 0, r.stderr);
  for (const [p, body] of before) assert.equal(readFileSync(p, 'utf8'), body);
  const blank = mkdtempSync('/tmp/gov-lite-dry-');
  t.after(() => rmSync(blank, { recursive: true, force: true }));
  git(blank, 'init', '-q');
  assert.equal(run(kit, ['scripts/init.mjs', '--target', blank, '--tools', 'codex']).status, 0);
  assert.deepEqual(readdirSync(blank), ['.git']);
});

test('existing v4 installation and symlink installation targets are refused without writes', (t) => {
  const root = mkdtempSync('/tmp/gov-lite-existing-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q');
  putJson(join(root, 'governance.lock.json'), { profile: 'standard' });
  const r = run(kit, ['scripts/init.mjs', '--target', root, '--tools', 'codex', '--write']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /已有 v4/);
  assert.deepEqual(readdirSync(root).sort(), ['.git', 'governance.lock.json']);
  rmSync(join(root, 'governance.lock.json'));
  symlinkSync('/tmp', join(root, 'scripts'));
  const blocked = run(kit, ['scripts/init.mjs', '--target', root, '--tools', 'codex', '--write']);
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /软链接/);
});

test('session start injects only local cursor, latest five dated decisions and coordinates', (t) => {
  const root = project(t);
  writeFileSync(
    join(root, 'docs/SESSION.md'),
    '# Decisions\n' + Array.from({ length: 7 }, (_, i) => `- 2026-09-${20 + i} decision-${i}`).join('\n') + '\n',
  );
  const r = hook(root, 'session-start', { session_id: 's' });
  assert.equal(r.status, 0, r.stderr);
  const output = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  assert.match(output, /当前游标/);
  assert.match(output, /目录:.*gov-lite-test/);
  assert.match(output, /HEAD:/);
  assert.match(output, /decision-6/);
  assert.doesNotMatch(output, /decision-[01]\b/);
  assert.doesNotMatch(output, /认领|发现地图|联网|开机许可|github/);
  const compact = hook(root, 'session-start', { session_id: 's', source: 'compact' });
  assert.match(JSON.parse(compact.stdout).systemMessage, /坐标告警.*临时盘/);
});

test('Stop is silent for reads, blocks once for unrecorded changes, and never runs lint', (t) => {
  const root = project(t);
  const input = { session_id: 'stop' };
  hook(root, 'session-start', input);
  assert.deepEqual(JSON.parse(hook(root, 'stop', input).stdout), {});
  writeFileSync(join(root, 'app.js'), 'export const value=1;\n');
  // Broken wiring would make check fail, but Stop only assesses handoff.
  const wiring = join(root, '.codex/hooks.json');
  const conf = readJson(wiring);
  delete conf.hooks.Stop;
  putJson(wiring, conf);
  const first = JSON.parse(hook(root, 'stop', input).stdout);
  assert.equal(first.decision, 'block');
  assert.match(first.reason, /游标未更新/);
  assert.deepEqual(JSON.parse(hook(root, 'stop', input).stdout), {});
  assert.deepEqual(JSON.parse(hook(root, 'stop', { ...input, stop_hook_active: true }).stdout), {});
});

test('Stop accepts an updated roadmap and catches committed work since startup', (t) => {
  const root = project(t);
  const input = { session_id: 'committed' };
  hook(root, 'session-start', input);
  writeFileSync(join(root, 'app.js'), 'export const value=1;\n');
  git(root, 'add', '.');
  git(root, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'work');
  assert.equal(JSON.parse(hook(root, 'stop', input).stdout).decision, 'block');
  const second = { session_id: 'updated' };
  hook(root, 'session-start', second);
  writeFileSync(join(root, 'app.js'), 'export const value=2;\n');
  writeFileSync(join(root, 'ROADMAP.md'), readFileSync(join(root, 'ROADMAP.md'), 'utf8').replace('待填写', '已更新'));
  assert.deepEqual(JSON.parse(hook(root, 'stop', second).stdout), {});
});

test('dangerous command variants are denied and real cross-segment false positives stay allowed', () => {
  assert.ok(DANGERS.length <= 5);
  for (const command of [
    'cd x && /usr/bin/git reset --hard',
    'git reset --hard',
    '/usr/bin/git reset "--hard"',
    '(git reset --hard)',
    'bash -c "git reset --hard"',
    'git -C x reset --hard',
    'git clean -fd',
    '\\git reset --hard',
    '/usr/bin/git push origin main --force',
    'bash -c "echo hi && git push --force"',
    'sudo /usr/bin/git reset --hard',
    'env CHECK=1 git reset --hard',
    'git push origin main --force',
    'git push -f',
    'rm -rf /',
    'rm -rf .git',
  ])
    assert.ok(preTool(kit, { tool_name: 'Bash', tool_input: { command } }), command);
  for (const command of [
    'git status',
    'git push && tool --force',
    'git push; echo --force',
    'git push && git worktree remove --force old',
    'git reset --soft HEAD~1',
    'rm -rf /tmp/owned-cache',
    'grok -p hello',
    'git fetch',
    'git status; git log --oneline | head -3',
    'git commit -m "safe" && git push origin main',
    'echo "git reset --hard"',
  ])
    assert.equal(preTool(kit, { tool_name: 'Bash', tool_input: { command } }), '', command);
});

test('protectedPaths judges actual file targets and patch moves, never prose mentions', (t) => {
  const root = project(t);
  const policy = { protectedPaths: ['secret.txt'] };
  for (const data of [
    { file_path: 'secret.txt' },
    { path: join(root, 'secret.txt') },
    { file_path: 'a/../secret.txt' },
  ])
    assert.ok(preTool(root, { tool_name: 'Write', tool_input: data }, policy));
  assert.equal(
    preTool(root, { tool_name: 'Write', tool_input: { file_path: 'README.md', content: 'secret.txt' } }, policy),
    '',
  );
  assert.equal(preTool(root, { tool_name: 'Bash', tool_input: { command: 'cat secret.txt' } }, policy), '');
  assert.ok(
    preTool(
      root,
      {
        tool_name: 'apply_patch',
        tool_input: { command: '*** Begin Patch\n*** Update File: README.md\n*** Move to: secret.txt\n*** End Patch' },
      },
      policy,
    ),
  );
  assert.ok(preTool(root, { tool_name: 'Bash', tool_input: { command: 'echo x > secret.txt' } }, policy));
});

test('each runtime returns its real deny protocol', (t) => {
  const root = project(t);
  for (const runtime of ['codex', 'claude-code', 'grok']) {
    const r = hook(
      root,
      'pre-tool',
      { tool_name: 'Bash', tool_input: { command: 'cd x && /usr/bin/git reset --hard' } },
      runtime,
    );
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    if (runtime === 'grok') assert.equal(out.decision, 'deny');
    else assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  }
  const invalid = spawnSync(process.execPath, [join(root, 'scripts/governance.mjs'), 'pre-tool'], {
    cwd: root,
    input: '{',
    encoding: 'utf8',
  });
  assert.equal(invalid.status, 2);
});

test('check fails for missing Stop, wrong command, stale cursor, and disabled hooks', (t) => {
  const root = project(t);
  const p = join(root, '.codex/hooks.json');
  const original = readFileSync(p, 'utf8');
  const c = readJson(p);
  delete c.hooks.Stop;
  putJson(p, c);
  let r = hook(root, 'check');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Stop/);
  writeFileSync(p, original.replace('governance.mjs" stop', 'governance.mjs" session-start'));
  // Change parsed JSON so a text escape cannot make the negative probe vacuous.
  const wrong = readJson(p);
  wrong.hooks.Stop[0].hooks[0].command = 'true';
  putJson(p, wrong);
  r = hook(root, 'check');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Stop/);
  writeFileSync(p, original);
  writeFileSync(
    join(root, 'ROADMAP.md'),
    readFileSync(join(root, 'ROADMAP.md'), 'utf8').replace(/20\d{2}-\d{2}-\d{2}/g, '2000-01-01'),
  );
  r = hook(root, 'check');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /游标日期/);
  writeFileSync(join(root, '.codex/config.toml'), '[features]\nhooks = false\n');
  r = hook(root, 'check');
  assert.match(r.stderr, /hooks 未启用/);
});

test('real gitleaks blocks a synthetic credential; missing binary is failure, never skip', (t) => {
  const root = project(t);
  const fake = ['gh', 'p_', randomBytes(18).toString('hex')].join('');
  writeFileSync(join(root, 'leak.txt'), `github_token=${fake}\n`);
  git(root, 'add', 'leak.txt');
  let r = hook(root, 'check');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /gitleaks.*失败/);
  assert.ok(!r.stderr.includes(fake));
  rmSync(join(root, 'leak.txt'));
  r = hook(root, 'check');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /gitleaks git 失败/);
  git(root, 'rm', '--cached', '-q', 'leak.txt');
  const bin = join(root, '.git', 'isolated-bin');
  mkdirSync(bin);
  const gitPath = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
  symlinkSync(gitPath, join(bin, 'git'));
  r = hook(root, 'check', {}, 'generic', { PATH: bin });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /缺少 gitleaks.*fail-closed/);
});

test('symlink gate reads staged blob even if working tree points somewhere safe', (t) => {
  const root = project(t);
  symlinkSync('/tmp/outside-missing', join(root, 'outside-link'));
  git(root, 'add', 'outside-link');
  rmSync(join(root, 'outside-link'));
  symlinkSync('ROADMAP.md', join(root, 'outside-link'));
  let r = hook(root, 'check');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /仓外绝对路径软链接/);
  git(root, 'add', 'outside-link');
  r = hook(root, 'check');
  assert.equal(r.status, 0, r.stderr);
  symlinkSync(join(root, 'ROADMAP.md'), join(root, 'internal-link'));
  git(root, 'add', 'internal-link');
  r = hook(root, 'check');
  assert.equal(r.status, 0, r.stderr);
});

test('missing scanner makes installation fail without claiming acceptance', (t) => {
  const root = mkdtempSync('/tmp/gov-lite-no-scanner-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q');
  const bin = join(root, '.git', 'bin');
  mkdirSync(bin);
  symlinkSync(spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim(), join(bin, 'git'));
  const result = run(kit, ['scripts/init.mjs', '--target', root, '--tools', 'codex', '--write'], {}, { PATH: bin });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /缺少 gitleaks/);
  assert.doesNotMatch(result.stdout, /lite 自检通过/);
});

test('Stop ignores unchanged inherited WIP and compact never resets its baseline', (t) => {
  const root = project(t);
  writeFileSync(join(root, 'inherited.txt'), 'existing');
  const input = { session_id: 'inherited' };
  hook(root, 'session-start', input);
  assert.deepEqual(JSON.parse(hook(root, 'stop', input).stdout), {});
  writeFileSync(join(root, 'inherited.txt'), 'changed');
  hook(root, 'session-start', { ...input, source: 'compact' });
  writeFileSync(
    join(root, 'ROADMAP.md'),
    readFileSync(join(root, 'ROADMAP.md'), 'utf8') + '\nUnrelated footer change.\n',
  );
  assert.equal(JSON.parse(hook(root, 'stop', input).stdout).decision, 'block');
});

test('check detects broken matcher and credential ignore coverage', (t) => {
  const root = project(t);
  const path = join(root, '.codex/hooks.json');
  const c = readJson(path);
  c.hooks.PreToolUse[0].matcher = 'Read';
  putJson(path, c);
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  const result = hook(root, 'check');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /matcher 漏写入工具/);
  assert.match(result.stderr, /凭据派生文件未忽略/);
});

test('compact reports actual cwd even when invoked by absolute script path outside the project', (t) => {
  const root = project(t);
  const result = run('/tmp', [
    join(root, 'scripts/governance.mjs'),
    'session-start',
    '--compact',
    '--runtime',
    'codex',
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(JSON.parse(result.stdout).systemMessage, /坐标告警:.*不在 git 仓库.*临时盘/);
});

test('actual public init dispatches both retained v4 profiles', (t) => {
  for (const profile of ['standard', 'high-assurance']) {
    const root = mkdtempSync('/tmp/gov-v4-dispatch-');
    t.after(() => rmSync(root, { recursive: true, force: true }));
    git(root, 'init', '-q');
    const result = run(kit, [
      'scripts/init.mjs',
      '--target',
      root,
      '--profile',
      profile,
      '--runtime',
      'codex',
      '--write',
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /v4 兼容路径/);
    assert.ok(existsSync(join(root, 'scripts/governance-hooks/session-start-admission.mjs')));
    assert.equal(readJson(join(root, 'governance.lock.json')).profile, profile);
  }
});

test('ignored local credentials are allowed while force-staged credentials are rejected', (t) => {
  const root = project(t);
  writeFileSync(join(root, '.env'), `github_token=${['gh', 'p_', randomBytes(18).toString('hex')].join('')}\n`);
  let result = hook(root, 'check');
  assert.equal(result.status, 0, result.stderr);
  git(root, 'add', '-f', '.env');
  result = hook(root, 'check');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /gitleaks/);
});


test('local dates survive a UTC CI runner at the timezone day boundary', (t) => {
  const root = project(t);
  const result = hook(root, 'check', {}, 'generic', {TZ:'UTC'});
  assert.equal(result.status, 0, result.stderr);
  writeFileSync(join(root,'ROADMAP.md'), readFileSync(join(root,'ROADMAP.md'),'utf8').replace(/20\d{2}-\d{2}-\d{2}/g,'2100-01-01'));
  assert.notEqual(hook(root,'check').status,0);
});

test('same-day decision append order selects the latest five records', t => {
  const root=project(t);
  writeFileSync(join(root,'docs/SESSION.md'),Array.from({length:7},(_,i)=>`- 2026-09-26 same-day-${i}`).join('\n')+'\n');
  const text=JSON.parse(hook(root,'session-start').stdout).hookSpecificOutput.additionalContext;
  assert.match(text,/same-day-6/);assert.match(text,/same-day-2/);assert.doesNotMatch(text,/same-day-[01]\b/);
});

test('Stop allows the continuation once and can remind a later changed turn', t => {
  const root=project(t), input={session_id:'multi-turn'};hook(root,'session-start',input);
  writeFileSync(join(root,'work.js'),'one');assert.equal(JSON.parse(hook(root,'stop',input).stdout).decision,'block');
  assert.deepEqual(JSON.parse(hook(root,'stop',input).stdout),{});
  assert.deepEqual(JSON.parse(hook(root,'stop',input).stdout),{});
  writeFileSync(join(root,'work.js'),'two');assert.equal(JSON.parse(hook(root,'stop',input).stdout).decision,'block');
  assert.deepEqual(JSON.parse(hook(root,'stop',{...input,stop_hook_active:true}).stdout),{});
});

test('hooks=true outside the features table cannot hide disabled Codex hooks', t => {
  const root=project(t);
  writeFileSync(join(root,'.codex/config.toml'),'[features]\nhooks = false\n[unrelated]\nhooks = true\n');
  const result=hook(root,'check');assert.notEqual(result.status,0);assert.match(result.stderr,/hooks 未启用/);
});

test('installer rejects non-repository and nested targets before creating governance files', (t) => {
  const root = mkdtempSync('/tmp/gov-lite-root-boundary-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const plain = run(kit, ['scripts/init.mjs', '--target', root, '--tools', 'codex', '--write']);
  assert.notEqual(plain.status, 0);
  assert.deepEqual(readdirSync(root), [], 'failed installation must not leave a partial tree outside Git');
  git(root, 'init', '-q');
  const nested = join(root, 'nested');
  mkdirSync(nested);
  const child = run(kit, ['scripts/init.mjs', '--target', nested, '--tools', 'codex', '--write']);
  assert.notEqual(child.status, 0, 'hook command resolves the Git root, so a child cannot be a valid installation');
  assert.deepEqual(readdirSync(nested), []);
});

test('check detects missing Codex exec_command matcher even if other write tools remain', (t) => {
  const root = project(t, 'codex');
  const path = join(root, '.codex/hooks.json'), config = readJson(path);
  config.hooks.PreToolUse[0].matcher = config.hooks.PreToolUse[0].matcher.replace('|exec_command', '');
  putJson(path, config);
  const result = hook(root, 'check');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /matcher 漏写入工具/);
});
