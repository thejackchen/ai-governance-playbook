# 事故簿

> 发生真实漏网问题时追加。事故不自动等于加规则；先审计触发、判据、覆盖、绕过和风险接受。

格式：日期 | 现象 | 根因 | 修复 | 永久动作或接受风险 | 证据

| 日期 | 现象 | 根因 | 修复 | 永久动作或接受风险 | 证据 |
|---|---|---|---|---|---|
| 2026-08-26 | v3.7.2 只给 Codex 签发施工许可，项目指定的 Grok/Claude 共享写入入口仍可在旧票或无票时施工，且治理控制面可借文档豁免绕过认领 | 把控制器运行时的适配完成误当成整个施工面的控制闭环；共享 Hook 只承载危险命令/认领，没有接入 boot admission | v3.7.3 增加统一 SessionStart/PreToolUse admission 薄适配器，三运行时共用项目级许可；控制面加入 alwaysClaimPaths；补齐 Grok 密钥/HTTP 旁路与误伤测试 | 每次治理升级必须用实际施工代理跑缺票、过期、接线变化和拆门负例；控制器 PASS 不能替代施工面 PASS | `tests/init-and-doctor.test.mjs`、`tests/playbook-update.test.mjs`、AIOS Grok 4.6/xhigh 零上下文审计 |
| 2026-07-11 | v2文档声称Codex缺少Hooks，导致Codex落地方案被错误降级为纯文档约束 | 运行时能力快照陈旧，且能力判断没有版本化验证 | v3新增Codex Hooks、Rules和CI适配器，并在`CORE.md 附(运行时适配)`登记信任与边界 | 运行时能力只在适配器维护；发布前执行真实CLI契约测试 | `adapters/codex/`、`tests/kit-contract.test.mjs` |
| 2026-07-11 | v2自动审计流程硬编码Anthropic执行器，与“可移植治理”目标冲突 | 把特定供应商实现写进公共模板，核心与载体没有分层 | 删除公共硬编码审计，改为运行时adapter和统一只读AI审计契约 | 核心、适配器、模板分层；contract测试防止再次混入 | `CORE.md 附(运行时适配)`、`docs/audits/v3-content-audit.md` |
