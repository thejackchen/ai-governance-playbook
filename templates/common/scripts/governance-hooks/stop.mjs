#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

let input = {};
try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch {}

function governanceVersion() {
  try {
    return JSON.parse(readFileSync(join(root, "governance.lock.json"), "utf8")).playbookVersion || "?";
  } catch {
    return "?";
  }
}

function getWorktreeHint() {
  const status = spawnSync("git", ["status", "--short"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (status.status !== 0) return "";
  const count = (status.stdout || "").split(/\r?\n/).filter(Boolean).length;
  return count > 0 ? `🧾 未收口: 工作树仍有 ${count} 条未提交改动。` : "";
}

// 认领门收口提示：只提示，不 block、不删认领。Lite 没有 claim.mjs 时静默跳过。
async function getClaimGateHint() {
  let claimModule;
  try {
    claimModule = await import("../claim.mjs");
  } catch (cause) {
    if (cause?.code === "ERR_MODULE_NOT_FOUND" && /claim\.mjs/i.test(String(cause.message || ""))) return "";
    return `[claim-gate] 收口提示读取失败(不阻断、不删除): ${cause instanceof Error ? cause.message : String(cause)}`;
  }
  try {
    const claims = claimModule.claimsForWorktree({ cwd: process.cwd() });
    if (!claims.length) return "";
    const ids = claims.map((claim) => claim.claimId || "?").join(", ");
    return `📋 认领收口:本 worktree 仍有 ${claims.length} 条活跃认领(${ids})。完成→ node scripts/claim.mjs close --id <id>;继续→加 --status continued;结果落回对应分支文件了吗?`;
  } catch (cause) {
    return `[claim-gate] 收口提示读取失败(不阻断、不删除): ${cause instanceof Error ? cause.message : String(cause)}`;
  }
}

function governanceBadge(lines = []) {
  return [
    `🏛 治理: 三句核心 v${governanceVersion()}`,
    ...lines,
  ].filter(Boolean).join("\n");
}

const result = spawnSync(process.execPath, [fileURLToPath(new URL("../governance-verify.mjs", import.meta.url))], {
  cwd: root,
  encoding: "utf8"
});
const claimGateHint = await getClaimGateHint();
const worktreeHint = getWorktreeHint();

if (result.status === 0) {
  const payload = {
    continue: true,
    systemMessage: governanceBadge([
      "✅ 治理验证: 通过",
      claimGateHint,
      worktreeHint,
    ]),
  };
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

const detail = `${result.stdout || ""}\n${result.stderr || ""}`.trim().slice(-4000);
if (input.stop_hook_active) {
  process.stdout.write(JSON.stringify({
    continue: true,
    systemMessage: governanceBadge([
      "❌ 治理验证: 仍未通过",
      `治理验证仍未通过，必须在最终报告中如实说明：\n${detail}`,
      claimGateHint,
      worktreeHint,
    ]),
  }));
} else {
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: governanceBadge([
      "❌ 治理验证: 失败",
      `治理验证失败，请修复后再结束：\n${detail}`,
      claimGateHint,
      worktreeHint,
    ]),
  }));
}
