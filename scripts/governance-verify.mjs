#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { inspectDocsIndex } from "./lib/docs-index.mjs";
import { inspectProjectCatalog } from "./lib/project-catalog.mjs";

const argv = process.argv.slice(2);
const allowed = new Set(["--ci", "--fast"]);
for (const a of argv) if (!allowed.has(a)) usage(a);

const mode = argv.includes("--ci") ? "ciChecks" : "fastChecks";
const root = process.cwd();

// fileURLToPath 而非 .pathname：非 ASCII 仓库路径下 .pathname 返回 percent-encoded 串 → MODULE_NOT_FOUND。
run(process.execPath, [fileURLToPath(new URL("./governance-lint.mjs", import.meta.url)), "--root", root], "治理lint");
const policy = JSON.parse(readFileSync(`${root}/governance/policy.json`, "utf8"));
verifyDiscovery(root);
const frontendVerifier = join(root, "scripts/frontend-governance-verify.mjs");
if (existsSync(frontendVerifier)) {
  run(process.execPath, [frontendVerifier, mode === "ciChecks" ? "--ci" : "--fast"], "前端设计系统治理");
}
for (const command of policy[mode] || []) run(command, [], command, true);
console.log(`[governance] verify ${mode} 通过`);

function verifyDiscovery(projectRoot) {
  const catalogPath = join(projectRoot, "docs/architecture/project-catalog.json");
  if (!existsSync(catalogPath)) {
    console.log("[discovery] project catalog 未配置；跳过目录/索引覆盖验证");
    return;
  }

  const catalog = inspectProjectCatalog(projectRoot);
  const docs = inspectDocsIndex(projectRoot);
  const errors = [...catalog.errors, ...docs.errors];
  const source = catalog.coverage?.source || {};
  const workstreams = catalog.coverage?.workstreams || {};
  const sourceCoverage = source.unknownUniverse
    ? "unknown"
    : `${source.covered ?? 0}/${source.total ?? 0}`;
  const workstreamCoverage = workstreams.unknownUniverse
    ? "unknown"
    : `${workstreams.covered ?? 0}/${workstreams.total ?? 0}`;
  console.log(`[discovery] catalog 已配置；源码覆盖=${sourceCoverage}，工作流覆盖=${workstreamCoverage}，文档索引=${docs.coverage?.covered ?? 0}/${docs.coverage?.total ?? 0}`);
  for (const error of errors) console.error(`[discovery] ERROR ${error}`);
  if (errors.length) {
    console.error("[discovery] 目录/索引验证失败");
    process.exit(1);
  }
}

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
