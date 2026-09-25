#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { KIT_ROOT, walkFiles } from "./lib.mjs";

const errors = [];
for (const p of [
  "CORE.md", "BOOTSTRAP.md", "VERSION",
  "profiles/lite.json", "profiles/standard.json", "profiles/high-assurance.json",
  "adapters/codex/adapter.json", "adapters/claude-code/adapter.json", "adapters/generic/adapter.json"
]) if (!existsSync(join(KIT_ROOT, p))) errors.push(`缺少kit文件: ${p}`);

// VERSION是治理基版锚点（下游lock登记与上游比对用）；package.json是其副本，漂移即错
if (existsSync(join(KIT_ROOT, "VERSION"))) {
  const anchor = readFileSync(join(KIT_ROOT, "VERSION"), "utf8").trim();
  const pkg = JSON.parse(readFileSync(join(KIT_ROOT, "package.json"), "utf8"));
  if (pkg.version !== anchor) errors.push(`版本漂移: VERSION锚点=${anchor}，package.json version=${pkg.version}`);

  // 本仓库自托管铭牌，governance.lock.json.playbookVersion同样必须追平VERSION锚点，
  // 否则下游对账（events/上游比对）会用一个过期版本号误判基版
  if (existsSync(join(KIT_ROOT, "governance.lock.json"))) {
    const lock = JSON.parse(readFileSync(join(KIT_ROOT, "governance.lock.json"), "utf8"));
    if (lock.playbookVersion !== anchor) errors.push(`自托管governance.lock.json版本漂移: VERSION锚点=${anchor}，playbookVersion=${lock.playbookVersion}`);
  }
}

for (const file of walkFiles(KIT_ROOT).filter((p) => /\.(mjs|js)$/.test(p) && !p.includes("/.git/"))) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) errors.push(`语法失败: ${file}\n${result.stderr}`);
}

for (const file of walkFiles(KIT_ROOT).filter((p) => /\.(md|json|toml|rules)$/.test(p) && !p.includes("/.git/") && !p.includes("/templates/") && !p.includes("/extensions/frontend-design-system/templates/"))) {
  if (/\{\{[A-Z0-9_]+\}\}/.test(readFileSync(file, "utf8"))) errors.push(`非模板文件残留占位符: ${file}`);
}

for (const runtime of ["codex", "claude-code", "generic"]) {
  try {
    const adapter = JSON.parse(readFileSync(join(KIT_ROOT, "adapters", runtime, "adapter.json"), "utf8"));
    if (adapter.name !== runtime) errors.push(`${runtime} adapter name不匹配`);
    if (adapter.filesRoot && !existsSync(join(KIT_ROOT, adapter.filesRoot))) errors.push(`${runtime} filesRoot不存在`);
  } catch (e) { errors.push(`${runtime} adapter无法解析: ${e.message}`); }
}

// 自托管允许选择不同 Profile；接线行为由集成测试验证，不以副本字节相等锁死演化。

for (const [file, limit] of [["CORE.md",150],["BOOTSTRAP.md",120],["templates/lite/AGENTS.md",80]]) {
  if (readFileSync(join(KIT_ROOT,file),"utf8").trimEnd().split("\n").length > limit) errors.push(`${file} 超过 ${limit} 行`);
}
const version = readFileSync(join(KIT_ROOT,"VERSION"),"utf8").trim();
const readme = readFileSync(join(KIT_ROOT,"README.md"),"utf8");
// 已发布条目使用日期 · v版本 · 标题；Unreleased 和“候选”标题不冒充已发布版本。
const release = readFileSync(join(KIT_ROOT,"CHANGELOG.md"),"utf8").match(/^## \d{4}-\d{2}-\d{2} · v(\d+\.\d+\.\d+) ·/m)?.[1];
if (!readme.includes(`**${version}**`) || release !== version) errors.push("发布版本与 README/CHANGELOG 漂移（Unreleased 不算发布）");

for (const error of errors) console.error(`[kit] ERROR ${error}`);
console.log(`[kit] ${errors.length} error`);
process.exit(errors.length ? 1 : 0);
