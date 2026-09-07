import test from "node:test";
import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import {
  inspectSemanticUpdate,
  isStrictVersion,
  probeLatestVersion,
} from "../scripts/lib/governance-update.mjs";

const kit = new URL("..", import.meta.url).pathname.replace(/\/$/u, "");

function project(version) {
  const root = mkdtempSync(join(tmpdir(), "semantic-governance-update-"));
  mkdirSync(join(root, "governance"), { recursive: true });
  if (version !== undefined) {
    writeFileSync(join(root, "governance.lock.json"), `${JSON.stringify({ playbookVersion: version }, null, 2)}\n`);
  }
  return root;
}

function listFiles(root, current = root) {
  const files = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(root, path));
    else files.push(relative(root, path));
  }
  return files.sort();
}

function snapshot(root) {
  return Object.fromEntries(listFiles(root).map((path) => [path, readFileSync(join(root, path), "utf8")]));
}

test("strict versions accept only x.y.z", () => {
  for (const value of ["0.0.0", "4.2.0", "12.34.56"]) assert.equal(isStrictVersion(value), true, value);
  for (const value of ["4.2", "4.2.0-beta", "v4.2.0", "04.2.0", "4.2.0 extra", "latest", "9007199254740992.0.0"]) {
    assert.equal(isStrictVersion(value), false, value);
  }
});

test("published VERSION probe makes one bounded request with no redirect", async () => {
  let calls = 0;
  let request;
  const result = await probeLatestVersion("https://example.test/playbook", {
    fetchImpl: async (url, options) => {
      calls += 1;
      request = { url, options };
      return { ok: true, status: 200, text: async () => "4.3.0\n" };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.version, "4.3.0");
  assert.equal(calls, 1);
  assert.equal(request.url, "https://example.test/playbook/VERSION");
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.redirect, "error");
});

test("invalid VERSION and oversized body stay unknown", async () => {
  const invalid = await probeLatestVersion("https://example.test", {
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => "4.3.0-beta" }),
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, "unknown");

  const oversized = await probeLatestVersion("https://example.test", {
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => "x".repeat(129) }),
  });
  assert.equal(oversized.ok, false);
  assert.equal(oversized.error, "body-too-large");
});

test("HTTP errors are bounded before body reads and source failures do not echo secrets", async () => {
  let bodyRead = false;
  const http = await probeLatestVersion("https://example.test", {
    fetchImpl: async () => ({ ok: false, status: 503, text: async () => { bodyRead = true; return "4.3.0"; } }),
  });
  assert.equal(http.status, "unknown");
  assert.equal(bodyRead, false);
  assert.match(http.error, /^HTTP 503$/);

  let calls = 0;
  const source = await probeLatestVersion("https://user:secret@example.test/path?token=secret#fragment", {
    fetchImpl: async () => { calls += 1; return { ok: true, status: 200, text: async () => "4.3.0" }; },
  });
  assert.equal(calls, 0);
  assert.equal(source.officialSource, "unknown");
  assert.doesNotMatch(JSON.stringify(source), /secret/);
});

test("offline mode never calls fetch", async () => {
  let calls = 0;
  const result = await probeLatestVersion("https://example.test", {
    offline: true,
    fetchImpl: async () => { calls += 1; throw new Error("network must not run"); },
  });
  assert.equal(calls, 0);
  assert.equal(result.status, "unknown");
  assert.equal(result.checked, "offline");
  assert.equal(result.error, "offline");
});

test("timeout covers a hanging fetch and aborts it", async () => {
  let signal;
  const started = Date.now();
  const result = await probeLatestVersion("https://example.test", {
    timeoutMs: 30,
    fetchImpl: async (_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    },
  });
  assert.equal(result.status, "unknown");
  assert.equal(result.error, "timeout");
  assert.equal(signal.aborted, true);
  assert.ok(Date.now() - started < 1000, "bounded probe should return promptly");
});

test("timeout covers a hanging response reader as well as fetch", async () => {
  let signal;
  let cancelled = false;
  const result = await probeLatestVersion("https://example.test", {
    timeoutMs: 30,
    fetchImpl: async (_url, options) => {
      signal = options.signal;
      return {
        ok: true,
        status: 200,
        body: {
          getReader() {
            return {
              read: () => new Promise(() => {}),
              cancel: async () => { cancelled = true; },
              releaseLock() {},
            };
          },
        },
      };
    },
  });
  assert.equal(result.status, "unknown");
  assert.equal(result.error, "timeout");
  assert.equal(signal.aborted, true);
  // The request is hard-bounded even when a non-cooperative reader ignores cancel.
  assert.equal(cancelled, false);
});

