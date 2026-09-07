#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { formatExtraRepoFactsReport, inspectExtraRepoFacts } from "../lib/extra-repo-facts.mjs";
import { loadDiscoveryMap } from "../lib/discovery-map.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const verbose = process.argv.includes("--verbose");

// 开工阶段只注入一次有界语义升级发现任务；脚本不拉取、不改文件、不把提示当作已适配。
// 旧 check=off/manual 明确映射为手动 CLI，避免历史项目被悄悄联网。
const semanticUpdatePath = join(root, "scripts/governance-update.mjs");
let semanticUpdatePolicy = null;
let semanticPolicyReadable = existsSync(join(root, "governance/policy.json"));
try {
  semanticUpdatePolicy = JSON.parse(readFileSync(join(root, "governance/policy.json"), "utf8"))?.playbookUpdate;
} catch { semanticPolicyReadable = false; }
if (!semanticPolicyReadable) {
  console.log("🔎 语义升级发现：配置 unknown（governance/policy.json 缺失或无法解析）；跳过联网检查，保留本地状态；仅任务提示，未完成适配。");
} else if (!semanticUpdatePolicy || typeof semanticUpdatePolicy !== "object" || Array.isArray(semanticUpdatePolicy)
  || typeof semanticUpdatePolicy.check !== "string" || !semanticUpdatePolicy.check.trim()) {
  console.log("🔎 语义升级发现：配置 unknown（playbookUpdate.check 未明确为字符串）；跳过联网检查；仅任务提示，未完成适配。");
} else if (["off", "manual"].includes(semanticUpdatePolicy.check.trim().toLowerCase())) {
  const semanticCheck = semanticUpdatePolicy.check.trim().toLowerCase();
  console.log(`🔎 语义升级发现：${semanticCheck === "off" ? "未自动检查" : "手动模式"}（playbookUpdate.check=${semanticCheck}）；需要时运行 node scripts/governance-update.mjs --target .；仅任务提示，未完成适配。`);
} else if (semanticUpdatePolicy.check.trim().toLowerCase() !== "session-start") {
  console.log("🔎 语义升级发现：配置 unknown（不支持的 playbookUpdate.check）；跳过联网检查；仅任务提示，未完成适配。");
} else if (!existsSync(semanticUpdatePath)) {
  console.log("🔎 语义升级发现：载体缺失（bootstrap gap）；请从母版接入 scripts/governance-update.mjs 后再做手动发现；仅任务提示，未完成适配。");
} else {
  const update = spawnSync(process.execPath, [semanticUpdatePath, "--target", root], {
    cwd: root,
    encoding: "utf8",
    timeout: 3500,
    killSignal: "SIGKILL",
    maxBuffer: 32 * 1024,
  });
  const updateOutput = `${update.stdout || ""}${update.stderr || ""}`.trim();
  if (updateOutput) console.log(updateOutput);
  else console.log("🔎 语义升级发现：unknown（发现任务未返回）；保留本地已记录版本，按本地验证状态继续；仅任务提示，未完成适配。");
}

// v4.0.0 起开工不再 pull playbook 或写入升级；发现能力文件仍由项目 AI 按现有权限选择接入。
// 发现地图只读取项目自己的显式元数据，缺失时明确报未配置，不推测覆盖范围。
const discoveryCatalogPath = join(root, "docs/architecture/project-catalog.json");
if (existsSync(discoveryCatalogPath)) {
  console.log(loadDiscoveryMap(root));
} else {
  console.log("🗺 项目发现地图：未配置（docs/architecture/project-catalog.json 不存在）。不推测目录、索引或环境覆盖。");
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
