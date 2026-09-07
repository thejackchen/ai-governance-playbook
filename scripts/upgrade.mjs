#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs } from "./lib.mjs";
import {
  applyDiscoveryUpgrade,
  formatDiscoveryUpgradeReport,
  planDiscoveryUpgrade,
} from "./lib/discovery-upgrade.mjs";

const args = parseArgs(process.argv.slice(2));
const unknownArgs = [
  ...(args._ || []).map((value) => String(value)),
  ...Object.keys(args).filter((key) => key !== "_" && !["target", "capability", "write"].includes(key)),
];
if (unknownArgs.length) {
  console.error(`不支持参数：${unknownArgs.join(", ")}；本次未写入任何文件`);
  process.exitCode = 2;
  process.exit();
}
const target = resolve(String(args.target || process.cwd()));
const capability = String(args.capability || "").trim();
const writeRequested = Boolean(args.write);

// 升级器默认只是盘点。尤其不能让旧的 `--write` 调用在没有能力选择时
// 静默恢复整套母版迁移；能力升级必须由负责人明确点名。
if (!capability) {
  const plan = planDiscoveryUpgrade(target);
  const result = {
    ...plan,
    status: writeRequested ? "capability-required" : "plan",
    error: writeRequested
      ? "需要显式选择能力：--capability discovery --write；本次未写入任何文件"
      : undefined,
  };
  console.log(formatDiscoveryUpgradeReport(result));
  process.exitCode = writeRequested ? 2 : 0;
} else if (capability !== "discovery") {
  console.error(`不支持 capability=${capability}；当前只允许 discovery`);
  process.exitCode = 2;
} else {
  const result = writeRequested
    ? await applyDiscoveryUpgrade(target)
    : planDiscoveryUpgrade(target);
  console.log(formatDiscoveryUpgradeReport(result));
  if (result.conflicts?.length) console.log(`needs human: ${result.conflicts.join("\nneeds human: ")}`);
  if (result.files?.length) {
    for (const file of result.files) {
      console.log(`${file.action || "inspect"}: ${file.relativePath}`);
    }
  }
  if (result.status === "conflict" || result.status === "failed" || result.status === "needs-adaptation") {
    process.exitCode = 1;
  }
}
