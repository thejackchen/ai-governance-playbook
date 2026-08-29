#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { formatExtraRepoFactsReport, inspectExtraRepoFacts } from "../lib/extra-repo-facts.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const verbose = process.argv.includes("--verbose");

// 判例库保鲜:开工时静默拉一次 playbook 最新(多项目并发时,别处今天的判例本会话即可读到)。
// 路径:环境变量优先,否则默认克隆位置;不存在或离线则静默跳过,绝不阻塞开工。
{
  const os = await import("node:os");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const pb = process.env.GOVERNANCE_PLAYBOOK_DIR || `${os.homedir()}/working/ai-governance-playbook`;
  if (fs.existsSync(`${pb}/.git`)) {
    spawnSync("git", ["-C", pb, "pull", "--ff-only", "-q"], { timeout: 8000, stdio: "ignore" });
  }
  const upgrade = path.join(pb, "scripts/upgrade.mjs");
  if (fs.existsSync(upgrade)) {
    const out = spawnSync(process.execPath, [upgrade, "--target", root, "--write"], {
      timeout: 20_000,
      encoding: "utf8",
      env: { ...process.env, GOVERNANCE_PLAYBOOK_DIR: pb },
    });
    const output = `${out.stdout || ""}${out.stderr || ""}`.trim();
    if (output) console.log(output);
    if (out.status !== 0) console.log(`📦 治理升级器执行失败(exit=${out.status ?? "unknown"})；本会话不得施工`);
  }
}

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

try {
  const { formatIntegrationLineReport, inspectIntegrationLine } = await import("../lib/integration-line.mjs");
  console.log(formatIntegrationLineReport(inspectIntegrationLine(root, { fetch: true })));
} catch {
  console.log("🛤 公共主干: 检查失败（不阻断开工）");
}

// 认领门：铭牌和跨 worktree 活跃认领公告板。Lite 没有 claim.mjs 时只跳过公告板，
// 不影响已有的状态播报和危险命令保护。
let claimModule = null;
try {
  claimModule = await import("../claim.mjs");
} catch (cause) {
  if (!(cause?.code === "ERR_MODULE_NOT_FOUND" && /claim\.mjs/i.test(String(cause.message || "")))) {
    console.log(`[claim-gate] 认领账本模块读取失败(不阻断开工): ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

try {
  let version = "?";
  try { version = JSON.parse(readFileSync(join(root, "governance.lock.json"), "utf8")).playbookVersion || "?"; } catch {}
  console.log(`🏛 治理: 三句核心 v${version}`);
  if (claimModule) {
    const records = claimModule.loadClaims({ cwd: process.cwd(), strict: false }).records
      .filter((claim) => claim.status === "active" || claim.status === "continued");
    if (records.length === 0) {
      console.log("📋 认领: 无活跃认领(动行为代码前先 node scripts/claim.mjs open --line <线> ...)");
    } else {
      const now = Date.now();
      const byLine = new Map();
      for (const claim of records) {
        if (claim.line) byLine.set(claim.line, (byLine.get(claim.line) || 0) + 1);
      }
      if (!verbose) {
        const crowded = [...byLine.entries()]
          .filter(([, count]) => count >= 2)
          .sort((left, right) => right[1] - left[1])
          .map(([line, count]) => `${line}=${count}`);
        console.log(`📋 认领: ${records.length} 条活跃${crowded.length ? ` · 同线并发 ${crowded.join(" · ")}` : ""} · 用 --verbose 看明细`);
      } else {
        console.log(`📋 认领公告板(${records.length} 条活跃):`);
        for (const claim of records) {
          const ageHours = Math.max(0, Math.round((now - Date.parse(claim.updatedAt || claim.createdAt || 0)) / 3_600_000));
          const marks = [];
          if (claim.worktree && !existsSync(claim.worktree)) marks.push("orphan:worktree已消失");
          else if (ageHours > 24) marks.push(`stale:${ageHours}h无更新`);
          const task = (claim.task || claim.incidentRef || "").slice(0, 30);
          const worktreeTail = (claim.worktree || "").split("/").pop() || "?";
          console.log(`- ${claim.claimId} · ${claim.line || "emergency"} · ${task} · ${ageHours}h前 · ${worktreeTail}${marks.length ? ` [${marks.join(",")}]` : ""}`);
        }
        for (const [line, count] of byLine) {
          if (count >= 2) console.log(`⚠ 同线并发: ${line} 上有 ${count} 条活跃认领——开工前先看对方在做什么`);
        }
      }
    }
  }
} catch (cause) {
  console.log(`[claim-gate] 认领账本读取失败(不阻断开工): ${cause instanceof Error ? cause.message : String(cause)}`);
}
