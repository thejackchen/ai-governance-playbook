# 仓库结构地图

> 本页描述目录职责与依赖边界，不列举每个文件。新增顶层目录、新运行时或跨层依赖先写ADR，再更新本页和自动检查。

| 路径 | 所有者/职责 | 允许内容 | 禁止内容 | 验证 |
|---|---|---|---|---|
| `CORE.md` | 治理方法论唯一权威 | 运行时无关原则 | 供应商专属命令、项目模板 | contract测试 + review |
| `ADAPTERS.md` | 运行时能力地图 | Codex、Claude Code、Generic载体差异 | 第二套核心原则 | contract测试 + review |
| `setup.md` / `MIGRATION.md` / `SELF-CHECK.md` | 安装、迁移和验收入口 | 面向采用者的流程 | 模板正文副本 | 链接lint + 前向测试 |
| `adapters/` | 运行时发行包 | adapter manifest、专属配置、Hooks和Rules | 通用方法论副本 | adapter契约测试 |
| `templates/` | 跨运行时项目模板 | common、standard、high-assurance分层文件 | 运行时专属配置 | init集成测试 |
| `profiles/` | 治理强度配置 | Lite/Standard/High Assurance结构化清单 | 项目特定规则 | schema/contract测试 |
| `extensions/` | 可选领域治理 | 前端设计系统等显式扩展 | 强制所有项目采用的领域规则 | 扩展安装测试 |
| `scripts/` | 可重复执行工具 | init、doctor、verify、lint、验证脚本 | 一次性临时输出 | `npm run check`、`npm test` |
| `tests/` | 自动化验证 | 安装、适配器、模板和红线契约测试 | 生产实现 | `npm test` |
| `skill/` | Codex Skill薄入口 | 触发描述、最短工作流、UI metadata | 安装细节和模板副本 | skill quick validation |
| `docs/` | 知识投影 | 架构地图、ADR、审计、评估报告 | 生成缓存、运行时状态 | governance lint |
| `governance/` | 本仓库治理状态 | policy、事故、问题、规则、案例 | 通用模板正文 | governance lint |
| `.codex/` / `.githooks/` / `.github/` | 本仓库已安装载体 | Hooks、Rules、pre-commit、CI | 核心方法论 | doctor + CI |
| 根目录元数据 | 项目入口与工具配置 | README、LICENSE、package、lock、git配置 | 临时报告、截图、缓存 | allowedTopLevelEntries |

## 顶层目录准入

`governance/policy.json`中的`allowedTopLevelEntries`非空时，governance lint会拒绝未知顶层项。存量项目先完成分类再启用，避免把历史混乱直接合法化。

## 生成物与临时文件

- 生成物放项目指定目录，并标记来源；CI检查漂移。
- 缓存、日志、临时导出放固定目录并加入`.gitignore`。
- 禁止在仓库根留下未登记的截图、报告、JSON导出或调试文件。
