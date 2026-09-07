# 母版项目目录

本页是 `project-catalog.json` 的人读说明；JSON 是机器校验入口。目录登记母版仓库自己的代码、模板和验证资产，不复制任何消费项目的坐标、业务资产或外部凭据正文。

## 发现边界

- 目录是元数据投影，不是实时状态、施工许可、运行时健康检查或发布回执。
- `sourceRoots` 明确列出本次源码归属检查的范围：`scripts`、`templates`、`adapters`、`profiles`、`extensions`、`tests`、`skill`。未列出的仓库范围保持未声明，不按整仓推断。
- `sourceCollections` 只是提醒哪些目录需要继续细分；`sourcePaths` 由资产所有者负责，必须在显式 root 内并且不得用 collection 本身兜底。每个 Git 跟踪文件应恰好归属一个资产。
- 本仓库没有已登记的 workstream 目录，因此 JSON 不声明 `workstreamDirectory`；检查结果的 workstream universe 保持 `unknown`，不会凭空生成工作线。
- 本目录没有 `credentialRefs`。凭据若在消费项目中存在，只能由该项目的 `docs/ops/extra-repo-facts.json` 登记 ID 定位；目录不读取或复制凭据正文。

## 八类任务域

搜索器固定提供以下分类过滤器；当前资产不要求每类都有条目，空类显示为 0 项而不制造示例资产。

| 分类 | 当前母版示例 |
|---|---|
| 产品与业务 | `project-discovery-search` |
| 架构与数据 | `project-discovery-catalog`、`project-discovery-map` |
| 产品设计 | `frontend-design-extension` |
| 软件开发与范例 | `template-families`、`project-discovery-support-libraries` |
| Git与CI/CD | `discovery-upgrade-engine`、`contract-test-suite` |
| 环境与接入 | `runtime-adapters` |
| 安全与凭据 | `governance-hooks`、`governance-profiles` |
| 运行维护 | `governance-orchestration`、`governance-skills` |

可用查询（在已安装项目的仓库根目录执行）：

```bash
node scripts/lib/catalog-search.mjs --query discovery
node scripts/lib/catalog-search.mjs --category 'Git与CI/CD'
node scripts/lib/catalog-search.mjs --related project-discovery-catalog --json
```

查询只返回登记的入口和边界指针，不执行入口，也不把命中结果当作授权。

## 资产清单

| ID | 类型/分类 | 入口 | 负责方 | 归属范围摘要 |
|---|---|---|---|---|
| `governance-orchestration` | runtime · 运行维护/治理编排 | `scripts/init.mjs` | playbook-maintainers | 安装、doctor、verify、状态与显式升级编排 |
| `governance-hooks` | runtime · 安全与凭据/确定性门禁 | `scripts/governance-hooks/session-start.mjs` | playbook-maintainers | 四类运行时触发器 |
| `discovery-upgrade-engine` | component · Git与CI/CD/显式能力升级 | `scripts/lib/discovery-upgrade.mjs` | playbook-maintainers | discovery 文件的计划、冲突、回执与回滚 |
| `project-discovery-catalog` | component · 架构与数据/项目目录 | `templates/common/scripts/lib/project-catalog.mjs` | playbook-maintainers | 显式源码根、所有权、关联与 workstream 状态 |
| `project-discovery-map` | component · 架构与数据/开工地图 | `templates/common/scripts/lib/discovery-map.mjs` | playbook-maintainers | `discoveryIds` 选择的有界元数据投影 |
| `project-discovery-search` | component · 产品与业务/任务检索 | `templates/common/scripts/lib/catalog-search.mjs` | playbook-maintainers | 名称、别名、标签、分类和一跳关联检索 |
| `project-discovery-support-libraries` | component · 软件开发与范例/发现支撑库 | `templates/common/scripts/lib/docs-index.mjs` | playbook-maintainers | 文档可达性与有界环境诊断等支撑 |
| `runtime-adapters` | runtime · 环境与接入/运行时适配 | `adapters/codex/adapter.json` | playbook-maintainers | Codex、Claude Code、Generic 薄适配层 |
| `template-families` | guide · 软件开发与范例/项目模板 | `templates/README.md` | playbook-maintainers | common 与分层模板 |
| `governance-profiles` | guide · 安全与凭据/Profile选择 | `profiles/README.md` | playbook-maintainers | Lite、Standard、High Assurance 清单 |
| `frontend-design-extension` | component · 产品设计/前端设计系统 | `extensions/frontend-design-system/README.md` | playbook-maintainers | 按需安装的设计系统扩展 |
| `contract-test-suite` | component · Git与CI/CD/契约测试 | `tests/kit-contract.test.mjs` | playbook-maintainers | 安装、门禁与发现能力的正反合同 |
| `governance-skills` | guide · 运行维护/工作流 Skill | `skill/README.md` | playbook-maintainers | 引导、优化、协作与收口薄入口 |

## 开工地图重点对象

`discoveryIds` 当前只投影三个真实母版对象：`project-discovery-catalog`、`project-discovery-map`、`project-discovery-search`。它们的入口均位于公共模板的发现库中；其余资产仍可用搜索器按需定位。重点对象的入口存在性和仓内边界由 `loadDiscoveryMap` 再验一次，缺少或越界时地图不装载。

这不是版本发布或消费项目采用声明。本地工作树、远端版本回读、实际客户端 Hook 信任和消费项目逐项验收，分别由发布合同与各消费项目证据记录。

## 可复现检查

以下命令直接调用当前模板函数，检查 catalog 与文档索引；未暂存的新文件不会进入 `git ls-files` 分母，最终验收应在负责人精确暂存本轮文件后重跑。

```bash
node --input-type=module -e 'import { inspectProjectCatalog } from "./templates/common/scripts/lib/project-catalog.mjs"; console.log(JSON.stringify(inspectProjectCatalog(process.cwd()), null, 2))'
node --input-type=module -e 'import { inspectDocsIndex } from "./templates/common/scripts/lib/docs-index.mjs"; console.log(JSON.stringify(inspectDocsIndex(process.cwd()), null, 2))'
node --input-type=module -e 'import { loadDiscoveryMap } from "./templates/common/scripts/lib/discovery-map.mjs"; console.log(loadDiscoveryMap(process.cwd()))'
```

`inspectProjectCatalog` 的源码覆盖必须在显式范围内做到 `covered=total` 且无 uncovered/overlapping；未声明 workstream 时应明确显示 `unknownUniverse=true`。`inspectDocsIndex` 则从根知识路由递归走 `INDEX.md`，仅把真实可达的 Markdown/PPTX/PDF 计入覆盖率。
