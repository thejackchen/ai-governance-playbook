# 治理编译、版本升级与开机自检

> 给负责人和消费项目：远端保存通用母版，项目仓保存结合自身事实后的治理实例。
> 本页是升级入口合同，不替项目保存资产、凭据正文或运行时配置。

## 线上正本与默认行为

GitHub 默认分支的 `VERSION` 是通用母版的线上标记：

https://github.com/thejackchen/ai-governance-playbook

消费仓的 `governance.lock.json` 记录实际采用的版本、kit 指纹和适配回执。版本号相同
也不等于接线有效，能力回执也不等于全量采用。

- 兼容 `upgrade.mjs` 安装器的来源准入只读取本地已抓取的 `refs/remotes/origin/main`（必要时
  比较其中的 `VERSION`）；写入前若需刷新来源，按该安装器合同显式执行 `git fetch`，再重跑
  只读计划。来源未抓取或无法证明时只报告本地事实。语义适配的版本发现入口另见下节：
  它可以做一次有界在线检查，并允许项目 AI 按已发布固定 SHA 读取母版正本，不把在线回执
  本身当作文件写入授权。
- 以上默认仅约束母版升级与来源准入；项目公共线（如 `integrationLine`）同步仍按项目合同
  执行，合同允许时可联网 fetch。SessionStart 的实际接线与行为以项目自身证据为准，本页不
  宣称它已实现 `origin/main` 的 `VERSION` 比较。
- 旧 `node <mother>/scripts/upgrade.mjs --target .` 是只读计划，输出能力、来源版本/SHA、
  文件动作和冲突，不安装任何文件。没有 `--capability` 的旧式 `--write` 请求必须拒绝并
  保持工作树不变；`full` 能力目前不提供。不要把一次版本检查或下载结果写成“项目已升级”。

## 新版发现与语义适配（默认入口）

消费项目在启动或手动兜底时运行：

```bash
node <mother>/scripts/governance-update.mjs --target .
```

该入口默认最多发起一次有界在线 `VERSION` 检查，并只输出版本事实和可执行的语义适配任务
提示；它不做 git pull/fetch 或来源同步，不写入治理文件、不改 `governance.lock.json`，也不自动迁移。
线上检查
失败或环境不便联网时，AI 明确使用离线兜底：

```bash
node <mother>/scripts/governance-update.mjs --target . --offline
```

`--offline` 只报告本地已知版本与线上状态 `unknown`，不猜测线上内容，也不承诺生成新版
适配任务。线上发现新版后，消费项目 AI 可按已发布固定 SHA 读取母版建议并理解、映射到
本项目治理文件，不要求负责人逐仓或逐能力指定。模板是语义建议，不是待复制的项目正文；
项目 AI 必须：

1. 以项目自己的宪法、游标、业务文档和 policy 作为适配输入与权威，不由模板原样覆盖；允许
   在映射与验证支撑下改造治理表述，同时保留项目事实、有效定制和 WIP；
2. 对本次版本新增/变更且与项目相关的建议（可按主题分组），选择“采用”“等价实现”或
   “不适用”，写清项目映射与理由；已有且仍有效的语义无需反复复制记账；首次对齐缺少基线
   时再做全量梳理；已知差异不自动升级为人工裁决；
3. 只有无法解决的真实语义冲突或无法判断负责人意图时，才在项目问题队列提问；
4. 先通过项目确定性验证，再通过独立无上下文语义评分，最后才把 `playbookVersion`、
   指纹和适配回执前移。复制模板或只改版本号均不构成采用。

存量项目已有足够的真实业务意图与适配授权时，AI 直接按上述合同完成适配，不重新要求负责人
确认“要不要治理升级”。候选未发布或独立验收待完成只是证据门，不是新增负责人审批，也不冻结
与升级无关的已授权工作；首次 `init` 的 `TODO(owner)` 规则只适用于缺少意图基线的新装项目，
不套用于存量适配。

语义适配由项目 AI 完成，`governance-update.mjs` 只负责有界发现和任务注入，不签发新的
许可、不建立新的审批体系、不自动 push/deploy。已有项目的 admission、Hook、认领门和
两次开机合同继续按项目自身规则执行。

## 开机流程

开机行为按项目现有 SessionStart 合同执行；若项目已接入 `governance-update.mjs`，只在启动
阶段做一次有界版本发现，不在每轮对话或每次工具调用时强制打网。本页不把 SessionStart
宣称为 `origin/main` 的 `VERSION` 比较器：

1. 项目按自身合同读取 `governance.lock.json`；旧 `upgrade.mjs` 安装器的适配计划需要来源
   证明时，检查本地已抓取的 `refs/remotes/origin/main:VERSION`；语义适配则使用已发布固定
   SHA 的母版正本；线上发现失败时改用 `--offline` 手动兜底（仅报告本地版本与线上 unknown）。
