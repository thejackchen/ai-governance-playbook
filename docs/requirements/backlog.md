# 需求 Backlog

> 说明：本文件是本仓需求状态的唯一权威投影。完成项移入下方归档，不在 ROADMAP 复制状态。

## 元数据

- source: local
- owner: maintainer
- updated: 2026-09-07
- mode: living

## 进行中需求

> 当前无已受理需求。

## 已完成需求

- [x] REQ-GOV-004 | owner: maintainer | priority: P0 | title: 发布通用项目发现与自主语义适配升级合同
  - source_refs: 负责人授权与 REQ-GOV-004 规格；ROADMAP 当前游标；VERSION/CHANGELOG 发布锚点
  - spec_refs: specs/REQ-GOV-004-project-discovery-release.md
  - acceptance: 通用发现不含项目业务坐标；按负责人纠偏，项目发现新版后由项目 AI 自主语义适配而非逐仓人工指定或脚本覆盖；保留事实和有效定制，项目验证及无上下文独立评分通过后才更新采用版本；母版 check/test/governance-verify、正反测试及发布回读通过。
  - evidence: v4.3.0 经 PR #6 发布，SHA 6cf12a59d8826e37132e2a6f31e31671cf061ec2；API 与 git fetch 回读 VERSION=4.3.0，CI run 34107998818 成功；主代理复验 162/162、无上下文 A 复测与 B 各 96/100。见 [ROADMAP.md](../../ROADMAP.md)、[无上下文验收](../evals/semantic-upgrade-forward-tests.md)。按负责人纠偏，本次完成母版发布与自主适配机制，不代表所有消费项目已采用；各项目按自身证据执行升级。

- [x] REQ-GOV-003 | owner: maintainer | priority: P0 | title: 把文件升级器改造成治理编译器，并增加开机自检与施工许可
  - source_refs: 负责人任务 2026-08-26；AIOS v3.5.0 lock 已新但 Codex SessionStart 仍接旧入口
  - spec_refs: specs/REQ-GOV-003-governance-compilation-and-boot-self-test.md
  - acceptance: 通用母版先按项目事实适配；同版本也修已知旧接线；未知定制不强覆；Codex 开机自检通过才允许写文件；确定性与语义验收分层，负责人保留最终解释权。
  - evidence: v3.6.1 发布条目已记录远端回读与 AIOS 正负开机 fixture；后续 v3.7.x 接线/别名修订及当前 v4.0.1 版本均见 CHANGELOG.md。Codex Hook trust 与消费项目现场状态仍按项目证据确认，不能由母版版本号代替。

- [x] REQ-GOV-001 | owner: maintainer | priority: P1 | title: 增加本地/外部单一需求权威模式
  - source_refs: governance/cases/2026-07-29-单一需求指针与版本漂移.md
  - spec_refs: specs/REQ-GOV-001-local-external-governance.md
  - acceptance: local/external 入口、policy 与运行时指针必须由 lint/doctor 交叉验证，且安装器不能静默制造双权威。
  - evidence: node --test scripts/requirements-check.test.mjs; node scripts/governance-verify.mjs --ci
- [x] REQ-GOV-002 | owner: maintainer | priority: P1 | title: 提供 Codex/Claude Code Hook 等价启动状态与确定性收口提示
  - source_refs: 负责人任务 2026-08-16
  - spec_refs: specs/REQ-GOV-002-codex-hook-parity.md
  - acceptance: Claude/Grok SessionStart 保持同源人类文本并签发统一许可；Codex SessionStart 返回可解析 JSON 且 `systemMessage`/`additionalContext` 与该文本同源并包含治理版本与当前状态；三运行时写入前都验同一许可；每次 Stop 都显式输出治理版本与通过/失败状态，二次失败不无限续轮；doctor 对缺失载体报错且不漏报 Codex trust 边界。
  - evidence: npm run check; npm test; node scripts/governance-verify.mjs --ci
