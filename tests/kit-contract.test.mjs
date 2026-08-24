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

test("extra-repo fact index is part of the kit", () => {
  const core = readFileSync(`${root}/CORE.md`, "utf8");
  const instructions = readFileSync(`${root}/templates/common/INSTRUCTIONS.md`, "utf8");
  const registry = readFileSync(`${root}/governance/registry.md`, "utf8");
  assert.ok(existsSync(`${root}/templates/common/docs/ops/extra-repo-facts.json`));
  assert.ok(existsSync(`${root}/templates/common/scripts/lib/extra-repo-facts.mjs`));
  assert.ok(existsSync(`${root}/templates/common/scripts/lib/integration-line.mjs`));
  assert.match(core, /仓外正本必须有仓内指针/);
  assert.match(core, /正本未装载/);
  assert.match(core, /~\/\.config\//);
  assert.match(core, /## Grok/);
  assert.match(core, /治理版本以 GitHub 为正本/);
  assert.ok(existsSync(`${root}/scripts/upgrade.mjs`));
  assert.match(instructions, /extra-repo-facts\.md/);
  assert.match(registry, /R11/);
  assert.ok(existsSync(`${root}/templates/common/.grok/hooks/governance.json`));
});

test("PreCompact inspect-and-inject is part of the kit", () => {
  const core = readFileSync(`${root}/CORE.md`, "utf8");
  const registry = readFileSync(`${root}/governance/registry.md`, "utf8");
  const claude = readFileSync(`${root}/adapters/claude-code/files/.claude/settings.json`, "utf8");
  const codex = readFileSync(`${root}/adapters/codex/files/.codex/hooks.json`, "utf8");
  const grok = readFileSync(`${root}/templates/common/.grok/hooks/governance.json`, "utf8");
  assert.ok(existsSync(`${root}/scripts/governance-hooks/pre-compact.mjs`));
  assert.ok(existsSync(`${root}/scripts/governance-hooks/pre-compact-codex.mjs`));
  assert.ok(existsSync(`${root}/governance/cases/2026-08-23-压缩后会把临时目录和聊天记忆当成正本.md`));
  assert.ok(existsSync(`${root}/skill/shoukou/SKILL.md`));
  assert.match(core, /压缩前必须留下可恢复坐标/);
  assert.match(registry, /R13/);
  assert.match(claude, /pre-compact\.mjs/);
  assert.match(codex, /pre-compact-codex\.mjs/);
  assert.match(grok, /pre-compact\.mjs/);
  assert.doesNotMatch(grok, /\becho\b/);
});

test("integration line gate is part of the kit", () => {
  const core = readFileSync(`${root}/CORE.md`, "utf8");
  const registry = readFileSync(`${root}/governance/registry.md`, "utf8");
  const instructions = readFileSync(`${root}/templates/common/INSTRUCTIONS.md`, "utf8");
  assert.ok(existsSync(`${root}/scripts/lib/integration-line.mjs`));
  assert.ok(existsSync(`${root}/governance/cases/2026-08-24-日常目录离开公共主干就会双线分叉.md`));
  assert.match(core, /眼前这份代码必须含有公共线/);
  assert.match(registry, /R14/);
  assert.match(instructions, /integrationLine/);
});

test("Release governance is discoverable and covers the minimal contract", () => {
  const index = readFileSync(`${root}/docs/index.md`, "utf8");
  const release = readFileSync(`${root}/docs/release-governance.md`, "utf8");
  const template = readFileSync(`${root}/templates/common/docs/index.md`, "utf8");

  assert.match(index, /docs\/release-governance\.md/);
  for (const field of ["target", "artifact", "entrypoint", "stage", "evidence", "rollback", "receipt"]) {
    assert.match(release, new RegExp(`\\b${field}\\b`, "i"), `release contract missing ${field}`);
  }
  assert.match(release, /runtime\s+readback/i, "release contract missing runtime readback");
  assert.match(template, /本地\s+release runbook/i);
  assert.match(template, /发布面[\s\S]{0,40}建立|建立[\s\S]{0,40}发布面/);
});
