#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

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
