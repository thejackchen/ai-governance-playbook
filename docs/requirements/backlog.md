# 需求 Backlog

> 说明：本文件是本仓需求状态的唯一权威投影。完成项移入下方归档，不在 ROADMAP 复制状态。

## 元数据

- source: local
- owner: maintainer
- updated: 2026-08-26
- mode: living

## 进行中需求

- [ ] REQ-GOV-003 | owner: maintainer | priority: P0 | title: 把文件升级器改造成治理编译器，并增加开机自检与施工许可
  - source_refs: 负责人任务 2026-08-26；AIOS v3.5.0 lock 已新但 Codex SessionStart 仍接旧入口
  - spec_refs: specs/REQ-GOV-003-governance-compilation-and-boot-self-test.md
  - acceptance: 通用母版先按项目事实适配；同版本也修已知旧接线；未知定制不强覆；Codex 开机自检通过才允许写文件；确定性与语义验收分层，负责人保留最终解释权。
  - evidence: npm run check; npm test; node scripts/governance-verify.mjs --ci；AIOS 新会话正负 fixture

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
