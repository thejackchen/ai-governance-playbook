#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const allowed = new Set(["--ci", "--fast"]);
for (const a of argv) if (!allowed.has(a)) usage(a);

const mode = argv.includes("--ci") ? "ciChecks" : "fastChecks";
const root = process.cwd();

// fileURLToPath 而非 .pathname：非 ASCII 仓库路径下 .pathname 返回 percent-encoded 串 → MODULE_NOT_FOUND。
run(process.execPath, [fileURLToPath(new URL("./governance-lint.mjs", import.meta.url)), "--root", root], "治理lint");
const policy = JSON.parse(readFileSync(`${root}/governance/policy.json`, "utf8"));
for (const command of policy[mode] || []) run(command, [], command, true);
console.log(`[governance] verify ${mode} 通过`);

function run(command, args, label, shell = false) {
  const result = spawnSync(command, args, { cwd: root, shell, stdio: "inherit", encoding: "utf8" });
  if (result.status !== 0) {
    console.error(`[governance] ${label} 失败`);
    process.exit(result.status || 1);
  }
}

function usage(bad) {
  console.error(`[governance] 未知参数: ${bad}`);
  console.error("用法: node scripts/governance-verify.mjs [--ci|--fast]");
  process.exit(2);
}
