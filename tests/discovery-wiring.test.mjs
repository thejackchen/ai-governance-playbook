import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const kit = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

function run(command, args, cwd, env = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function project() {
  const root = mkdtempSync(join(tmpdir(), "discovery-wiring-"));
  assert.equal(run("git", ["init", "-q"], root).status, 0);
  return root;
}

function install(root) {
  const result = run(process.execPath, [
    "scripts/init.mjs", "--target", root, "--runtime", "generic", "--profile", "lite", "--write",
  ], kit);
  assert.equal(result.status, 0, result.stderr);
}

test("new init installs discovery CLIs and portable libraries without inventing a catalog", (t) => {
  const root = project();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  install(root);
  for (const file of [
    "scripts/project-catalog.mjs",
    "scripts/discovery-map.mjs",
    "scripts/environment-check.mjs",
    "scripts/lib/docs-index.mjs",
    "scripts/lib/project-catalog.mjs",
    "scripts/lib/catalog-search.mjs",
    "scripts/lib/discovery-map.mjs",
    "scripts/lib/environment-check.mjs",
  ]) assert.ok(existsSync(join(root, file)), `missing ${file}`);
  assert.equal(existsSync(join(root, "docs/architecture/project-catalog.json")), false);
  const check = run(process.execPath, [join(root, "scripts/project-catalog.mjs")], root);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /未配置/);
});

test("SessionStart and discovery-map CLI render the same configured map", (t) => {
  const root = project();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  install(root);
  mkdirSync(join(root, "docs", "architecture"), { recursive: true });
  mkdirSync(join(root, "docs", "ops"), { recursive: true });
  writeFileSync(join(root, "docs", "entry.md"), "# Fixture entry\n");
  writeFileSync(join(root, "docs", "ops", "extra-repo-facts.json"), JSON.stringify({ schemaVersion: 1, facts: [] }) + "\n");
  writeFileSync(join(root, "docs", "architecture", "project-catalog.json"), JSON.stringify({
    schemaVersion: 1,
    discoveryIds: ["fixture-entry"],
    assets: [{
      id: "fixture-entry",
      kind: "guide",
      category: "软件开发与范例",
      aliases: ["fixture"],
      tags: ["test"],
      purpose: "Fixture discovery entry",
      entry: "docs/entry.md",
      owner: "test",
      boundaries: "Read-only fixture",
    }],
  }, null, 2) + "\n");
  assert.equal(run("git", ["add", "docs/entry.md", "docs/architecture/project-catalog.json", "docs/ops/extra-repo-facts.json"], root).status, 0);

  const cli = run(process.execPath, [join(root, "scripts/discovery-map.mjs")], root);
  assert.equal(cli.status, 0, cli.stderr);
  const session = run(process.execPath, [join(root, "scripts/governance-hooks/session-start.mjs")], root);
  assert.equal(session.status, 0, session.stderr);
  assert.ok(session.stdout.includes(cli.stdout.trim()), "SessionStart map must use the same renderer as the CLI");
  assert.match(cli.stdout, /fixture-entry/);
  assert.doesNotMatch(cli.stdout, /Read-only fixture[\s\S]*TODO/);
});

test("missing catalog is explicit and does not claim discovery coverage", (t) => {
  const root = project();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  install(root);
  for (const args of [
    [join(root, "scripts/discovery-map.mjs")],
    [join(root, "scripts/project-catalog.mjs")],
  ]) {
    const result = run(process.execPath, args, root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /未配置/);
    assert.doesNotMatch(result.stdout, /全仓覆盖|已覆盖全仓/);
  }
  const session = run(process.execPath, [join(root, "scripts/governance-hooks/session-start.mjs")], root);
  assert.equal(session.status, 0, session.stderr);
  assert.match(session.stdout, /项目发现地图：未配置/);
});

test("SessionStart never invokes the legacy automatic pull or upgrade write", (t) => {
  const root = project();
  const fakePlaybook = mkdtempSync(join(tmpdir(), "discovery-fake-playbook-"));
  const sentinel = join(fakePlaybook, "called");
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(fakePlaybook, { recursive: true, force: true });
  });
  install(root);
  mkdirSync(join(fakePlaybook, "scripts"), { recursive: true });
  writeFileSync(join(fakePlaybook, "scripts", "upgrade.mjs"), "require('node:fs').writeFileSync(process.env.DISCOVERY_SENTINEL, 'called');\n");
  const session = run(process.execPath, [join(root, "scripts/governance-hooks/session-start.mjs")], root, {
    GOVERNANCE_PLAYBOOK_DIR: fakePlaybook,
    DISCOVERY_SENTINEL: sentinel,
  });
  assert.equal(session.status, 0, session.stderr);
  assert.equal(existsSync(sentinel), false, "legacy upgrade script must not be called by SessionStart");
  assert.doesNotMatch(session.stdout + session.stderr, /治理升级器执行失败|upgrade\.mjs.*--write/);
});
