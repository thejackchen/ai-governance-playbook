# REQ-GOV-002 规格：Codex/Claude Code Hook 等价启动与收口

## 目标

让 Codex 与 Claude Code 在同一套治理状态来源上获得等价的开工状态板与确定性收口提示，同时保持 Codex 非托管 Hook 的真实信任边界。

## 约束

- Claude Code 与 Grok 消费 `session-start-admission.mjs` 的人类可读 stdout；该薄层复用 `session-start.mjs` 并签发三运行时共用的项目级许可。
- Codex 必须通过最薄 JSON 适配器复用同一份 admission 输出，至少写入 `systemMessage` 与 `hookSpecificOutput.additionalContext`，不得另建许可逻辑。
- doctor 必须能拦住 `.codex/hooks.json` 顶层 schema 漂移；JSON 语法通过但不属于官方顶层字段（当前仅 `description` / `hooks`）也不能放过。
- 状态来源只允许来自 `governance-status` 当前游标/工作树、`governance.lock.json` 版本、活跃 claims 与可验证的未收口信号。
- Stop Hook 只做确定性收口检查与提示，不做语义猜测，也不能在重复失败时无限续轮。
- 每次 Stop 都必须显式输出治理铭牌；成功至少包含从 `governance.lock.json` 读取的版本铭牌与 `✅ 治理验证: 通过`，失败与重复失败也必须带同一版本铭牌。
- 写入 `.codex/hooks.json` 不是生效证据；trusted + `/hooks` 审核仍是 Codex 的真实信任边界。

## 验收

- `npm test` 覆盖 Claude/Grok 文本、Codex JSON 同源、三运行时缺票/过期/接线变化阻断、缺载体 doctor 失败、Stop success clean/dirty 与 repeated failure 均带版本铭牌，且二次失败不无限续轮。
- `npm run check` 与 `node scripts/governance-verify.mjs --ci` 通过。
