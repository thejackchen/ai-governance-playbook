# ADR-001 · 用 policy representativeJourneys 让设计语言采用范围可见

- 状态：active
- 日期：2026-08-16
- 范围：通用 `frontend-design-system` extension；不包含任何项目品牌、组件库、技术栈或页面审美。

## 决策

继续保留四条设计权威：`designSystem`、`tokens`、`referencePack` 和 `surfaces`。设计语言正文仍由消费项目的产品架构维护；治理不创建视觉 Skill，也不复制设计正文。

在 `governance/frontend-policy.json` 增加顶层 `representativeJourneys` 数组，作为机器可见的采用范围与证据索引。每条旅程包含唯一 `id`、非空 `surfaces`、非空 `states` 和仓库相对 `evidence` 路径；evidence 可以指向文件或目录。

## 原因

只有 token、颜色或一张页面不能证明设计语言跨页面族、状态和关键动作被复用。把旅程索引放入 policy 能让 SessionStart、verifier 和生命周期门看见采用范围与证据，同时避免第五份设计正文和 authority 分裂。

## 生命周期

- `reference-pending` 允许 `representativeJourneys: []`；单条旅程仍必须提供 `evidence` 字段且类型为数组，只允许其值为 `evidence: []`；结构、类型、重复 id 和路径规则仍是硬门。
- `shadow` 和 `enforced` 至少需要一条旅程，且每条旅程至少有一条存在于仓库内的 evidence 路径；`shadow` 的配置检查失败只报告，`enforced` 对 `block` 检查阻断。
- 晋级必须补齐项目自己选择的页面族、状态和证据，不得只修改 lifecycle 字符串。

## 取舍与边界

`representativeJourneys` 是 policy 的机器索引，不承载页面正文、审美判断或技术实现。项目决定旅程的数量、surface、状态和证据形式；治理只验证通用 schema、路径、结构章节和生命周期条件。

## 回退

删除 `representativeJourneys` 及其校验和 SessionStart 读数，并恢复仅四条 authority 的旧模板/脚本；不改变四条权威正文、既有 checks 生命周期或消费项目自己的页面实现。
