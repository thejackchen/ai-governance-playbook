# REQ-GOV-001 规格：单一需求权威与安装治理

## 目标

为 local 和 external 两种需求权威模式提供可执行、可审计且不会在普通重跑安装器时漂移的治理合同。

## 约束

- local 仅以 `docs/requirements/backlog.md` 为内置 checker 的权威来源。
- external 的 policy、运行时指令与 `docs/index.md` 必须指向同一个 URL。
- 已安装项目的普通 init 不得改写已有 policy 或 lock；模式迁移必须先完成显式内容迁移并通过 lint。

## 验收

- `node --test scripts/requirements-check.test.mjs` 覆盖进行中和已完成需求的字段、规格与证据约束。
- `node scripts/governance-verify.mjs --ci` 与 `node scripts/doctor.mjs --target .` 均通过。
