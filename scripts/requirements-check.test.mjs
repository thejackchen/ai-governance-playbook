import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { checkRequirements } from "./requirements-check.mjs";

function makeRepo(backlog) {
  const root = mkdtempSync(join(tmpdir(), "governance-req-"));
  mkdirSync(join(root, "docs/requirements"), { recursive: true });
  writeFileSync(join(root, "docs/requirements/backlog.md"), backlog);
  return root;
}

function writeSpec(root, name = "REQ-2026-001-demo.md", body = "# 已确认规格\n\n- acceptance: 可验证\n") {
  mkdirSync(join(root, "docs/requirements/specs"), { recursive: true });
  writeFileSync(join(root, "docs/requirements/specs", name), body);
}

function entry({ id = "REQ-2026-001", done = false, evidence = "pending", fields = true } = {}) {
  const required = fields
    ? "  - source_refs: issue-1\n  - spec_refs: specs/REQ-2026-001-demo.md\n  - acceptance: 验收成功\n  - evidence: " + evidence + "\n"
    : "  - acceptance: 验收成功\n  - evidence: " + evidence + "\n";
  return `- [${done ? "x" : " "}] ${id} | owner: team | priority: P1 | title: 示例\n${required}`;
}

test("passes an explicit empty state", () => {
  const root = makeRepo("# 需求 Backlog\n\n## 进行中需求\n\n> 当前无已受理需求。\n");
  try {
    assert.deepEqual(checkRequirements(root).errors, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("supports REQ-GOV identifiers and resolves spec_refs from the backlog directory", () => {
  const root = makeRepo(`# 需求 Backlog\n\n## 进行中需求\n\n${entry({ id: "REQ-GOV-001" })}`);
  try {
    writeSpec(root);
    assert.deepEqual(checkRequirements(root).errors, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("requires all fields for delivered requirements", () => {
  const root = makeRepo(`# 需求 Backlog\n\n## 进行中需求\n\n${entry({ done: true, fields: false, evidence: "command: npm test" })}`);
  try {
    const { errors } = checkRequirements(root);
    assert(errors.some((line) => line.includes("已交付项必须补齐字段: source_refs, spec_refs")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects pending evidence for a delivered requirement", () => {
  const root = makeRepo(`# 需求 Backlog\n\n## 进行中需求\n\n${entry({ done: true })}`);
  try {
    writeSpec(root);
    assert(checkRequirements(root).errors.some((line) => line.includes("不允许 evidence 为 pending")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("does not let pending evidence skip missing or placeholder specs", () => {
  const root = makeRepo(`# 需求 Backlog\n\n## 进行中需求\n\n${entry()}`);
  try {
    let errors = checkRequirements(root).errors;
    assert(errors.some((line) => line.includes("spec 文件不存在")));
    writeSpec(root, "REQ-2026-001-demo.md", "TODO(owner): complete the spec\n");
    errors = checkRequirements(root).errors;
    assert(errors.some((line) => line.includes("spec 文件为空或仍含占位内容")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("validates archived completed requirements instead of treating them as unchecked history", () => {
  const root = makeRepo(`# 需求 Backlog\n\n## 进行中需求\n\n${entry()}\n## 已完成需求\n\n${entry({ done: true, fields: false })}`);
  try {
    writeSpec(root);
    const { errors } = checkRequirements(root);
    assert(errors.some((line) => line.includes("已交付项必须补齐字段: source_refs, spec_refs")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects pending evidence in an archived completed requirement", () => {
  const root = makeRepo(`# 需求 Backlog\n\n## 进行中需求\n\n> 当前无已受理需求。\n\n## 已完成需求\n\n${entry({ done: true })}`);
  try {
    writeSpec(root);
    assert(checkRequirements(root).errors.some((line) => line.includes("不允许 evidence 为 pending")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
