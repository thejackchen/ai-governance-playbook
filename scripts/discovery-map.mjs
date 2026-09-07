#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { loadDiscoveryMap } from "./lib/discovery-map.mjs";

const USAGE = "用法: node scripts/discovery-map.mjs [--root <项目目录>] [--discovery-id <资产ID> ...]\n默认只读取项目显式 catalog/discoveryIds，不连接机器。";

function parseArgs(argv) {
  let root = process.cwd();
  const discoveryIds = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--root" || arg === "--target") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} 缺少目录`);
      root = resolve(value);
      continue;
    }
    if (arg === "--discovery-id") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error("--discovery-id 缺少资产ID");
      discoveryIds.push(value);
      continue;
    }
    throw new Error(`未知参数: ${arg}`);
  }
  return { root, discoveryIds };
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
    output.log("🗺 项目发现地图：未配置（docs/architecture/project-catalog.json 不存在）。不推测目录、索引或环境覆盖。");
    return 0;
  }
  const options = args.discoveryIds.length ? { discoveryIds: args.discoveryIds } : {};
  output.log(loadDiscoveryMap(args.root, options));
  return 0;
}

process.exitCode = run(process.argv.slice(2));
