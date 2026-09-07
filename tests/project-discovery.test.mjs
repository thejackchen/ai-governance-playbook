import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { navigationTargets, inspectDocsIndex } from "../templates/common/scripts/lib/docs-index.mjs";
import { CATEGORIES, inspectProjectCatalog } from "../templates/common/scripts/lib/project-catalog.mjs";
import { parseArguments, searchCatalog, main as searchMain } from "../templates/common/scripts/lib/catalog-search.mjs";
import { loadDiscoveryMap, renderDiscoveryMap } from "../templates/common/scripts/lib/discovery-map.mjs";
import { checkEnvironment, runCurl } from "../templates/common/scripts/lib/environment-check.mjs";

function fixture(t, files = {}) {
  const root = mkdtempSync(join(tmpdir(), "project-discovery-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, value = "fixture\n") => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), value);
  };
  for (const [path, value] of Object.entries(files)) write(path, value);
  execFileSync("git", ["init", "-q"], { cwd: root });
  const track = () => execFileSync("git", ["add", "."], { cwd: root });
  track();
  return { root, write, track };
}

const asset = (id, entry = "docs/entry.md", extra = {}) => ({
  id,
  kind: "component",
  purpose: `Fixture ${id}`,
  entry,
  owner: "fixture-owner",
  boundaries: "read only; no deployment",
  ...extra,
});

function writeCatalog(fixtureResult, catalog) {
  fixtureResult.write("docs/architecture/project-catalog.json", `${JSON.stringify(catalog, null, 2)}\n`);
  fixtureResult.track();
}

test("docs index follows recursive indexes, ignores code examples, and reports missing roots", (t) => {
  const f = fixture(t, {
    "docs/index.md": "[ops](ops/INDEX.md) [escape](../../outside.md)\n```md\n[hidden](hidden.md)\n```",
    "docs/ops/INDEX.md": "[guide](guide.md)",
    "docs/ops/guide.md": "# Guide",
    "docs/hidden.md": "# Hidden",
  });
  assert.match(inspectDocsIndex(f.root).errors.join("\n"), /导航越出仓库/);
  assert.match(inspectDocsIndex(f.root).errors.join("\n"), /hidden\.md 未登记/);
  assert.deepEqual(navigationTargets("- item\n    [continuation](a.md)\n\n    [code](b.md)\n\n~~~md\n[x](c.md)\n~~~\n[d](d.md)"), ["a.md", "b.md", "d.md"]);

  const empty = fixture(t);
  const result = inspectDocsIndex(empty.root);
  assert.match(result.errors[0], /docs\/index\.md/);
  assert.equal(result.coverage.indexes, 0);
});

test("docs index symlink loops terminate and external targets are rejected", (t) => {
  const outside = fixture(t, { "INDEX.md": "[secret](secret.md)", "secret.md": "secret" });
  const f = fixture(t, {
    "docs/index.md": "[loop](ops/INDEX.md)",
    "docs/ops/INDEX.md": "[again](again/INDEX.md) [guide](guide.md)",
    "docs/ops/guide.md": "# Guide",
  });
  symlinkSync(".", join(f.root, "docs/ops/again"));
  assert.deepEqual(inspectDocsIndex(f.root).errors, []);

  const escaped = fixture(t, { "docs/index.md": "[outside](ops/INDEX.md)" });
  symlinkSync(join(outside.root), join(escaped.root, "docs/ops"));
  const result = inspectDocsIndex(escaped.root);
  assert.match(result.errors.join("\n"), /真实路径越出仓库/);
});

test("single source project uses explicit roots and a non-default workstream directory", (t) => {
  const f = fixture(t, {
    "src/app.js": "export {};\n",
    "docs/entry.md": "# Entry",
    "docs/lines/alpha.md": "# Alpha",
  });
  const catalog = {
    schemaVersion: 1,
    sourceRoots: ["src"],
    sourceCollections: [],
    workstreamDirectory: "docs/lines",
    discoveryIds: ["app"],
    assets: [asset("app", "docs/entry.md", {
      category: "Git与CI/CD",
      aliases: ["application"],
      tags: ["source"],
      sourcePaths: ["src/"],
      workstreams: ["alpha"],
    })],
  };
  writeCatalog(f, catalog);
  const result = inspectProjectCatalog(f.root);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.coverage.source, { total: 1, covered: 1, uncovered: [], overlapping: [], unknownUniverse: false });
  assert.deepEqual(result.coverage.workstreams, { total: 1, covered: 1, uncovered: [], unknownUniverse: false });
  assert.deepEqual(new Set([...CATEGORIES]), new Set(["产品与业务", "架构与数据", "产品设计", "软件开发与范例", "Git与CI/CD", "环境与接入", "安全与凭据", "运行维护"]));
});

