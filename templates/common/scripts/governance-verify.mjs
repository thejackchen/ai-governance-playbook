#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const mode = process.argv.includes("--ci") ? "ciChecks" : "fastChecks";
const rootArg = process.argv.indexOf("--root");
const root = rootArg >= 0 ? process.argv[rootArg + 1] : process.cwd();

run(process.execPath, [new URL("./governance-lint.mjs", import.meta.url).pathname, "--root", root], "治理lint");
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
