#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, lstatSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve, basename, relative } from 'node:path';
import { KIT_ROOT, VERSION, parseArgs, render } from './lib.mjs';
import { TOOL_PATHS, localDate, roadmapPath, cursor } from './governance.mjs';

const args = parseArgs(process.argv.slice(2));
const profile = String(args.profile || 'lite');
if (['standard', 'high-assurance'].includes(profile)) {
  console.error(`[init] ${profile} 是 v4 兼容路径，保留旧行为；新项目建议 lite。`);
  const r = spawnSync(process.execPath, [join(KIT_ROOT, 'scripts/init-v4.mjs'), ...process.argv.slice(2)], {
    stdio: 'inherit',
  });
  process.exit(r.status ?? 1);
}
if (profile !== 'lite') fail(`未知 profile: ${profile}`);
for (const key of Object.keys(args))
  if (!['_', 'profile', 'target', 'tools', 'runtime', 'project-name', 'write'].includes(key))
    fail(`Lite 不支持 --${key}；存量迁移请按 BOOTSTRAP.md 保留事实并审查差异`);
if (!args.target || !existsSync(String(args.target))) fail('需要已存在的 --target');
const target = resolve(String(args.target));
const repository = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: target, encoding: 'utf8' });
if (repository.status !== 0 || realpathSync(repository.stdout.trim()) !== realpathSync(target))
  fail('--target 必须是 Git 仓库根目录；不会向非仓库或仓库子目录写入接线');
let tools = String(args.tools || args.runtime || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (!tools.length)
  tools = Object.entries(TOOL_PATHS)
    .filter(([, p]) => existsSync(join(target, p)))
    .map(([t]) => t);
if (!tools.length) fail('请按实际工具提供 --tools claude-code,codex[,grok]；纯手动检查可选 generic');
tools = [...new Set(tools)].sort();
if (
  tools.some((t) => ![...Object.keys(TOOL_PATHS), 'generic'].includes(t)) ||
  (tools.includes('generic') && tools.length !== 1)
)
  fail('tools 只接受 claude-code,codex,grok，或单独 generic');
const lockPath = join(target, 'governance.lock.json');
if (existsSync(lockPath)) {
  const previous = JSON.parse(readFileSync(lockPath, 'utf8'));
  if (previous.schemaVersion !== 2 || previous.profile !== 'lite')
    fail('已有 v4 安装：init 不迁移、不覆盖，按 BOOTSTRAP.md 三步迁移');
  if (JSON.stringify([...previous.tools].sort()) !== JSON.stringify(tools))
    fail('已有 Lite 工具集合不同：先审查并合并接线，再更新铭牌');
}
const today = localDate();
const roadmap = roadmapPath(target);
const existingRoadmap = existsSync(join(target, roadmap));
const values = {
  PROJECT_NAME: String(args['project-name'] || basename(target)),
  TODAY: today,
  ROADMAP_PATH: roadmap,
  ROADMAP_FROM_DOCS: relative('docs', roadmap),
};
const plan = new Map();
for (const file of [
  'AGENTS.md',
  'CLAUDE.md',
  'docs/index.md',
  'docs/SESSION.md',
  'governance/policy.json',
  '.gitignore',
]) {
  plan.set(file, render(readFileSync(join(KIT_ROOT, 'templates/lite', file), 'utf8'), values));
}
plan.set(roadmap, render(readFileSync(join(KIT_ROOT, 'templates/lite/ROADMAP.md'), 'utf8'), values));
plan.set('scripts/governance.mjs', readFileSync(join(KIT_ROOT, 'scripts/governance.mjs'), 'utf8'));
for (const tool of tools) {
  if (!TOOL_PATHS[tool]) continue;
  const hooks = {};
  for (const [event, sub] of [
    ['SessionStart', 'session-start'],
    ['PreToolUse', 'pre-tool'],
    ['Stop', 'stop'],
  ]) {
    const entry = {
      hooks: [
        {
          type: 'command',
          command: `node "$(git rev-parse --show-toplevel)/scripts/governance.mjs" ${sub} --runtime ${tool}`,
          timeout: 10,
        },
      ],
    };
    if (event === 'SessionStart') entry.matcher = 'startup|resume|clear|compact';
    if (event === 'PreToolUse')
      entry.matcher = 'Bash|run_terminal_command|exec_command|apply_patch|Edit|Write|MultiEdit|search_replace';
    hooks[event] = [entry];
  }
  plan.set(TOOL_PATHS[tool], JSON.stringify({ hooks }, null, 2) + '\n');
  if (tool === 'codex') plan.set('.codex/config.toml', '[features]\nhooks = true\n');
}
plan.set(
  'governance.lock.json',
  JSON.stringify({ schemaVersion: 2, playbookVersion: VERSION, profile: 'lite', installedAt: today, tools }, null, 2) +
    '\n',
);
// Do not follow an existing symlink into another repository while installing.
for (const [file] of plan) {
  let p = join(target, file);
  while (p !== dirname(target)) {
    try {
      if (lstatSync(p).isSymbolicLink()) fail(`安装目标包含软链接: ${file}`);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    if (p === target) break;
    p = dirname(p);
  }
  console.log(`${existsSync(join(target, file)) ? 'KEEP' : 'WRITE'} ${file}`);
}
if (existingRoadmap && !/\b20\d{2}-\d{2}-\d{2}\b/.test(cursor(readFileSync(join(target, roadmap), 'utf8'))))
  console.log(`[init] 需在现有路线图加当前游标段（带日期）：${roadmap}；项目文件保持原样。`);
if (!args.write) {
  console.log('dry-run完成；加入 --write 才写文件。');
  process.exit(0);
}
for (const [file, body] of plan) {
  const p = join(target, file);
  if (existsSync(p)) continue;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
}
// Static wiring is not client trust or a completed project handoff; real scanner required even on day one.
const r = spawnSync(process.execPath, [join(target, 'scripts/governance.mjs'), 'check'], {
  cwd: target,
  stdio: 'inherit',
});
if (r.status !== 0) fail('安装后自检失败；保留文件供修复，不宣称验收通过。缺 gitleaks 必须安装后重测。');
console.log(
  `[init] lite 自检通过；${plan.size} 文件。填写意图/游标，真实客户端验活；建议将 node scripts/governance.mjs check 接入项目 pre-commit。`,
);
function fail(message) {
  console.error(`[init] ${message}`);
  process.exit(1);
}
