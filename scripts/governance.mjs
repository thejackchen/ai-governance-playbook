#!/usr/bin/env node
// Portable project runtime. No network, model, package dependency or boot permit.
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  lstatSync,
  realpathSync,
  mkdtempSync,
  cpSync,
  rmSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { dirname, resolve, join, relative, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const TOOL_PATHS = {
  codex: '.codex/hooks.json',
  'claude-code': '.claude/settings.json',
  grok: '.grok/hooks/governance.json',
};
export const DANGERS = [
  /^git(?:\s+(?:-C\s+\S+|-c\s+\S+|--git-dir(?:=\S+|\s+\S+)|--work-tree(?:=\S+|\s+\S+)))*\s+reset\b[^\n]*--hard(?:\s|$)/i,
  /^git(?:\s+(?:-C\s+\S+|-c\s+\S+))*\s+clean\b[^\n]*\s(?:-[^-\s]*[fx][^\s]*|--force)(?:\s|$)/i,
  /^git(?:\s+(?:-C\s+\S+|-c\s+\S+))*\s+push\b[^\n]*\s(?:--force(?:-with-lease)?(?:=\S+)?|-[^-\s]*f[^\s]*)(?:\s|$)/i,
  /^rm\s+(?=[^\n]*(?:-[^\s]*r|--recursive))[^\n]*\s\/(?:\s|$)/i,
  /^rm\s+(?=[^\n]*(?:-[^\s]*r|--recursive))[^\n]*\s(?:\S*\/)?\.git\/?(?:\s|$)/i,
];
const hash = (s) => createHash('sha256').update(s).digest('hex');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const gitRun = (root, args) =>
  spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 16 * 1024 * 1024 });
