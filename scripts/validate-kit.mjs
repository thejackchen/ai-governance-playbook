#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { KIT_ROOT, walkFiles } from "./lib.mjs";

const errors = [];
for (const p of [
  "CORE.md", "ADAPTERS.md", "setup.md", "MIGRATION.md", "SELF-CHECK.md", "VERSION",
  "profiles/lite.json", "profiles/standard.json", "profiles/high-assurance.json",
  "adapters/codex/adapter.json", "adapters/claude-code/adapter.json", "adapters/generic/adapter.json"
]) if (!existsSync(join(KIT_ROOT, p))) errors.push(`缺少kit文件: ${p}`);

// VERSION是治理基版锚点（下游lock登记与上游比对用）；package.json是其副本，漂移即错
if (existsSync(join(KIT_ROOT, "VERSION"))) {
  const anchor = readFileSync(join(KIT_ROOT, "VERSION"), "utf8").trim();
  const pkg = JSON.parse(readFileSync(join(KIT_ROOT, "package.json"), "utf8"));
  if (pkg.version !== anchor) errors.push(`版本漂移: VERSION锚点=${anchor}，package.json version=${pkg.version}`);

  // 本仓库自托管v3安装产物，governance.lock.json.playbookVersion同样必须追平VERSION锚点，
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

// root 自托管 hook 与 templates/common 副本必须字节一致(自托管不变式;root 副本保护本仓库自身,漂移即失守)
for (const hook of ["session-start.mjs", "pre-tool-use.mjs", "stop.mjs"]) {
  const a = join(KIT_ROOT, "scripts/governance-hooks", hook);
  const b = join(KIT_ROOT, "templates/common/scripts/governance-hooks", hook);
  if (existsSync(a) && existsSync(b) && readFileSync(a, "utf8") !== readFileSync(b, "utf8")) {
    errors.push(`root 与 templates/common 的 governance-hooks/${hook} 已漂移(必须字节一致)`);
  }
}

for (const error of errors) console.error(`[kit] ERROR ${error}`);
console.log(`[kit] ${errors.length} error`);
process.exit(errors.length ? 1 : 0);
