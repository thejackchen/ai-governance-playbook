# 知识路由

| 知识 | 权威位置 | 规则 |
|---|---|---|
| 当前状态与约束 | `ROADMAP.md` | 就地覆写，不堆历史 |
| 事件流水 | `CHANGELOG.md` | append-only |
| 治理核心模型 | `CORE.md` | 唯一方法论权威 |
| 运行时能力与映射 | `CORE.md 附(运行时适配)` | 只描述载体差异，不复制核心 |
| 安装与迁移 | `setup.md`、`setup.md 附A(存量迁移)` | 新项目与存量项目分别进入 |
| Profile选择 | `profiles/README.md` | 选择最小够用强度 |
| 发布治理 | `docs/release-governance.md` | 跨项目最小合同；目标、路径和平台命令留在项目本地 release runbook |
| 仓库目录与所有权 | `docs/architecture/repository-layout.md` | 新顶层目录先ADR |
| 需求 | [需求](requirements/backlog.md) | 本体需求以 requirements backlog 闭环 |
| 前端设计系统扩展 | `extensions/frontend-design-system/README.md` | 仅有前端项目按需安装；设计语言正文留在项目架构，`representativeJourneys` 提供跨页面采用范围与证据，治理只提供边界与机器验证 |
| 旧版内容审计 | `docs/audits/v3-content-audit.md` | 记录保留、修改、删除依据 |
| 前向测试 | `docs/evals/` | 保存无上下文案例、结果与复测证据 |
| 决策 | `docs/decisions/` | ADR append-only |
| 设计语言代表旅程决策 | `docs/decisions/001-frontend-design-language-journeys.md` | 解释四条权威与 policy 旅程原语的边界 |
| 事故 | `governance/incidents.md` | 事故发生时追加 |
| 待裁决问题 | `governance/questions.md` | 裁决后链接ADR/判例/commit |
| 规则 | `governance/registry.md` | Profile启用时使用 |
| 判例库 | `governance/cases/` | Profile启用时使用；同族场景先类比判例再动手 |
| 仓外正本路径索引 | `docs/ops/extra-repo-facts.json`、CORE §7.1 | 只写路径；SessionStart 注入在/缺；未装载禁止用替身凑答案 |
| 治理版本与 lock 升级 | `docs/playbook-update.md`、CORE §7.2 | GitHub VERSION 为正本；开机查一次；只补缺失载体 |