test("redirect responses are rejected even when a test double reports success", async () => {
  const result = await probeLatestVersion("https://example.test", {
    fetchImpl: async () => ({ ok: true, status: 200, redirected: true, text: async () => "4.3.0" }),
  });
  assert.equal(result.status, "unknown");
  assert.match(result.error, /redirect/);
});

test("new version yields an actionable semantic task without writing", async (t) => {
  const root = project("4.1.0");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "governance/policy.json"), JSON.stringify({
    playbookUpdate: { channel: "https://example.test/playbook", check: "session-start", apply: "semantic" },
  }) + "\n");
  writeFileSync(join(root, "AGENTS.md"), "# project facts\n");
  const before = snapshot(root);
  const result = await inspectSemanticUpdate(root, {
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => "4.2.0" }),
    motherRoot: kit,
  });
  assert.equal(result.status, "update-available");
  assert.equal(result.localVersion, "4.1.0");
  assert.equal(result.onlineVersion, "4.2.0");
  assert.equal(result.wrote, false);
  assert.match(result.task, /本地版=4\.1\.0/);
  assert.match(result.task, /线上版=4\.2\.0/);
  assert.match(result.task, /配置来源=https:\/\/example\.test\/playbook\/VERSION/);
  assert.match(result.task, /固定.*SHA/);
  assert.match(result.task, /CORE\.md/);
  assert.match(result.task, /升级合同/);
  assert.match(result.task, /采用.*等价实现.*不适用/);
  assert.match(result.task, /事实.*WIP.*认领/);
  assert.match(result.task, /governance-verify\.mjs --fast/);
  assert.match(result.task, /独立.*语义复核/);
  assert.deepEqual(snapshot(root), before);
});

test("policy and fetch failures never leak a configured secret", async (t) => {
  const root = project("4.1.0");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "governance/policy.json"), JSON.stringify({
    playbookUpdate: { channel: "https://user:secret@example.test/path?token=secret" },
  }) + "\n");
  let calls = 0;
  const result = await inspectSemanticUpdate(root, {
    fetchImpl: async () => { calls += 1; throw new Error("secret should never be called"); },
  });
  assert.equal(result.status, "unknown");
  assert.equal(calls, 0);
  assert.doesNotMatch(JSON.stringify(result), /secret/);
});

test("same, local-ahead, missing lock, and failed probes preserve local facts", async (t) => {
  const current = project("4.2.0");
  const ahead = project("4.3.0");
  const missing = project();
  const failing = project("4.2.0");
  t.after(() => {
    for (const root of [current, ahead, missing, failing]) rmSync(root, { recursive: true, force: true });
  });
  const fetchVersion = (version) => async () => ({ ok: true, status: 200, text: async () => version });
  assert.equal((await inspectSemanticUpdate(current, { fetchImpl: fetchVersion("4.2.0"), motherRoot: kit })).status, "current");
  assert.equal((await inspectSemanticUpdate(ahead, { fetchImpl: fetchVersion("4.2.0"), motherRoot: kit })).status, "local-ahead");
  assert.equal((await inspectSemanticUpdate(missing, { fetchImpl: fetchVersion("4.2.0"), motherRoot: kit })).status, "local-missing");
  const unknown = await inspectSemanticUpdate(failing, { offline: true, fetchImpl: async () => { throw new Error("must not call"); }, motherRoot: kit });
  assert.equal(unknown.status, "unknown");
  assert.match(unknown.task, /unknown/);
  assert.match(unknown.task, /保留本地已记录版本 4\.2\.0/);
});

test("CLI is read-only, supports --offline, and root/template wrappers remain byte-identical", (t) => {
  const root = project("4.2.0");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const before = snapshot(root);
  const cli = spawnSync(process.execPath, [join(kit, "scripts/governance-update.mjs"), "--target", root, "--offline"], {
    cwd: kit,
    encoding: "utf8",
  });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /本地版=4\.2\.0/);
  assert.match(cli.stdout, /线上版=unknown/);
  assert.match(cli.stdout, /官方来源=/);
  assert.match(cli.stdout, /仅状态提示，未完成适配/);
  assert.deepEqual(snapshot(root), before);
  assert.equal(
    readFileSync(join(kit, "scripts/governance-update.mjs"), "utf8"),
    readFileSync(join(kit, "templates/common/scripts/governance-update.mjs"), "utf8"),
  );
  assert.equal(
    readFileSync(join(kit, "scripts/lib/governance-update.mjs"), "utf8"),
    readFileSync(join(kit, "templates/common/scripts/lib/governance-update.mjs"), "utf8"),
  );
  assert.equal(existsSync(join(kit, "scripts/governance-update.mjs")), true);
  assert.equal(statSync(join(kit, "scripts/governance-update.mjs")).isFile(), true);
});

