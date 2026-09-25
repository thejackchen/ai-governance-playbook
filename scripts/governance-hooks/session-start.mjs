#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { formatExtraRepoFactsReport, inspectExtraRepoFacts } from "../lib/extra-repo-facts.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const verbose = process.argv.includes("--verbose");

const result = spawnSync(process.execPath, [fileURLToPath(new URL("../governance-status.mjs", import.meta.url))], {
  cwd: root,
  encoding: "utf8"
});
if (result.status === 0) process.stdout.write(result.stdout);
else process.stdout.write("治理状态读取失败；开始工作前检查ROADMAP.md和governance.lock.json。\n");

const frontendPolicyPath = join(root, "governance/frontend-policy.json");
if (existsSync(frontendPolicyPath)) {
  try {
    const frontendPolicy = JSON.parse(readFileSync(frontendPolicyPath, "utf8"));
    const authority = frontendPolicy.authority || {};
    const journeys = Array.isArray(frontendPolicy.representativeJourneys) ? frontendPolicy.representativeJourneys : [];
    const journeyIds = journeys.map((journey) => journey?.id).filter((id) => typeof id === "string" && id.trim());
    console.log(`🎨 视觉治理: lifecycle=${frontendPolicy.lifecycle || "unknown"}; authority=designSystem:${authority.designSystem || "?"}, tokens:${authority.tokens || "?"}, referencePack:${authority.referencePack || "?"}, surfaces:${authority.surfaces || "?"}; journeys=${journeys.length}${journeyIds.length ? `; ids=${journeyIds.join(",")}` : ""}`);
  } catch (cause) {
    console.log(`🎨 视觉治理: policy读取失败（${cause instanceof Error ? cause.message : String(cause)}）`);
  }
}

try {
  console.log(formatExtraRepoFactsReport(inspectExtraRepoFacts(root), { compact: !verbose }));
} catch {
  console.log("📂 仓外正本: 读取失败（不阻断开工）");
}

