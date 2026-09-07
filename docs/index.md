# 知识路由

| 知识 | 权威位置 | 规则 |
|---|---|---|
| 当前状态与约束 | [ROADMAP.md](../ROADMAP.md) | 就地覆写，不堆历史 |
| 事件流水 | [CHANGELOG.md](../CHANGELOG.md) | append-only |
| 治理核心模型 | [CORE.md](../CORE.md) | 唯一方法论权威 |
| 运行时能力与映射 | [CORE.md · 运行时适配](../CORE.md#运行时适配) | 只描述载体差异，不复制核心 |
| 安装与迁移 | [setup.md](../setup.md) | 新项目与存量项目分别进入 |
| Profile选择 | [profiles/README.md](../profiles/README.md) | 选择最小够用强度 |
| 发布治理 | [docs/release-governance.md](release-governance.md) | 跨项目最小合同；目标、路径和平台命令留在项目本地 release runbook |
| 仓库目录与所有权 | [架构文档索引](architecture/INDEX.md) | 新顶层目录先ADR；项目目录与源码归属见母版 catalog |
| 项目发现能力 | [项目发现说明](project-discovery.md) · [母版项目目录](architecture/project-catalog.md) | 只投影已登记元数据；不把目录当作实时状态或授权 |
| 需求 | [需求索引](requirements/INDEX.md) | 本体需求以 requirements backlog 闭环 |
| 项目发现能力发布与语义适配 | [REQ-GOV-004](requirements/specs/REQ-GOV-004-project-discovery-release.md) | 本次母版语义升级与消费项目自主适配/独立验收合同；历史消费盘点仅作证据，不是当前审批清单；项目资产不进入母版 |
| 前端设计系统扩展 | [扩展说明](../extensions/frontend-design-system/README.md) | 仅有前端项目按需安装；设计语言正文留在项目架构，`representativeJourneys` 提供跨页面采用范围与证据，治理只提供边界与机器验证 |
| 旧版内容审计 | [审计索引](audits/INDEX.md) | 记录保留、修改、删除依据 |
| 前向测试 | [评估索引](evals/INDEX.md) | 保存无上下文案例、结果与复测证据 |
| 决策 | [决策索引](decisions/INDEX.md) | ADR append-only |
| 设计语言代表旅程决策 | [ADR-001](decisions/001-frontend-design-language-journeys.md) | 解释四条权威与 policy 旅程原语的边界 |
| 事故 | [incidents.md](../governance/incidents.md) | 事故发生时追加 |
| 待裁决问题 | [questions.md](../governance/questions.md) | 裁决后链接ADR/判例/commit |
| 规则 | [registry.md](../governance/registry.md) | Profile启用时使用 |
| 判例库 | [判例 README](../governance/cases/README.md) | Profile启用时使用；同族场景先类比判例再动手 |
| 仓外正本路径索引 | [运维索引](ops/INDEX.md) · [CORE §7.1](../CORE.md#71-仓外正本必须有仓内指针) | 只写路径；SessionStart 注入在/缺；未装载禁止用替身凑答案 |
| 治理编译、版本发现/语义适配、可选文件安装与开机自检 | [playbook-update.md](playbook-update.md) · [REQ-GOV-003](requirements/specs/REQ-GOV-003-governance-compilation-and-boot-self-test.md) · [CORE §7.2](../CORE.md#72-治理母版在-github项目实例由适配编译产生) | GitHub VERSION 为通用母版；`governance-update.mjs` 默认做有界版本发现并输出语义适配任务；`upgrade.mjs` 仅在显式选择 discovery 时作为可选 `file-install-only` 文件安装器；两者均按同一升级合同执行；项目事实经适配编译保留；已有 admission、Hook、认领与两次开机合同仅对已接入项目适用，不向所有消费仓通用强制；开机检查按项目合同执行并签发施工许可 |
| 压缩前可恢复坐标 | [CORE §7.3](../CORE.md#73-压缩前必须留下可恢复坐标) · [R13](../governance/registry.md) | PreCompact 检查+注入目录/分支/HEAD；不自动提交 |
