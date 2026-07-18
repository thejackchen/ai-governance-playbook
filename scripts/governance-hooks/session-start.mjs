#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

// 判例库保鲜:开工时静默拉一次 playbook 最新(多项目并发时,别处今天的判例本会话即可读到)。
// 路径:环境变量优先,否则默认克隆位置;不存在或离线则静默跳过,绝不阻塞开工。
{
  const os = await import("node:os");
  const fs = await import("node:fs");
  const pb = process.env.GOVERNANCE_PLAYBOOK_DIR || `${os.homedir()}/working/ai-governance-playbook`;
  if (fs.existsSync(`${pb}/.git`)) {
    spawnSync("git", ["-C", pb, "pull", "--ff-only", "-q"], { timeout: 8000, stdio: "ignore" });
  }
}

const result = spawnSync(process.execPath, [new URL("../governance-status.mjs", import.meta.url).pathname], {
  cwd: root,
  encoding: "utf8"
});
if (result.status === 0) process.stdout.write(result.stdout);
else process.stdout.write("治理状态读取失败；开始工作前检查ROADMAP.md和governance.lock.json。\n");