test("omitted source and workstream metadata is explicitly unknown, not whole-repository coverage", (t) => {
  const f = fixture(t, {
    "src/app.js": "export {};\n",
    "docs/entry.md": "# Entry",
    "docs/lines/alpha.md": "# Alpha",
  });
  writeCatalog(f, { schemaVersion: 1, assets: [asset("app", "docs/entry.md", { sourcePaths: ["src/"] })] });
  const result = inspectProjectCatalog(f.root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.coverage.source.unknownUniverse, true);
  assert.equal(result.coverage.source.total, 0);
  assert.equal(result.coverage.workstreams.unknownUniverse, true);
  assert.equal(result.coverage.workstreams.total, 0);
  assert.equal(result.coverage.source.uncovered.length, 0);
});

test("explicit source root typos, escapes, broad collections, and symlink entries fail closed", (t) => {
  const f = fixture(t, {
    "src/app.js": "export {};\n",
    "packages/unit/index.js": "export {};\n",
    "docs/entry.md": "# Entry",
  });
  const base = asset("app", "docs/entry.md", { sourcePaths: ["src/"] });
  writeCatalog(f, { schemaVersion: 1, sourceRoots: ["src/missing"], assets: [base] });
  let result = inspectProjectCatalog(f.root);
  assert.match(result.errors.join("\n"), /sourceRoots path unavailable/);

  writeCatalog(f, { schemaVersion: 1, sourceRoots: ["../outside"], assets: [base] });
  result = inspectProjectCatalog(f.root);
  assert.match(result.errors.join("\n"), /sourceRoots/);

  writeCatalog(f, { schemaVersion: 1, sourceRoots: ["packages"], sourceCollections: ["packages"], assets: [asset("app", "docs/entry.md", { sourcePaths: ["packages/"] })] });
  result = inspectProjectCatalog(f.root);
  assert.match(result.errors.join("\n"), /invalid or broad sourcePath/);

  symlinkSync(tmpdir(), join(f.root, "outside-entry"));
  f.track();
  writeCatalog(f, { schemaVersion: 1, sourceRoots: [], assets: [asset("app", "outside-entry")] });
  result = inspectProjectCatalog(f.root);
  assert.match(result.errors.join("\n"), /invalid or missing repository entry/);
});

test("monorepo ownership detects duplicate owners while preserving explicit scope", (t) => {
  const f = fixture(t, {
    "apps/one/index.js": "one\n",
    "packages/two/index.js": "two\n",
    "docs/one.md": "one\n",
    "docs/two.md": "two\n",
  });
  const first = asset("one", "docs/one.md", { sourcePaths: ["apps/"] });
  const second = asset("two", "docs/two.md", { sourcePaths: ["packages/"] });
  writeCatalog(f, { schemaVersion: 1, sourceRoots: ["apps", "packages"], assets: [first, second] });
  assert.deepEqual(inspectProjectCatalog(f.root).errors, []);

  writeCatalog(f, { schemaVersion: 1, sourceRoots: ["apps", "packages"], assets: [first, { ...second, sourcePaths: ["apps/"] }] });
  const result = inspectProjectCatalog(f.root);
  assert.match(result.errors.join("\n"), /overlapping source ownership/);
  assert.ok(result.coverage.source.overlapping.includes("apps/one/index.js"));
});

test("credential references use only repository fact IDs and do not read secret paths", (t) => {
  const f = fixture(t, { "src/app.js": "app\n", "docs/entry.md": "entry\n" });
  const entry = asset("app", "docs/entry.md", { sourcePaths: ["src/"], credentialRefs: ["channel"] });
  writeCatalog(f, { schemaVersion: 1, sourceRoots: ["src"], assets: [entry] });
  let result = inspectProjectCatalog(f.root);
  assert.match(result.errors.join("\n"), /credentialRefs registry/);
  f.write("docs/ops/extra-repo-facts.json", JSON.stringify({ schemaVersion: 1, facts: [{ id: "channel", paths: ["/private/SECRET"] }] }));
  f.track();
  result = inspectProjectCatalog(f.root);
  assert.deepEqual(result.errors, []);
  assert.doesNotMatch(JSON.stringify(result), /SECRET/);
  writeCatalog(f, { schemaVersion: 1, sourceRoots: ["src"], assets: [{ ...entry, credentialRefs: ["missing"] }] });
  assert.match(inspectProjectCatalog(f.root).errors.join("\n"), /unknown credentialRefs ID/);
});

