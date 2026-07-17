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
  for (const path of [
    `${root}/templates/standard/.github/workflows/governance.yml`,
    `${root}/templates/standard-codex/.github/workflows/governance.yml`
  ]) {
    const workflow = readFileSync(path, "utf8");
    assert.match(workflow, /schedule:/, path);
    assert.match(workflow, /heartbeat:/, path);
    assert.match(workflow, /weekly-governance-review\.mjs/, path);
    assert.ok(!/uses:\s+[^\s]+@v\d+/m.test(workflow), path);
  }
});

test("AI review is explicitly advisory", () => {
  const core = readFileSync(`${root}/CORE.md`, "utf8");
  const workflow = readFileSync(`${root}/templates/standard-codex/.github/workflows/governance.yml`, "utf8");
  assert.match(core, /不把 LLM 单次结论作为唯一合并阻断条件/);
  assert.match(workflow, /不是唯一硬门禁|不应配置为唯一required check/);
});

test("Codex-only CI stowaway lives outside the shared Standard template", () => {
  assert.ok(!existsSync(`${root}/templates/standard/.github/codex`), "templates/standard 不应再含 .github/codex");
  const baseWorkflow = readFileSync(`${root}/templates/standard/.github/workflows/governance.yml`, "utf8");
  assert.ok(!/codex|openai/i.test(baseWorkflow), "base Standard workflow 不应引用 codex/openai");
  assert.ok(existsSync(`${root}/templates/standard-codex/.github/codex/prompts/governance-review.md`));
  const codexWorkflow = readFileSync(`${root}/templates/standard-codex/.github/workflows/governance.yml`, "utf8");
  assert.match(codexWorkflow, /ai-review:/);
  assert.match(codexWorkflow, /openai\/codex-action/);
});
