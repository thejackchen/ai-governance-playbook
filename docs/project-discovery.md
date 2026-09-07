# 项目发现能力（母版合同）

> 本页定义可移植的索引、分类检索、开工地图和有界环境诊断。它不登记任何项目的
> 主机、服务、团队、客户或凭据正文。母版版本、当前游标与发布回读见
> [ROADMAP.md](../ROADMAP.md)；本页不是发布回执。

## 目标与边界

发现能力回答“先读哪份正本、某个对象属于哪类、当前项目声明了哪些范围”，不回答“目标
机器现在是否可用”或“是否有权执行操作”。项目资产、事实入口、源码根、工作线、外部
路径和凭据索引都留在消费项目本地；母版只提供 schema、脚本和验证合同。

- **真相在文本**：catalog 只做稳定元数据投影；业务正文和运行状态仍以项目自己的权威
  文档、源码、服务回执为准。
- **行动跟文本**：先从 `docs/index.md` 找 catalog 和正本，再按任务需要检索或诊断；
  没有声明的对象不自动创建。
- **底线在机器**：schema、入口边界、范围归属、凭据 ID 和地图预算由确定性脚本检查；
  发现能力不绕过 admission safety gate、认领门或项目权限。

## 八个任务域

所有资产按任务而不是按工具名称归类。允许使用根域下的细分路径（例如
`Git与CI/CD/同步`），但根域必须是下表之一；检索可按根域或细分段筛选。

| 任务域 | 用于定位的问题 |
|---|---|
| 产品与业务 | 产品目标、业务流程、客户规则与验收 |
| 架构与数据 | 系统边界、数据流、schema、依赖与迁移 |
| 产品设计 | 设计语言、页面族、交互状态与内容角色 |
| 软件开发与范例 | 源码模块、实现范例、测试和开发约定 |
| Git与CI/CD | 分支、提交、流水线、发布和回滚证据 |
| 环境与接入 | 本地/远端入口、网络、服务端点和运行环境 |
| 安全与凭据 | 权限边界、凭据引用、合规与安全检查 |
| 运行维护 | 监控、备份、故障处理、值班和恢复 |

## catalog schema v1

项目自有 `docs/architecture/project-catalog.json` 是唯一元数据入口。顶层必须有
`schemaVersion: 1` 和 `assets` 数组；可选顶层字段如下：

| 字段 | 约束与用途 |
|---|---|
| `sourceRoots` | 安全的仓内相对目录数组；只声明需要做源码覆盖检查的范围 |
| `sourceCollections` | `sourceRoots` 内的集合提示；不能被资产直接作为宽泛 `sourcePaths` |
| `workstreamDirectory` | 安全的仓内相对目录；其下的工作线 Markdown 才进入覆盖统计 |
| `discoveryIds` | 本项目愿意投影到开工地图的资产 ID 数组；缺失/空数组表示未配置 |
| `assets` | 可为空；每项是下列元数据对象，不能塞业务正文或秘密 |

每项资产至少声明：

- 稳定唯一 `id`、`kind`（`component`、`runtime`、`external-repository` 或 `guide`）、
  `purpose`、`entry`、`owner` 和 `boundaries`；`entry` 必须是 Git 跟踪且位于仓内的文件；
- 可选非空字符串数组 `aliases`、`tags`、`sourcePaths`、`workstreams`、`links`；别名和
  标签用于多名称检索，一跳 `links` 只能指向 catalog 中已声明的 ID；
- 可选 `category` 必须落在八个任务域之一（可带细分路径）；
- 可选 `credentialRefs` 只能填写 `docs/ops/extra-repo-facts.json` 已登记的稳定 ID；
  CLI、地图、日志和报告永远不读取或输出凭据正文；
- `externalPath` 若声明必须是非空指针；`kind: external-repository` 必须提供它。该值只是
  项目维护的路径/URL 指针，母版和发现脚本不跟随、不下载、不执行。

`sourceRoots` 或 `workstreamDirectory` 省略时，检查器将相应覆盖宇宙标为
`unknownUniverse`，不把整个仓库凑成 100% 已覆盖。目录 CLI 在 catalog 缺失时报告“未配置”；
`assets` 可以为空，而地图在 `discoveryIds` 缺失或为空时报告未装载。不得为了通过覆盖率
或地图测试写入虚假主机、服务、团队、工作线或资产。

## 本地 CLI 与地图

能力文件安装后，以下命令默认离线、只读项目文件：

```bash
node scripts/project-catalog.mjs --check [--json]
node scripts/discovery-map.mjs
node scripts/project-catalog.mjs --query <名称、别名或标签>
node scripts/project-catalog.mjs --category '<任务域或细分段>'
node scripts/project-catalog.mjs --related <资产ID>
node scripts/environment-check.mjs --url https://<目标路径>
```

`catalog-search` 的 query/category/related 条件按 AND 组合；同一别名的多个候选全部保留，
结果只含 ID、用途、入口、边界和匹配字段，不赋予操作授权。`discovery-map` 只投影显式
`discoveryIds`，输出不超过 **60 行且 6 KiB（6144 bytes）**；超出预算直接报错，不静默
截断。地图是元数据，不是实时状态、联网结果或施工许可。

`environment-check` 只在负责人按需给出单个无凭据 `https://` URL 时执行一次有界 HEAD：
不带 query/fragment/用户名密码，不跟随跳转、不重试、不读取 cookie/netrc，不输出底层
错误或响应正文。一次 HTTP 结果只说明当前进程此次到该端点的只读探测，不证明业务可用、
其它机器可达、代理/VPN 已开启或所有客户端均通过。

## 采用与验收分层

| 证据 | 可以宣称 | 不能宣称 |
|---|---|---|
| 母版 8 个文件已安装 | 能力文件来自可回读来源 kit | catalog 已填、项目事实已适配、运行时已接线 |
| catalog/schema 与 `project-catalog validate` 通过 | 已声明入口、范围、ID、关联和边界可检查 | 未声明范围全覆盖、真实服务/凭据可用 |
| 指定运行时 SessionStart/PreToolUse fixture 通过 | 该客户端的接线与现有安全门活跃 | 其它客户端已接入 |
| 指定机器的一次 CLI/环境回执 | 该时间、目标和调用者的只读结果 | 生产、持续可用、其它机器/用户或所有客户端 |
| Codex、Claude Code、Grok 各自有证据 | 三个被实际测试客户端分别通过 | 跨项目统一采用或无需项目接线 |

安装 discovery 能力不会修改 `playbookVersion`、`kitFingerprint`、admission、任何 Hook、
policy、项目 catalog 或仓外事实；lock 中的 `capabilities.discovery.status=file-install-only`
只表示能力文件回执，不是全量升级。项目若要接线或进行真实调用，必须依照自己的事实、
权限和 runbook 另行验收。

相关安装/升级合同见 [`docs/playbook-update.md`](playbook-update.md) 与 [`setup.md`](../setup.md)；
项目的目录与资产入口应从项目自己的 [`docs/index.md`](index.md) 继续导航。
