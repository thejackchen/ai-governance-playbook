#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const root = resolve(arg("--root") || process.cwd());
const errors = [];
const warnings = [];
const read = (p) => readFileSync(join(root, p), "utf8");
const required = (p) => {
  if (!existsSync(join(root, p))) errors.push(`缺少文件: ${p}`);
};

required("governance.lock.json");
if (errors.length) finish();

let lock;
try {
  lock = JSON.parse(read("governance.lock.json"));
} catch (e) {
  errors.push(`governance.lock.json 无法解析: ${e.message}`);
  finish();
}

for (const p of lock.installedFiles || []) required(p);
if (lock.runtime === "codex") {
  ["AGENTS.md", "CLAUDE.md", ".codex/config.toml", ".codex/hooks.json", ".codex/rules/default.rules"].forEach(required);
} else if (lock.runtime === "claude-code") {
  ["CLAUDE.md", "AGENTS.md", ".claude/settings.json"].forEach(required);
} else {
  required("AGENTS.md");
}

for (const p of lock.installedFiles || []) {
  const full = join(root, p);
  if (!existsSync(full) || !/\.(md|json|toml|rules|mjs)$/.test(p)) continue;
  const body = readFileSync(full, "utf8");
  const placeholders = [...body.matchAll(/\{\{[A-Z0-9_]+\}\}/g)].map((m) => m[0]);
  if (placeholders.length) errors.push(`${p} 残留占位符: ${[...new Set(placeholders)].join(", ")}`);
}

// 死链扫描范围 = installedFiles ∪ 目标根目录全部 *.md。
// 只扫installedFiles会漏掉CORE.md/README.md这类自托管文档——它们是真实交付内容，
// 但从未登记进governance.lock.json，之前死链检测对它们完全失明。
// 目录级排除 templates/（含extensions/*/templates）：那是渲染前的模板源，双花括号占位符
// 出现在链接目标里是设计如此，不是死链——与validate-kit.mjs对占位符残留的排除口径一致。
const markdownFiles = new Set((lock.installedFiles || []).filter((p) => p.endsWith(".md")));
for (const full of collectMarkdownFiles(root)) markdownFiles.add(relative(root, full));
for (const p of markdownFiles) {
  const full = join(root, p);
  if (!existsSync(full)) continue;
  const body = readFileSync(full, "utf8");
  for (const m of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = m[1].trim().replace(/^<|>$/g, "").split("#")[0];
    if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
    const resolved = isAbsolute(target) ? target : resolve(dirname(full), target);
    if (!existsSync(resolved)) errors.push(`${p} 死链: ${m[1]}`);
  }
}

try {
  const policy = JSON.parse(read("governance/policy.json"));
  if (policy.schemaVersion !== 1) errors.push("governance/policy.json schemaVersion 必须为 1");
  for (const key of ["denyCommandPatterns", "fastChecks", "ciChecks", "protectedPaths", "allowedTopLevelEntries"]) {
    if (!Array.isArray(policy[key])) errors.push(`governance/policy.json ${key} 必须是数组`);
  }
  for (const pattern of policy.denyCommandPatterns || []) {
    try { new RegExp(pattern, "i"); } catch (e) { errors.push(`非法 denyCommandPatterns 正则: ${pattern}`); }
  }
  if (lock.profile !== "lite" && !(policy.ciChecks || []).length) warnings.push("尚未登记项目级 ciChecks；当前CI只验证治理结构");
  if ((policy.allowedTopLevelEntries || []).length) {
    const allowed = new Set(policy.allowedTopLevelEntries);
    const ignored = new Set([".git", ".DS_Store"]);
    for (const name of readdirSync(root)) {
      if (!ignored.has(name) && !allowed.has(name)) errors.push(`未知顶层项: ${name}（更新仓库结构地图和allowedTopLevelEntries，或移走该文件）`);
    }
  }
} catch (e) {
  errors.push(`governance/policy.json 无法解析: ${e.message}`);
}

if (existsSync(join(root, "governance/registry.md"))) {
  const count = (read("governance/registry.md").match(/^\| R\d+ \|/gm) || []).length;
  if (count > Number(lock.ruleBudget || 0)) errors.push(`规则预算超限: ${count}/${lock.ruleBudget}`);
}

// ── 反向覆盖检查：载体在跑，却没登记进 registry ──
// 既有检查只验「登记的东西是否存在」(installedFiles)；反过来「实际在跑却没登记」以前无人看守。
// 母版(产品中心)2026-07-25 实证：手写台账停摆 15 天，4 类正在运行的载体(CI 步骤/新 hook/新门禁)全部漏登，
// 而漏登的恰恰是被真实事故逼出来的那批——预算读数因此失真，「还能不能再加一条规则」的判断建立在假数上。
// 判例：governance/cases/2026-07-25-自动账本活手写账本死.md（凡可枚举的事实交机器，手写只留判断）。
// warn 而非 error：新检查对存量项目一律先观察，不在升级当天打断任何人的 CI。
if (existsSync(join(root, "governance/registry.md"))) {
  const registryBody = read("governance/registry.md");
  const carriers = [];
  const pushDir = (dir, label) => {
    let names = [];
    try { names = readdirSync(join(root, dir)); } catch { return; }
    for (const name of names) {
      try { if (!statSync(join(root, dir, name)).isFile()) continue; } catch { continue; }
      carriers.push({ id: name, label: `${label} ${name}` });
    }
  };
  pushDir(".githooks", "git hook");
  pushDir(".github/workflows", "CI workflow");
  const unregistered = carriers.filter((c) => !registryBody.includes(c.id));
  for (const c of unregistered) {
    warnings.push(`载体在跑但未登记进 registry.md: ${c.label}——登记它，或说明为何不算治理载体`);
  }
}

// 凭据文件的派生形态必须一并被忽略(判例:2026-07-25-忽略规则要覆盖派生形态)。
// 六个仓实测四个漏 —— 大家都写了 `.env.local`,但 `.bak/.old/.save/~` 是加在末尾的后缀,
// 那条规则匹配不到。而造这类文件的不是人的疏忽,是工具的日常行为(编辑器备份/手工 cp/恢复脚本)。
// 验证必须用 `git check-ignore` 而非读 .gitignore —— 读规则是「我以为」,check-ignore 是「确实挡住了」。
{
  const derived = [".env.local.bak", ".env.local.old", ".env.local.save", ".env.local~", ".env.production"];
  const missing = derived.filter((name) => {
    try {
      execFileSync("git", ["check-ignore", "-q", name], { cwd: root, stdio: "ignore" });
      return false;
    } catch {
      return true;   // 退出码非 0 = 未被忽略
    }
  });
  if (missing.length) {
    errors.push(
      `凭据派生文件未被忽略(${missing.join(" / ")}) — 一次 \`git add -A\` 即入库。` +
      "修法:.gitignore 用 `.env.*` + `!.env.example` 覆盖整族,别逐个列举文件名",
    );
  }
}

finish();

function finish() {
  for (const item of warnings) console.warn(`[governance] WARN ${item}`);
  for (const item of errors) console.error(`[governance] ERROR ${item}`);
  console.log(`[governance] ${errors.length} error / ${warnings.length} warn`);
  process.exit(errors.length ? 1 : 0);
}

function collectMarkdownFiles(dir, out = []) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === ".git" || name === "node_modules" || name === "templates") continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) collectMarkdownFiles(full, out);
    else if (name.endsWith(".md")) out.push(full);
  }
  return out;
}
