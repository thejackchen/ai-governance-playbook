import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  expandFactPath,
  formatExtraRepoFactsReport,
  inspectExtraRepoFacts,
  lintExtraRepoFacts,
  loadExtraRepoFacts,
  scanPointerSecrets,
} from "../scripts/lib/extra-repo-facts.mjs";

function fixture(body) {
  const root = mkdtempSync(join(tmpdir(), "extra-repo-facts-"));
  mkdirSync(join(root, "docs", "ops"), { recursive: true });
  writeFileSync(join(root, "docs", "ops", "extra-repo-facts.json"), `${JSON.stringify(body, null, 2)}\n`);
  return root;
}

const validFact = {
  id: "demo-identity",
  class: "Demo 人名",
  presence: "local-required",
  paths: ["~/.config/example/demo.md"],
  covers: "人名与编号",
  doesNotCover: "容器 onboard",
  missing: "正本未装载。禁止用 tenants.json 代替人名。",
  decoys: [{ path: "scripts/tenants.json", doesNotCover: "人名", mustContain: "不是人名对照表" }],
};

test("missing index is a structural error, not a home-file error", () => {
  const root = mkdtempSync(join(tmpdir(), "extra-repo-missing-"));
  const loaded = loadExtraRepoFacts(root);
  assert.equal(loaded.ok, false);
  assert.equal(loaded.missing, true);
  assert.match(loaded.errors[0], /extra-repo-facts\.json/);
});

test("empty facts list is valid", () => {
  const root = fixture({ schemaVersion: 1, facts: [] });
  const loaded = loadExtraRepoFacts(root);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.facts.length, 0);
  assert.match(formatExtraRepoFactsReport(inspectExtraRepoFacts(root)), /0 条登记/);
});

test("unloaded local-required fact reports 正本未装载 and does not read secret files", () => {
  const root = fixture({ schemaVersion: 1, facts: [validFact] });
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(join(root, "scripts", "tenants.json"), '{"_doc":"不是人名对照表"}\n');
  const report = formatExtraRepoFactsReport(inspectExtraRepoFacts(root, { home: join(root, "no-home") }));
  assert.match(report, /正本未装载/);
  assert.match(report, /易混替身: scripts\/tenants\.json（不管 人名）/);
  assert.doesNotMatch(report, /password|g2a_|secret-value/i);
});

test("loaded path is reported without file contents", () => {
  const home = mkdtempSync(join(tmpdir(), "extra-repo-home-"));
  mkdirSync(join(home, ".config", "example"), { recursive: true });
  writeFileSync(join(home, ".config", "example", "demo.md"), "password=super-secret\nCANARY_PERSON=demo2\n");
  const root = fixture({ schemaVersion: 1, facts: [{ ...validFact, decoys: [] }] });
  const report = formatExtraRepoFactsReport(inspectExtraRepoFacts(root, { home }));
  assert.match(report, /已装载 ~\/\.config\/example\/demo\.md/);
  assert.doesNotMatch(report, /super-secret/);
  assert.doesNotMatch(report, /CANARY_PERSON/);
});

test("pointer secrets are blocked", () => {
  const hits = scanPointerSecrets('{"key":"g2a_liveexample"}');
  assert.ok(hits.some((item) => item.includes("g2a key")));
});

test("missing home files are warnings, never lint errors", () => {
  const root = fixture({ schemaVersion: 1, facts: [{ ...validFact, decoys: [] }] });
  const lint = lintExtraRepoFacts(root, { home: join(root, "no-home"), ci: true });
  assert.equal(lint.errors.length, 0);
  assert.ok(lint.warnings.some((item) => item.includes("未在本机装载")));
});

test("decoy mustContain is enforced for in-repo stand-ins", () => {
  const root = fixture({ schemaVersion: 1, facts: [validFact] });
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(join(root, "scripts", "tenants.json"), '{"_doc":"租户台账"}\n');
  const lint = lintExtraRepoFacts(root);
  assert.ok(lint.errors.some((item) => item.includes("不是人名对照表")));
});

test("tilde paths expand against the given home", () => {
  assert.equal(expandFactPath("~/a.md", { root: "/repo", home: "/Users/demo" }), "/Users/demo/a.md");
  assert.equal(expandFactPath("apps/web/.env.local", { root: "/repo", home: "/Users/demo" }), "/repo/apps/web/.env.local");
});