test("CLI rejects unknown arguments without echoing their value", () => {
  const result = spawnSync(process.execPath, [join(kit, "scripts/governance-update.mjs"), "--token=secret"], {
    cwd: kit,
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /未知参数/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /secret/);
});

function hookFixture() {
  const root = mkdtempSync(join(tmpdir(), "semantic-governance-hook-"));
  cpSync(join(kit, "templates/common/scripts"), join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "governance"), { recursive: true });
  writeFileSync(join(root, "governance/policy.json"), JSON.stringify({
    playbookUpdate: { channel: "https://raw.githubusercontent.com/thejackchen/ai-governance-playbook/main", check: "session-start", apply: "semantic" },
  }) + "\n");
  writeFileSync(join(root, "governance.lock.json"), JSON.stringify({ playbookVersion: "4.2.0" }) + "\n");
  return root;
}

test("real SessionStart hard-kills a hanging governance-update child and continues", (t) => {
  const root = hookFixture();
  const marker = join(root, "governance-update.pid");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "scripts/governance-update.mjs"), `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(process.env.SEMANTIC_HANG_MARKER, String(process.pid));
process.on("SIGTERM", () => {});
setInterval(() => {}, 1000);
`);
  const started = Date.now();
  const result = spawnSync(process.execPath, [join(root, "scripts/governance-hooks/session-start.mjs")], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SEMANTIC_HANG_MARKER: marker },
    timeout: 8000,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.ok(Date.now() - started < 8000, "SessionStart should keep its child timeout bounded");
  assert.match(result.stdout, /unknown|未完成适配/);
  assert.match(result.stdout, /治理状态|项目发现地图/);
  assert.equal(existsSync(marker), true);
  const pid = Number(readFileSync(marker, "utf8"));
  assert.ok(Number.isInteger(pid) && pid > 0);
  assert.throws(() => process.kill(pid, 0), /ESRCH/);
});

test("malformed policy skips semantic probing instead of silently enabling network", (t) => {
  const root = hookFixture();
  const marker = join(root, "governance-update.called");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "governance/policy.json"), "{ malformed\n");
  writeFileSync(join(root, "scripts/governance-update.mjs"), `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(process.env.SEMANTIC_PROBE_MARKER, "called");
`);
  const result = spawnSync(process.execPath, [join(root, "scripts/governance-hooks/session-start.mjs")], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SEMANTIC_PROBE_MARKER: marker },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(existsSync(marker), false);
  assert.match(result.stdout, /配置 unknown/);
  assert.doesNotMatch(result.stdout, /SEMANTIC_PROBE_MARKER|governance-update\.mjs.*执行/);
});

test("unknown check mode is explicit and does not trigger a probe", (t) => {
  const root = hookFixture();
  const marker = join(root, "governance-update.called");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "governance/policy.json"), JSON.stringify({
    playbookUpdate: { channel: "https://raw.githubusercontent.com/thejackchen/ai-governance-playbook/main", check: "future-mode" },
  }) + "\n");
  writeFileSync(join(root, "scripts/governance-update.mjs"), `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(process.env.SEMANTIC_PROBE_MARKER, "called");
`);
  const result = spawnSync(process.execPath, [join(root, "scripts/governance-hooks/session-start.mjs")], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SEMANTIC_PROBE_MARKER: marker },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(existsSync(marker), false);
  assert.match(result.stdout, /配置 unknown/);
  assert.match(result.stdout, /跳过联网检查/);
});

test("missing, empty, and non-string check configuration never probes", (t) => {
  const cases = [
    { name: "missing playbookUpdate", policy: {} },
    { name: "missing check", policy: { playbookUpdate: {} } },
    { name: "empty check", policy: { playbookUpdate: { check: "" } } },
    { name: "null check", policy: { playbookUpdate: { check: null } } },
    { name: "numeric check", policy: { playbookUpdate: { check: 1 } } },
    { name: "array check", policy: { playbookUpdate: { check: [] } } },
  ];
  for (const item of cases) {
    const root = hookFixture();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const marker = join(root, "governance-update.called");
    writeFileSync(join(root, "governance/policy.json"), JSON.stringify(item.policy) + "\n");
    writeFileSync(join(root, "scripts/governance-update.mjs"), `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(process.env.SEMANTIC_PROBE_MARKER, "called");
`);
    const result = spawnSync(process.execPath, [join(root, "scripts/governance-hooks/session-start.mjs")], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, SEMANTIC_PROBE_MARKER: marker },
    });
    assert.equal(result.status, 0, `${item.name}: ${result.stdout}\n${result.stderr}`);
    assert.equal(existsSync(marker), false, item.name);
    assert.match(result.stdout, /配置 unknown/);
    assert.match(result.stdout, /跳过联网检查/);
  }
});