test("catalog search is deterministic metadata-only and keeps Git与CI/CD atomic", () => {
  const assets = [
    asset("one", "docs/one.md", { aliases: ["First"], tags: ["ci"], category: "Git与CI/CD/同步" }),
    asset("two", "docs/two.md", { aliases: ["First"], category: "环境与接入/网络" }),
    asset("three", "docs/three.md", { links: ["one"] }),
  ];
  assert.deepEqual(searchCatalog(assets, { query: "first" }).map((item) => item.id), ["one", "two"]);
  assert.deepEqual(searchCatalog(assets, { category: "Git与CI/CD" }).map((item) => item.id), ["one"]);
  assert.deepEqual(searchCatalog(assets, { category: "同步" }).map((item) => item.id), ["one"]);
  assert.deepEqual(searchCatalog(assets, { related: "one" }).map((item) => item.id), ["three"]);
  assert.throws(() => searchCatalog(assets, { related: "missing" }), /Unknown related asset ID/);
  assert.throws(() => parseArguments(["--query", "x", "--query", "y"]));
  const output = [];
  assert.equal(searchMain(["--query", "first", "--json"], { log: (line) => output.push(line), error: (line) => output.push(line) }, { catalogPath: "/definitely/missing/catalog.json" }), 1);
  assert.doesNotMatch(output.join("\n"), /SECRET/);
});

test("discovery map uses declared IDs only, validates local entries, and never projects secrets", (t) => {
  const f = fixture(t, { "src/app.js": "app\n", "docs/entry.md": "entry\n" });
  const catalog = {
    schemaVersion: 1,
    sourceRoots: ["src"],
    discoveryIds: ["app"],
    assets: [asset("app", "docs/entry.md", {
      aliases: ["Public name"],
      purpose: "Public purpose",
      category: "Git与CI/CD",
      sourcePaths: ["src/"],
      credentialRefs: ["channel"],
      externalPath: "/private/SECRET",
      owner: "PRIVATE_OWNER",
    })],
  };
  writeCatalog(f, catalog);
  f.write("docs/ops/extra-repo-facts.json", JSON.stringify({ schemaVersion: 1, facts: [{ id: "channel", paths: ["/private/SECRET"] }] }));
  f.track();
  const map = loadDiscoveryMap(f.root);
  assert.match(map, /app｜别名：Public name/);
  assert.match(map, /Git与CI\/CD/);
  assert.doesNotMatch(map, /SECRET|PRIVATE_OWNER/);
  assert.ok(map.split("\n").length <= 60);
  assert.ok(Buffer.byteLength(map, "utf8") <= 6144);

  const noIds = { ...catalog };
  delete noIds.discoveryIds;
  f.write("docs/architecture/project-catalog.json", JSON.stringify(noIds));
  f.track();
  assert.match(loadDiscoveryMap(f.root), /discoveryIds未配置/);
  assert.throws(() => renderDiscoveryMap(noIds), /discovery IDs missing/);
});

test("discovery map rejects missing entries, unknown IDs, and budget overflow without truncation", (t) => {
  const f = fixture(t, { "docs/entry.md": "entry\n" });
  const catalog = { schemaVersion: 1, discoveryIds: ["missing"], assets: [asset("present", "docs/entry.md")] };
  writeCatalog(f, catalog);
  assert.match(loadDiscoveryMap(f.root), /discoveryIds未配置或无效/);
  assert.throws(() => renderDiscoveryMap({ ...catalog, discoveryIds: ["present"] }, { maxLines: 1 }), /budget/);

  writeCatalog(f, { schemaVersion: 1, discoveryIds: ["present"], assets: [asset("present", "docs/no-entry.md")] });
  assert.match(loadDiscoveryMap(f.root), /重点对象入口缺失/);

  writeCatalog(f, { schemaVersion: 1, discoveryIds: ["present"], assets: [asset("present", "docs/entry.md", { credentialRefs: [] })] });
  assert.match(loadDiscoveryMap(f.root), /discoveryIds未配置或无效/);
  assert.throws(() => renderDiscoveryMap({ schemaVersion: 1, discoveryIds: ["present"], assets: [asset("present", "docs/entry.md", { credentialRefs: [] })] }), /discovery IDs missing/);
});

