# 知识路由

| 知识 | 权威位置 | 规则 |
|---|---|---|
| 当前状态与约束 | `ROADMAP.md` | 就地覆写，不堆历史 |
| 事件流水 | `CHANGELOG.md` | append-only |
| 架构当前真相 | [{{ARCHITECTURE_SOURCE}}](../{{ARCHITECTURE_SOURCE}}) | 当前投影 |
| 仓库目录与所有权 | `docs/architecture/repository-layout.md` | 新顶层目录先ADR |
| 需求 | [需求]({{REQUIREMENTS_LINK}}) | 单一入口：本地活文档/外部指针之一 |
| 发布治理 | 项目本地 release runbook（存在发布面时建立） | 按[上游发布治理合同](https://github.com/thejackchen/ai-governance-playbook/blob/main/docs/release-governance.md)实例化目标、制品、入口、阶段、证据与回滚；无发布面不建空模板 |
| 决策 | `docs/decisions/` | ADR append-only |
| 事故 | `governance/incidents.md` | 事故发生时追加 |
| 待裁决问题 | `governance/questions.md` | 裁决后链接ADR/判例/commit |
| 规则 | `governance/registry.md` | Profile启用时使用 |
| 判例库 | `governance/cases/` | Profile启用时使用；同族场景先类比判例再动手 |
| 仓外正本路径索引 | `docs/ops/extra-repo-facts.md` | 只写路径；SessionStart 注入在/缺；未装载禁止用替身凑答案 |
| 认领门 | `governance/claim-gate.md` | Profile启用时使用 |
{{FRONTEND_DESIGN_SYSTEM_ROUTE}}
