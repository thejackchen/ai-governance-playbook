# 需求 Backlog

> 说明：本文件是本仓需求状态的唯一权威投影。完成项移入下方归档，不在 ROADMAP 复制状态。

## 元数据

- source: local
- owner: maintainer
- updated: 2026-07-29
- mode: living

## 进行中需求

> 当前无已受理需求。

## 已完成需求

- [x] REQ-GOV-001 | owner: maintainer | priority: P1 | title: 增加本地/外部单一需求权威模式
  - source_refs: governance/cases/2026-07-29-单一需求指针与版本漂移.md
  - spec_refs: specs/REQ-GOV-001-local-external-governance.md
  - acceptance: local/external 入口、policy 与运行时指针必须由 lint/doctor 交叉验证，且安装器不能静默制造双权威。
  - evidence: node --test scripts/requirements-check.test.mjs; node scripts/governance-verify.mjs --ci
