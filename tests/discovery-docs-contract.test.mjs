import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");
const between = (text, start, end) => {
  const from = text.indexOf(start);
  const to = end ? text.indexOf(end, from + start.length) : text.length;
  assert.notEqual(from, -1, `missing heading: ${start}`);
  return text.slice(from, to === -1 ? text.length : to);
};

test("CORE 7.2 makes version checks read-only and capability-scoped", () => {
  const section = between(read("CORE.md"), "### 7.2 ", "### 7.3 ");
  assert.match(section, /SessionStart.*只读|只读.*SessionStart/);
  assert.match(section, /不拉取/);
  assert.match(section, /不写入项目|不.*写入/);
  assert.match(section, /--capability discovery/);
  assert.match(section, /full.*暂不提供|暂不提供.*full/);
  assert.doesNotMatch(section, /git\s+pull/);
});

test("upgrade documentation defines the explicit discovery-only write contract", () => {
  const update = read("docs/playbook-update.md");
  const setup = read("setup.md");
  for (const command of [
    "node <mother>/scripts/upgrade.mjs --target . --capability discovery",
    "node <mother>/scripts/upgrade.mjs --target . --capability discovery --write",
  ]) assert.match(update, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(update, /默认不拉取、不写[\s\S]{0,30}不触发迁移/);
  assert.match(update, /status=file-install-only/);
  assert.match(update, /失败.*回滚|回滚.*失败/);
  assert.match(update, /`full` 能力目前[\s\S]{0,30}不提供/);
  assert.match(update, /接线/);
  assert.match(update, /真实 CLI|真实.*回执/);
  assert.match(update, /所有客户端/);
  assert.match(setup, /--capability discovery --write/);
  assert.match(setup, /未带 `--capability` 的旧式 `--write` 必须拒绝/);
  assert.doesNotMatch(setup, /scripts\/upgrade\.mjs --target \/path\/to\/project --write/);
});

test("discovery contract documents local facts, eight task domains, and bounded diagnostics", () => {
  const discovery = read("docs/project-discovery.md");
  const setup = read("setup.md");
  for (const domain of [
    "产品与业务", "架构与数据", "产品设计", "软件开发与范例",
    "Git与CI/CD", "环境与接入", "安全与凭据", "运行维护",
  ]) assert.match(discovery, new RegExp(domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const phrase of ["schemaVersion", "discoveryIds", "aliases", "tags", "credentialRefs", "未配置", "unknownUniverse"]) {
    assert.match(discovery, new RegExp(phrase));
  }
  assert.match(discovery, /60 行/);
  assert.match(discovery, /6144 bytes|6 KiB/);
  assert.match(discovery, /默认离线/);
  assert.match(discovery, /不跟随跳转、不重试/);
  assert.match(discovery, /项目.*本地|留在消费项目本地/);
  assert.match(setup, /assets` 可为空/);
  assert.match(setup, /不.*100%.*覆盖率/);
  assert.match(setup, /凭据仅引用[\s\S]{0,80}ID/);
});

test("template docs index uses reachable relative links for discovery navigation", () => {
  const templatePath = join(root, "templates/common/docs/index.md");
  const template = read("templates/common/docs/index.md");
  assert.match(template, /项目发现能力/);
  assert.match(template, /\]\(architecture\/repository-layout\.md\)/);
  const links = [...template.matchAll(/\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^]*?["'])?\s*\)/g)]
    .map((match) => match[1].replace(/^<|>$/g, ""))
    .filter((target) => target && !/^(?:[a-z][a-z\d+.-]*:|#|\{\{)/i.test(target));
  for (const target of links) {
    const localTarget = target.split("#")[0];
    if (!localTarget || localTarget.includes("{{")) continue;
    assert.ok(existsSync(resolve(dirname(templatePath), localTarget)), `unreachable template link: ${target}`);
  }
});

test("registry records discovery projection and explicit rollback without a new primitive", () => {
  const registry = read("governance/registry.md");
  assert.match(registry, /\| R16 \|/);
  assert.match(registry, /\| R17 \|/);
  assert.match(registry, /未配置/);
  assert.match(registry, /file-install-only/);
  assert.match(registry, /失败整批回滚/);
  assert.match(registry, /不改 base version|不改.*admission/);
});
