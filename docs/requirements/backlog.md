# 需求 Backlog

> 说明：本文件是本仓需求状态的唯一权威投影。完成项移入下方归档，不在 ROADMAP 复制状态。

## 元数据

- source: local
- owner: maintainer
- updated: 2026-08-16
- mode: living

## 进行中需求

> 当前无已受理需求。

## 已完成需求

- [x] REQ-GOV-001 | owner: maintainer | priority: P1 | title: 增加本地/外部单一需求权威模式
  - source_refs: governance/cases/2026-07-29-单一需求指针与版本漂移.md
  - spec_refs: specs/REQ-GOV-001-local-external-governance.md
  - acceptance: local/external 入口、policy 与运行时指针必须由 lint/doctor 交叉验证，且安装器不能静默制造双权威。
  - evidence: node --test scripts/requirements-check.test.mjs; node scripts/governance-verify.mjs --ci
- [x] REQ-GOV-002 | owner: maintainer | priority: P1 | title: 提供 Codex/Claude Code Hook 等价启动状态与确定性收口提示
  - source_refs: 负责人任务 2026-08-16
  - spec_refs: specs/REQ-GOV-002-codex-hook-parity.md
  - acceptance: Claude SessionStart 保持人类文本；Codex SessionStart 返回可解析 JSON 且 `systemMessage`/`additionalContext` 同源并包含治理版本与当前状态；每次 Stop 都显式输出治理版本与通过/失败状态，二次失败不无限续轮；doctor 对缺失载体报错且不漏报 Codex trust 边界。
  - evidence: npm run check; npm test; node scripts/governance-verify.mjs --ci
