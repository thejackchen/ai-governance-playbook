import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

test("current doctrine records every legacy concept disposition", () => {
  const audit = readFileSync(`${root}/docs/audits/v3-content-audit.md`, "utf8");
  for (const concept of [
    "治理是成本", "为消费者而生", "腐烂是默认", "单一真相", "五块地基",
    "L0-L3", "二犯", "第二次使用", "单一心跳", "能力清单", "每个session必须commit"
  ]) assert.ok(audit.includes(concept), `audit missing ${concept}`);
});

test("runtime adapters do not duplicate the common instruction template", () => {
  assert.ok(existsSync(`${root}/templates/common/INSTRUCTIONS.md`));
  for (const runtime of ["codex", "claude-code", "generic"]) {
    const adapter = JSON.parse(readFileSync(`${root}/adapters/${runtime}/adapter.json`, "utf8"));
    if (adapter.filesRoot) {
      assert.ok(!existsSync(`${root}/${adapter.filesRoot}/AGENTS.md`));
      assert.ok(!existsSync(`${root}/${adapter.filesRoot}/CLAUDE.md`));
    }
  }
});

test("Standard workflow pins third-party actions and has a real scheduled heartbeat", () => {
  const workflow = readFileSync(`${root}/templates/standard/.github/workflows/governance.yml`, "utf8");
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /heartbeat:/);
  assert.match(workflow, /weekly-governance-review\.mjs/);
  assert.ok(!/uses:\s+[^\s]+@v\d+/m.test(workflow));
});

test("AI review is explicitly advisory", () => {
  const core = readFileSync(`${root}/CORE.md`, "utf8");
  const workflow = readFileSync(`${root}/templates/standard/.github/workflows/governance.yml`, "utf8");
  assert.match(core, /不把 LLM 单次结论作为唯一合并阻断条件/);
  assert.match(workflow, /不是唯一硬门禁|不应配置为唯一required check/);
});