test("environment check performs one bounded read-only probe and handles timeout", async (t) => {
  let calls = 0;
  const result = await checkEnvironment("https://example.test/path", {
    runner: async (args) => {
      calls++;
      assert.ok(args.includes("--head"));
      assert.ok(args.includes("--retry") && args[args.indexOf("--retry") + 1] === "0");
      for (const flag of ["--location", "--insecure", "--netrc", "--user", "--cookie", "--request", "--data"]) assert.ok(!args.includes(flag));
      return { code: 0, stdout: "200 0.1 0.2", stderr: "SECRET" };
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.stage, "http");
  assert.equal(result.status, 200);
  assert.doesNotMatch(JSON.stringify(result), /SECRET|path/);

  const killed = await checkEnvironment("https://example.test", { runner: async () => ({ killed: true, stdout: "SECRET" }) });
  assert.equal(killed.stage, "deadline");
  await assert.rejects(checkEnvironment("https://user:SECRET@example.test", { runner: () => { throw new Error("must not run"); } }), (error) => !error.message.includes("SECRET"));

  const dir = mkdtempSync(join(tmpdir(), "project-discovery-timeout-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const stub = join(dir, "stub.cjs");
  writeFileSync(stub, "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);\n");
  const bounded = await runCurl([stub], { executable: process.execPath, timeout: 100 });
  assert.equal(bounded.killed, true);
});

test("environment failure matrix stays actionable without asserting proxy state or retrying", async () => {
  const cases = [
    [5, "000 0 0", "dns", /尚未确认/],
    [6, "000 0 0", "dns", /VPN/],
    [7, "000 0 0", "tcp", /Tailscale 不等于/],
    [28, "000 0 0", "connect", /代理/],
    [28, "000 0.1 0", "tls-or-proxy", /代理/],
    [28, "000 0.1 0.2", "http", /超时/],
    [35, "000 0 0", "tls", /系统时间/],
    [60, "000 0 0", "tls", /不要关闭 TLS/],
    [0, "401 0.1 0.2", "http", /身份、授权/],
    [0, "403 0.1 0.2", "http", /出口策略/],
    [0, "429 0.1 0.2", "http", /限流/],
    [0, "503 0.1 0.2", "http", /上游故障/],
    [0, "302 0.1 0.2", "http", /未跟随/],
    [0, "405 0.1 0.2", "http", /HEAD 支持/],
    ["ENOENT", "SECRET", "probe", /curl/],
    [0, "000 0 0", "probe", /没有有效 HTTP/],
  ];
  for (const [code, stdout, stage, advice] of cases) {
    const result = await checkEnvironment("https://example.test", { runner: async () => ({ code, stdout, stderr: "SECRET" }) });
    assert.equal(result.stage, stage);
    assert.match(result.advice, advice);
    assert.doesNotMatch(JSON.stringify(result), /SECRET/);
  }
});

test("environment CLI help and invalid target do not invoke a probe or echo input", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "project-discovery-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const modulePath = new URL("../templates/common/scripts/lib/environment-check.mjs", import.meta.url).pathname;
  const options = { encoding: "utf8", env: { ...process.env, PATH: dir } };
  const help = execFileSync(process.execPath, [modulePath], options);
  assert.match(help, /用法/);
  assert.match(help, /node scripts\/environment-check\.mjs --url/);
  assert.match(help, /docs\/index\.md/);
  assert.doesNotMatch(help, /scripts\/lib\/environment-check|environment-access|AIOS/);
  const explicitHelp = execFileSync(process.execPath, [modulePath, "--help"], options);
  assert.match(explicitHelp, /node scripts\/environment-check\.mjs --url/);
  assert.doesNotMatch(explicitHelp, /scripts\/lib\/environment-check|environment-access|AIOS/);
  try {
    execFileSync(process.execPath, [modulePath, "--url", "https://user:SECRET@example.test"], { ...options, stdio: "pipe" });
    assert.fail("invalid target must fail");
  } catch (error) {
    assert.equal(error.status, 2);
    assert.doesNotMatch(error.stderr, /SECRET/);
  }
});
