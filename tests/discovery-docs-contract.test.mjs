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

test("CORE 7.2 separates bounded discovery from autonomous semantic adaptation", () => {
  const section = between(read("CORE.md"), "### 7.2 ", "### 7.3 ");
  assert.match(section, /SessionStart.*只读|只读.*SessionStart/);
  assert.match(section, /不拉取/);
  assert.match(section, /不写入项目|不.*写入/);
  assert.match(section, /不.*自动迁移/);
  assert.match(section, /governance-update\.mjs/);
  assert.match(section, /有界.*VERSION|VERSION.*有界/);
  assert.match(section, /不要求负责人逐仓|不要求.*逐能力/);
  assert.match(section, /采用.*等价实现|等价实现.*不适用/);
  assert.match(section, /本次版本新增\/变更且与项目相关的建议/);
  assert.match(section, /可按主题分组/);
  assert.match(section, /已有且仍有效的\s*语义无需反复复制\s*记账/);
  assert.match(section, /首次对齐缺少基线\s*时再做全量梳理/);
  assert.match(section, /真实语义冲突/);
  assert.match(section, /独立无上下文/);
  assert.match(section, /只改版本号/);
  assert.match(section, /存量项目已有足够的真实业务意图与适配授权/);
  assert.match(section, /候选未发布或独立验收待完成只是证据门/);
  assert.match(section, /不冻结与升级无关的已授权工作/);
  assert.match(section, /首次 `init` 的 `TODO\(owner\)` 仅[\s\S]{0,50}新装项目[\s\S]{0,30}不套用于存量适配/);
  assert.match(section, /--capability discovery/);
  assert.match(section, /full.*暂不提供|暂不提供.*full/);
  assert.doesNotMatch(section, /git\s+pull/);
  assert.doesNotMatch(section, /施工前必须由负责人显式选择升级能力/);
  assert.doesNotMatch(section, /存量项目[^。\n]*必须[^。\n]*(?:确认|审批)[^。\n]*治理升级/);
});

test("upgrade documentation separates autonomous semantic adaptation from optional discovery install", () => {
  const update = read("docs/playbook-update.md");
  const setup = read("setup.md");
  for (const command of [
    "node <mother>/scripts/governance-update.mjs --target .",
    "node <mother>/scripts/governance-update.mjs --target . --offline",
    "node <mother>/scripts/upgrade.mjs --target . --capability discovery",
    "node <mother>/scripts/upgrade.mjs --target . --capability discovery --write",
  ]) assert.match(update, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(update, /有界.*VERSION|VERSION.*有界/);
  assert.match(update, /不做 git pull\/fetch[\s\S]{0,80}不写入治理文件/);
  assert.match(update, /不自动迁移|不触发迁移/);
  assert.match(update, /线上状态 `unknown`/);
  assert.match(update, /固定 SHA/);
  assert.match(update, /不要求负责人逐仓|不要求.*逐能力/);
  assert.match(update, /等价实现/);
  assert.match(update, /不适用/);
  assert.match(update, /本次版本新增\/变更且与项目\s*相关的建议/);
  assert.match(update, /可按主题分组/);
  assert.match(update, /已有且仍有效的\s*语义无需反复复制\s*记账/);
  assert.match(update, /首次对齐缺少基线\s*时再做全量梳理/);
  assert.match(update, /真实语义冲突/);
  assert.match(update, /独立无上下文语义评分/);
  assert.match(update, /只改版本号/);
  assert.match(update, /存量项目已有足够的真实业务意图与适配授权[\s\S]{0,100}不重新要求负责人[\s\S]{0,30}要不要治理升级/);
  assert.match(update, /候选未发布或独立验收待完成只是证据门/);
  assert.match(update, /不冻结[\s\S]{0,30}升级无关的已授权工作/);
  assert.match(update, /首次 `init`[\s\S]{0,80}`TODO\(owner\)`[\s\S]{0,80}不套用于存量适配/);
  assert.match(update, /不覆盖/);
  assert.match(update, /status=file-install-only/);
  assert.match(update, /失败.*回滚|回滚.*失败/);
  assert.match(update, /`full` 能力目前[\s\S]{0,30}不提供/);
  assert.match(update, /接线/);
  assert.match(update, /真实 CLI|真实.*回执/);
  assert.match(update, /所有客户端/);
  assert.match(setup, /governance-update\.mjs/);
  assert.match(setup, /--offline/);
  assert.match(setup, /线上状态 `unknown`/);
  assert.match(setup, /等价实现/);
  assert.match(setup, /不适用/);
  assert.match(setup, /本次版本新增\/变更且与项目\s*相关的建议/);
  assert.match(setup, /可按主题分组/);
  assert.match(setup, /已有且仍有效的\s*语义无需反复复制\s*记账/);
  assert.match(setup, /首次对齐缺少基线\s*时再做全量梳理/);
  assert.match(setup, /真实语义冲突/);
  assert.match(setup, /独立无上下文语义评分/);
  assert.match(setup, /--capability discovery --write/);
  assert.match(setup, /file-install-only/);
  assert.match(setup, /失败.*回滚|回滚.*失败/);
  assert.match(setup, /未带 `--capability` 的旧式 `--write` 必须拒绝/);
  assert.doesNotMatch(setup, /scripts\/upgrade\.mjs --target \/path\/to\/project --write/);
});

test("README and project template explain semantic adaptation without blind copying", () => {
  const readme = read("README.md");
  const template = read("templates/common/INSTRUCTIONS.md");
  for (const text of [readme, template]) {
    assert.match(text, /governance-update\.mjs/);
    assert.match(text, /--offline/);
    assert.match(text, /线上状态 `unknown`/);
    assert.match(text, /采用/);
    assert.match(text, /等价实现/);
    assert.match(text, /不适用/);
    assert.match(text, /本次版本新增\/变更且与项目\s*相关的建议/);
    assert.match(text, /可按主题分组/);
    assert.match(text, /已有且仍有效的\s*语义无需反复复制\s*记账/);
    assert.match(text, /首次对齐缺少基线\s*时再做全量梳理/);
    assert.match(text, /理由/);
    assert.match(text, /真实\s*语义冲突/);
    assert.match(text, /独立无上下文语义评分/);
    assert.match(text, /只改版本号/);
    assert.doesNotMatch(text, /v4\.2\.0/);
  }
  assert.match(template, /存量项目[\s\S]{0,180}(?:不重新要求人工确认|不重新要求负责人确认|直接按本合同执行)/);
  assert.match(template, /候选\s*未发布或独立验收待完成只是证据门/);
  assert.match(template, /不冻结\s*与升级无关的已授权工作/);
  assert.match(template, /首次 `init`[\s\S]{0,100}`TODO\(owner\)`[\s\S]{0,100}不套用于存量适配/);
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
