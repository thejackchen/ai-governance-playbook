# 治理编译、版本升级与开机自检

> 给负责人和消费项目：远端保存通用母版，项目仓保存结合自身事实后的治理实例。
> 本页是升级入口合同，不替项目保存资产、凭据正文或运行时配置。

## 线上正本与默认行为

GitHub 默认分支的 `VERSION` 是通用母版的线上标记：

https://github.com/thejackchen/ai-governance-playbook

消费仓的 `governance.lock.json` 记录实际采用的版本、kit 指纹和适配回执。版本号相同
也不等于接线有效，能力回执也不等于全量采用。

- 母版升级/来源准入只读取本地已抓取的 `refs/remotes/origin/main`（必要时比较其中的
  `VERSION`）；默认不拉取、不写工作树、不改 lock，也不触发迁移。需要刷新母版来源时由用户
  正常显式执行 `git fetch`，再重跑只读计划；来源未抓取或无法证明时只报告本地事实。
- 以上默认仅约束母版升级与来源准入；项目公共线（如 `integrationLine`）同步仍按项目合同
  执行，合同允许时可联网 fetch。SessionStart 的实际接线与行为以项目自身证据为准，本页不
  宣称它已实现 `origin/main` 的 `VERSION` 比较。
- `node <mother>/scripts/upgrade.mjs --target .` 是只读计划，输出能力、来源版本/SHA、
  文件动作和冲突，不安装任何文件。
- 没有 `--capability` 的旧式 `--write` 请求必须拒绝并保持工作树不变；`full` 能力目前
  不提供。不要把一次版本检查或下载结果写成“项目已升级”。

## 开机流程

开机行为按项目现有 SessionStart 合同执行；母版来源核对不在每轮对话或每次工具调用时强制打网，
本页不把 SessionStart 宣称为 `origin/main` 的 `VERSION` 比较器：

1. 项目按自身合同读取 `governance.lock.json`；显式升级计划需要来源证明时，检查本地已抓取的
   `refs/remotes/origin/main:VERSION`。
2. 确认项目自己的宪法、游标、业务文档、policy、catalog 和仓外事实索引仍由项目持有。
3. 运行项目自己的 `scripts/governance-verify.mjs --fast`（若存在），报告接线与能力状态；
   失败只允许查看和诊断。
4. 运行时 admission、SessionStart、PreToolUse、Stop 和 PreCompact 的接线仍按各项目既有
   合同验证。发现能力安装不替代 admission safety gate，也不声称 Codex、Claude Code、
   Grok 已统一接入。

写行为文件前，运行时的 PreToolUse 仍验证同一张项目级许可；许可缺失、过期或关键接线
变化时 fail-closed，查看和诊断继续可用。这里的能力安装不能绕过认领门或已有安全门。

## 显式能力升级（当前仅 discovery）

先看计划：

```bash
node <mother>/scripts/upgrade.mjs --target . --capability discovery
```

确认计划、目标工作树和来源 kit 均无冲突后，才可以按负责人授权写入：

```bash
node <mother>/scripts/upgrade.mjs --target . --capability discovery --write
```

`discovery --write` 仅安装以下 8 个通用能力文件：

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
| Codex、Claude Code、Grok 分别通过 | 每个被测试客户端的事实 | “所有客户端”或跨项目统一采用 |

发布状态与当前游标见 [ROADMAP.md](../ROADMAP.md)；跨项目采用必须另有项目清单、提交和
验收证据；本页不替任何项目宣称完成。