2. 确认项目自己的宪法、游标、业务文档、policy、catalog 和仓外事实索引仍由项目持有并
   作为适配输入与权威；允许 AI 改造治理表述，但不覆盖项目事实、有效定制或 WIP。
3. 运行项目自己的 `scripts/governance-verify.mjs --fast`（若存在），报告接线与能力状态；
   失败只允许查看和诊断。
4. 运行时 admission、SessionStart、PreToolUse、Stop 和 PreCompact 的接线仍按各项目既有
   合同验证。发现能力安装不替代 admission safety gate，也不声称 Codex、Claude Code、
   Grok 已统一接入。

写行为文件前，运行时的 PreToolUse 仍验证同一张项目级许可；许可缺失、过期或关键接线
变化时 fail-closed，查看和诊断继续可用。这里的能力安装不能绕过认领门或已有安全门。

## 可选能力文件安装（当前仅 discovery）

先看计划：

```bash
node <mother>/scripts/upgrade.mjs --target . --capability discovery
```

若语义任务显示项目缺少发现能力载体，可在只读计划、目标工作树和来源 kit 均无冲突后，
按项目现有写入权限选择安装；这一步不是语义采用的前置条件：

```bash
node <mother>/scripts/upgrade.mjs --target . --capability discovery --write
```

`discovery --write` 仅安装以下 8 个通用能力文件，仍是可选的 `file-install-only` 安装器：

```text
scripts/lib/docs-index.mjs
scripts/lib/project-catalog.mjs
scripts/lib/catalog-search.mjs
scripts/lib/discovery-map.mjs
scripts/lib/environment-check.mjs
scripts/project-catalog.mjs
scripts/discovery-map.mjs
scripts/environment-check.mjs
```

应用前会再次盘点并整批检查来源 SHA、目标脏状态、受管文件指纹和项目验证器；已存在但
未登记、被改写、为符号链接或与计划不一致的目标进入 `conflict`，不覆盖。写入只新增或
更新上述能力文件，并在 `governance.lock.json.capabilities.discovery` 记录
`status=file-install-only`、来源版本/SHA/指纹、文件回执和验证结果。它不会改变
`playbookVersion`、`kitFingerprint`、`runtime`、`profile`、admission、任何 Hook、policy、
项目 catalog、仓外事实或业务文档。

写入后运行项目的 `scripts/governance-verify.mjs --fast`。验证失败、进程异常或 lock 无法
安全写入时，所有能力文件和 lock 一并回滚；回执为失败/回滚，不能留下“已采用”。

## 项目发现能力的事实边界

发现能力只读取项目自有的 `docs/architecture/project-catalog.json` 和仓内事实索引，默认
离线，不连接目标机器。catalog 缺失时 CLI 报告“未配置”；`assets` 可以为空，地图在
`discoveryIds` 缺失或为空时报告未装载，不补示例主机、服务、团队或 100% 覆盖率。项目按
需填写八个任务域、稳定资产 ID、别名、标签、一跳关联、源码范围和工作线；具体入口、边界
与资产正文留在项目本地。

仓外凭据只能以 `docs/ops/extra-repo-facts.json` 中登记的稳定 ID 被引用，CLI 和地图不读
或输出凭据正文。省略 `sourceRoots` 或 `workstreamDirectory` 时，覆盖宇宙为未知，不得
把仓库全量当作已检查。

项目 CLI（安装能力后可用，均为本地诊断）示例：

```bash
node scripts/project-catalog.mjs --check --json
node scripts/discovery-map.mjs
node scripts/project-catalog.mjs --query <名称或别名>
node scripts/project-catalog.mjs --category '<任务域>'
node scripts/environment-check.mjs --url https://<目标路径>
```

`environment-check` 只按需对单个 HTTPS URL 做有界、无凭据、单次 HEAD；不跟随跳转、不
重试、不把 HTTP 成功当作业务或多客户端验收。

## 采用层级不能混写

| 层级 | 证明什么 | 不能证明什么 |
|---|---|---|
| 母版能力文件存在 | 8 个文件来自可回读的来源 kit | 项目 catalog 已填、任何运行时已接线 |
| catalog/schema 与 `--fast` 通过 | 项目声明的入口、范围、ID 和边界可验证 | 真实服务可达、凭据可用、全仓覆盖 |
| SessionStart/PreToolUse 接线 fixture 通过 | 指定运行时的接线和安全门活着 | 其它客户端已接线 |
| 真实 CLI/环境调用回执 | 指定机器、目标和时间的一次只读结果 | 其它机器、用户、生产或持续可用 |
| 语义适配记录 + 项目确定性验证 + 独立无上下文评分 | 项目 AI 已按建议完成映射并证明含义保持 | 其它项目、客户端或生产行为已采用 |
| Codex、Claude Code、Grok 分别通过 | 每个被测试客户端的事实 | “所有客户端”或跨项目统一采用 |

发布状态与当前游标见 [ROADMAP.md](../ROADMAP.md)；跨项目采用必须另有项目清单、提交和
验收证据；本页不替任何项目宣称完成。