const git = (root, args) => {
  const r = gitRun(root, args);
  return r.status === 0 ? r.stdout.trimEnd() : '';
};
const inside = (root, p) => {
  const r = relative(root, p);
  return !isAbsolute(r) && r !== '..' && !r.startsWith('../');
};
const roadmapPath = (root) => ['ROADMAP.md', 'docs/ROADMAP.md'].find((p) => existsSync(join(root, p))) || 'ROADMAP.md';
const cursor = (body) => body.match(/^## 当前游标[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1]?.trim() || '';
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Segment BEFORE matching: `git push && tool --force` must never become force-push.
// A conservative string guard, not a complete shell parser (interpreters/substitution remain outside its scope).
export function commandCandidates(command) {
  const queue = [command],
    seen = new Set(),
    out = new Set();
  while (queue.length && seen.size < 48) {
    const raw = String(queue.shift() || '').trim();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    const unwrap = (s) => {
      const m = s.match(/^(?:(?:\S*\/)?(?:bash|sh|zsh)\s+(?:-\S+\s+)*-c|eval)\s+([\s\S]+)$/);
      return m?.[1]?.replace(/^(['"])([\s\S]*)\1$/, '$2');
    };
    const whole = unwrap(raw);
    if (whole) queue.push(whole);
    for (const part of raw.split(/(?:\|\||&&|[;|&\n])+/).filter(Boolean)) {
      const normalized = part
        .trim()
        .replace(/^\((.*)\)$/, '$1')
        .split(/\s+/)
        .map((t) => t.replace(/^(['"])(.*)\1$/, '$2').replace(/^\\+/, ''))
        .join(' ')
        .replace(/^(?:\S*\/)(git|rm|bash|sh|zsh|env|sudo|command)(?=\s)/, '$1');
      out.add(normalized);
      const unwrapped = normalized.replace(/^(?:(?:env|command|sudo)\s+|[A-Za-z_]\w*=\S+\s+)+/, '');
      if (unwrapped !== normalized) queue.push(unwrapped);
      const inner = unwrap(normalized);
      if (inner) queue.push(inner);
    }
  }
  return [...out];
}

function canonicalTarget(p) {
  let base = resolve(p),
    tail = [];
  while (!existsSync(base) && dirname(base) !== base) {
    tail.unshift(basename(base));
    base = dirname(base);
  }
  return join(realpathSync(base), ...tail);
}
export function preTool(root, input, policy = {}) {
  const tool = input.tool_name || input.toolName || '';
  const data = input.tool_input || input.toolInput || {};
  const command = String(data.command || data.cmd || '');
  if (/^(Bash|run_terminal_command|exec_command)$/i.test(tool)) {
    if (commandCandidates(command).some((c) => DANGERS.some((re) => re.test(c)))) return '命令命中治理禁止模式';
  }
  const paths = [];
  if (/^(apply_patch|Edit|Write|MultiEdit|search_replace)$/i.test(tool)) {
    for (const item of [data, ...(Array.isArray(data.edits) ? data.edits : [])]) {
      const p = item.file_path || item.notebook_path || item.path;
      if (p) paths.push(p);
    }
    if (/^apply_patch$/i.test(tool)) {
      for (const m of String(data.patch || data.input || command).matchAll(
        /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm,
      ))
        paths.push(m[1]);
    }
  }
  const protectedPaths = policy.protectedPaths || [];
  if (!Array.isArray(protectedPaths) || protectedPaths.some((p) => typeof p !== 'string' || !p))
    return 'protectedPaths 配置无效';
  const targets = paths.map((p) => canonicalTarget(resolve(input.cwd || root, p)));
  for (const p of protectedPaths) {
    const target = canonicalTarget(resolve(root, p));
    if (targets.some((t) => t === target || inside(target, t))) return `受保护目标路径: ${p}`;
    // Shell targets only; quoting a path in documentation or a commit message is allowed.
    if (/^(Bash|run_terminal_command|exec_command)$/i.test(tool)) {
      const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const writes = new RegExp(
        `(?:>>?\\s*|\\btee\\s+(?:-a\\s+)?|\\bsed\\s+-i[^|;&]*\\s|\\b(?:mv|cp)\\s+[^|;&]*\\s)["']?(?:\\S*/)?${esc}(?:["']?(?:\\s|$))`,
      );
      if (commandCandidates(command).some((c) => writes.test(c))) return `受保护目标路径: ${p}`;
    }
  }
  return '';
}

function snapshot(root) {
  const status = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const chunks = [git(root, ['rev-parse', 'HEAD^{tree}']), status];
  const records = status.split('\0');
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    if (!row) continue;
    const p = join(root, row.slice(3));
    if (/R|C/.test(row.slice(0, 2))) i++;
    try {
      if (lstatSync(p).isFile()) chunks.push(hash(readFileSync(p)));
    } catch {
      /* deleted file */
    }
  }
  return {
    changed: hash(chunks.join('\0')),
    dirty: !!status,
    roadmap: hash(cursor(read(join(root, roadmapPath(root))))),
  };
}
function statePath(root, input, runtime) {
  const dir = git(root, ['rev-parse', '--absolute-git-dir']);
  if (!dir) return '';
  return join(dir, 'governance-lite', `${hash(`${runtime}:${input.session_id || 'manual'}`).slice(0, 24)}.json`);
}
function saveState(p, value) {
  if (!p) return;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(value), { mode: 0o600 });
}
export function sessionStart(root, input = {}, runtime = 'generic', compact = false) {
  const location = resolve(input.cwd || root);
  const repo = git(location, ['rev-parse', '--show-toplevel']);
  const branch = git(location, ['symbolic-ref', '--quiet', '--short', 'HEAD']) || 'DETACHED';
  const head = git(location, ['rev-parse', '--short', 'HEAD']) || 'unborn';
  const temporary = /^\/(?:private\/)?tmp(?:\/|$)|\/var\/folders\//.test(location);
  const warnings = [!repo && '不在 git 仓库', temporary && '临时盘(/tmp)：请落盘到持久正本'].filter(Boolean);
  const coords = [
    `目录: ${location}`,
    `分支: ${branch}`,
    `HEAD: ${head}`,
    ...(warnings.length ? [`坐标告警: ${warnings.join('；')}`] : []),
  ];
  const decisions = read(join(root, 'docs/SESSION.md'))
    .split('\n')
    .filter((s) => /^- 20\d{2}-\d{2}-\d{2}\b/.test(s))
    .reverse() // Same-day decisions are append-only: later records come first.
    .sort((a, b) => b.slice(2, 12).localeCompare(a.slice(2, 12)))
    .slice(0, 5);
  if (!compact) saveState(statePath(root, input, runtime), { ...snapshot(root), warned: false });
  return [
    ...coords,
    '当前游标:',
    cursor(read(join(root, roadmapPath(root)))) || '缺少当前游标，请更新 ROADMAP',
    '最近 5 条带日期决策:',
    ...decisions,
  ].join('\n');
}
export function stop(root, input = {}, runtime = 'generic') {
  const p = statePath(root, input, runtime);
  let before;
  try {
    before = json(p);
  } catch {
    /* no startup: conservative dirty check */
  }
  const now = snapshot(root);
  const changed = before ? now.changed !== before.changed : now.dirty;
  const oldRoadmap = before?.roadmap || hash(cursor(git(root, ['show', `HEAD:${roadmapPath(root)}`])));
  if (input.stop_hook_active === true || before?.warned || !changed || now.roadmap !== oldRoadmap) {
    saveState(p, { ...now, warned: false }); // Close this turn; later work gets its own reminder.
    return '';
  }
  saveState(p, { ...(before || now), warned: true });
  return '本轮有代码/文档改动，但 ROADMAP 游标未更新。请将状态、验证结果和下一步落盘；本次只提醒一次。';
}

export function check(root) {
  const errors = [];
  const need = (p) => {
    if (!existsSync(join(root, p))) errors.push(`缺少 ${p}`);
  };
  for (const p of [
    'AGENTS.md',
    'CLAUDE.md',
    'docs/index.md',
    'docs/SESSION.md',
    'scripts/governance.mjs',
    'governance.lock.json',
    'governance/policy.json',
    roadmapPath(root),
  ])
    need(p);
  let lock = {},
    policy = {};
  try {
    lock = json(join(root, 'governance.lock.json'));
  } catch {
    errors.push('铭牌不可读');
  }
  if (
    lock.profile !== 'lite' ||
    !Array.isArray(lock.tools) ||
    !lock.tools.length ||
    lock.tools.some((t) => !TOOL_PATHS[t] && t !== 'generic')
  )
    errors.push('铭牌 profile/tools 无效');
  if (!/^\d+\.\d+\.\d+$/.test(lock.playbookVersion || '') || !/^\d{4}-\d{2}-\d{2}$/.test(lock.installedAt || ''))
    errors.push('铭牌版本/日期无效');
  try {
    policy = json(join(root, 'governance/policy.json'));
    if (!Array.isArray(policy.protectedPaths) || policy.protectedPaths.some(p => typeof p !== 'string' || !p))
      errors.push('protectedPaths 必须是非空路径字符串数组');
  } catch {
    errors.push('policy 不可读');
  }
  const agents = read(join(root, 'AGENTS.md')),
    claude = read(join(root, 'CLAUDE.md'));
  if (claude !== agents && !(claude.split('\n').length <= 24 && /\]\(AGENTS\.md\)/.test(claude)))
    errors.push('CLAUDE.md 必须桥接 AGENTS.md，禁止两份漂移宪法');
  const activeCursor = cursor(read(join(root, roadmapPath(root))));
  const date = activeCursor.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  const today = localDate();
  if (
    !date ||
    !Number.isFinite(Date.parse(date)) ||
    (Date.parse(today) - Date.parse(date)) / 86400000 > 7 ||
    (Date.parse(date) - Date.parse(today)) / 86400000 > 1
  )
    errors.push('ROADMAP 当前游标日期缺失、过旧或超出时区一天容差');
  for (const tool of lock.tools || []) {
    if (!TOOL_PATHS[tool]) continue;
    need(TOOL_PATHS[tool]);
    try {
      const config = json(join(root, TOOL_PATHS[tool]));
      for (const [event, sub] of [
        ['SessionStart', 'session-start'],
        ['PreToolUse', 'pre-tool'],
        ['Stop', 'stop'],
      ]) {
        const entries = config.hooks?.[event] || [];
        const hooks = entries.flatMap((e) => e.hooks || []);
        const expected = `node "$(git rev-parse --show-toplevel)/scripts/governance.mjs" ${sub} --runtime ${tool}`;
        if (!hooks.some((h) => h.type === 'command' && h.command === expected))
          errors.push(`${tool} ${event} 接线缺失或无效`);
        if (
          event === 'PreToolUse' &&
          !entries.some(
            (e) =>
              !e.matcher ||
              e.matcher === '*' ||
              ['Bash', 'apply_patch', 'Edit', 'Write', 'MultiEdit', 'search_replace', 'run_terminal_command'].every(
                (t) => {
                  try {
                    return new RegExp(e.matcher).test(t);
                  } catch {
                    return false;
                  }
                },
              ),
          )
        )
          errors.push(`${tool} PreToolUse matcher 漏写入工具`);
        if (
          event === 'SessionStart' &&
          !entries.some(
            (e) =>
              !e.matcher ||
              e.matcher === '*' ||
              (() => {
                try {
                  return new RegExp(e.matcher).test('compact');
                } catch {
                  return false;
                }
              })(),
          )
        )
          errors.push(`${tool} SessionStart 未覆盖 compact`);
      }
      if (tool === 'codex') {
        const features = read(join(root, '.codex/config.toml')).match(/^\[features\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1] || '';
        if (!/^hooks\s*=\s*true\s*(?:#.*)?$/m.test(features)) errors.push('Codex hooks 未启用');
      }
    } catch {
      errors.push(`${tool} hook JSON 无效`);
    }
  }
  const indexed = gitRun(root, ['ls-files', '--stage', '-z']);
  if (indexed.status !== 0) errors.push('git index 不可读');
  else
    for (const entry of indexed.stdout.split('\0')) {
      const m = entry.match(/^120000 ([a-f0-9]+) \d\t([\s\S]+)$/);
      if (!m) continue;
      const blob = gitRun(root, ['cat-file', 'blob', m[1]]);
      if (blob.status !== 0) { errors.push(`软链接 blob 不可读: ${m[2]}`); continue; }
      const target = blob.stdout;
      if (isAbsolute(target) && !inside(realpathSync(root), canonicalTarget(target)))
        errors.push(`仓外绝对路径软链接禁止提交: ${m[2]}`);
    }
  const ignore = ['.env', '.env.local.bak', '.env.production.old', '.env.local.save'];
  for (const p of ignore)
    if (gitRun(root, ['check-ignore', '--no-index', '-q', p]).status !== 0) errors.push(`凭据派生文件未忽略: ${p}`);
  scanSecrets(root, errors);
  return errors;
}

// Scan commit-eligible files, not ignored local secrets or dependency caches.
// Also scan the real index diff: cleaning the worktree must not hide a staged leak.
function scanSecrets(root, errors) {
  const scratch = mkdtempSync(join(tmpdir(), 'governance-scan-'));
  try {
    const files = gitRun(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']);
    if (files.status !== 0) {
      errors.push('git 文件清单不可读，凭据扫描失败');
      return;
    }
    for (const name of new Set(files.stdout.split('\0').filter(Boolean))) {
      const source = join(root, name);
      if (!existsSync(source) || !lstatSync(source).isFile()) continue;
      if (!inside(root, canonicalTarget(source))) {
        errors.push(`工作树路径越界: ${name}`);
        continue;
      }
      const target = join(scratch, name);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(source, target);
    }
    for (const args of [
      ['dir', scratch],
      ['git', '--pre-commit', '--staged', root],
    ]) {
      const scan = spawnSync('gitleaks', [...args, '--redact', '--no-banner', '--log-level', 'error'], {
        cwd: root,
        encoding: 'utf8',
        timeout: 60000,
      });
      if (scan.error || scan.status !== 0)
        errors.push(
          `gitleaks ${args[0]} 失败${scan.error?.code === 'ENOENT' ? '：缺少 gitleaks（fail-closed）' : '：发现凭据或扫描失败，请本地用 --redact 复核'}`,
        );
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

export function main(argv = process.argv.slice(2)) {
  const sub = argv.shift(),
    options = {};
  while (argv.length) {
    const key = argv.shift();
    if (key === '--compact') options.compact = true;
    else if (['--root', '--runtime'].includes(key) && argv[0] && !argv[0].startsWith('--'))
      options[key.slice(2)] = argv.shift();
    else throw new Error(`未知参数: ${key}`);
  }
  if (!['session-start', 'pre-tool', 'stop', 'check'].includes(sub))
    throw new Error(
      '用法: governance.mjs session-start|pre-tool|stop|check [--runtime codex|claude-code|grok|generic]',
    );
  const runtime = options.runtime || 'generic';
  if (!['generic', ...Object.keys(TOOL_PATHS)].includes(runtime)) throw new Error('未知 runtime');
  const root = realpathSync(resolve(options.root || join(dirname(fileURLToPath(import.meta.url)), '..')));
  let input = {};
  if (sub !== 'check' && !process.stdin.isTTY) input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  input.cwd ||= process.cwd();
  if (sub === 'check') {
    const errors = check(root);
    errors.forEach((e) => console.error(`[governance] ERROR ${e}`));
    console.log(`[governance] ${errors.length} error`);
    process.exitCode = errors.length ? 1 : 0;
    return;
  }
  if (sub === 'session-start') {
    const compact = options.compact || input.source === 'compact' || input.hook_event_name === 'PreCompact';
    const context = sessionStart(root, input, runtime, compact);
    console.log(
      runtime === 'generic' || runtime === 'grok'
        ? context
        : JSON.stringify({
            systemMessage: context,
            hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
          }),
    );
  } else {
    const reason =
      sub === 'stop' ? stop(root, input, runtime) : preTool(root, input, json(join(root, 'governance/policy.json')));
    if (!reason) {
      if (sub === 'stop') console.log('{}');
      return;
    }
    console.log(
      JSON.stringify(
        sub === 'pre-tool' && runtime !== 'grok'
          ? {
              hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: reason,
              },
            }
          : { decision: runtime === 'grok' && sub === 'pre-tool' ? 'deny' : 'block', reason },
      ),
    );
  }
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(`[governance] ${e instanceof SyntaxError ? 'JSON 输入或配置无法解析' : e.message}`);
    process.exitCode = process.argv[2] === 'pre-tool' ? 2 : 1;
  }
}
