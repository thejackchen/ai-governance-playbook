#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { inspectProjectCatalog } from "./lib/project-catalog.mjs";
import { main as searchCatalog } from "./lib/catalog-search.mjs";

const USAGE = "用法:\n  node scripts/project-catalog.mjs [--root <项目目录>] [--check] [--json]\n  node scripts/project-catalog.mjs [--root <项目目录>] --query <文本> [--category <分类>] [--related <资产ID>] [--json]\n默认执行目录验证；搜索与 --check 不能混用。未配置 catalog 时不推测全仓覆盖。";

function parseArgs(argv) {
  let root = process.cwd();
  let json = false;
  let check = false;
  const search = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--json") {
      if (json) throw new Error("重复参数: --json");
      json = true;
      continue;
    }
    if (arg === "--check") {
      if (check) throw new Error("重复参数: --check");
      check = true;
      continue;
    }
    if (arg === "--root" || arg === "--target") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} 缺少目录`);
      root = resolve(value);
      continue;
    }
    if (["--query", "--category", "--related"].includes(arg)) {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} 缺少值`);
      search.push(arg, value);
      continue;
    }
    throw new Error(`未知参数: ${arg}`);
  }
  if (check && search.length) throw new Error("--check 不能与搜索参数混用");
  if (json && !search.length) return { root, json, check };
  return { root, json, check, search };
}

function run(argv, output = console) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    output.error(`${error.message}\n${USAGE}`);
    return 2;
  }
  if (args.help) {
    output.log(USAGE);
    return 0;
  }
  const catalogPath = join(args.root, "docs/architecture/project-catalog.json");
  if (!existsSync(catalogPath)) {
    const result = { configured: false, errors: [], coverage: null };
    if (args.json) output.log(JSON.stringify(result, null, 2));
    else output.log("[project-catalog] 未配置（docs/architecture/project-catalog.json 不存在）；跳过目录覆盖验证。");
    return 0;
  }
  if (args.search?.length) {
    if (args.json) args.search.push("--json");
    return searchCatalog(args.search, output, { root: args.root });
  }
  const result = inspectProjectCatalog(args.root);
  const payload = { configured: true, ...result };
  if (args.json) output.log(JSON.stringify(payload, null, 2));
  else {
    for (const error of result.errors) output.error(`[project-catalog] ERROR ${error}`);
    const source = result.coverage?.source || {};
    const workstreams = result.coverage?.workstreams || {};
    const sourceCoverage = source.unknownUniverse ? "unknown" : `${source.covered ?? 0}/${source.total ?? 0}`;
    const workstreamCoverage = workstreams.unknownUniverse ? "unknown" : `${workstreams.covered ?? 0}/${workstreams.total ?? 0}`;
    output.log(`[project-catalog] 已配置；源码覆盖=${sourceCoverage}，工作流覆盖=${workstreamCoverage}，${result.errors.length} error`);
  }
  return result.errors.length ? 1 : 0;
}

process.exitCode = run(process.argv.slice(2));
