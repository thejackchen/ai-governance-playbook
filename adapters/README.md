# 运行时适配

方法论只在 [CORE](../CORE.md)。Lite 由 `scripts/init.mjs --tools ...` 生成接线；所有规则实现在同一个 `scripts/governance.mjs`，不再复制三个包装脚本。

| 工具 | 配置 | SessionStart | PreToolUse 拒绝 | Stop |
|---|---|---|---|---|
| Codex | `.codex/hooks.json`、`.codex/config.toml` | JSON additionalContext + systemMessage | hookSpecificOutput.permissionDecision=deny | decision=block / 空 JSON |
| Claude Code | `.claude/settings.json` | JSON additionalContext | hookSpecificOutput.permissionDecision=deny | decision=block / 空 JSON |
| Grok | `.grok/hooks/governance.json` | 文本，延续本仓已有接线约定 | decision=deny | decision=block / 空 JSON |
| generic | 无客户端接线 | 手动 CLI 文本 | JSON，供调用方适配 | 手动 CLI |

Codex 格式按 [官方 Hooks 文档](https://learn.chatgpt.com/docs/hooks)核对（2026-09-26）。安装不等于非托管 hook 已获信任；新会话在 `/hooks` 审核并信任定义。
Claude/Grok 延续母版已存在的载体协议；本轮自动化只证明脚本与静态接线，真实客户端仍需现场验活。

## compact 与收尾

- SessionStart matcher 含 `compact`，压缩恢复时重新注入游标、五条决策和坐标；手动重放：`node scripts/governance.mjs session-start --compact --runtime codex`。
- 不另装 PreCompact 包装；显式 CLI 的 compact 分支也可供支持的运行时调用。Codex `PreCompact` 与 SessionStart 的输出合同不同，不能把一个事件名套给另一个。
- Stop 按会话保存在 Git 工作树本地元数据中的基线比较变化；不跨 worktree 共用票据，不运行 lint/业务测试。
- 没有基线时用当前 dirty 状态保守提示；`stop_hook_active` 与一次提醒状态防循环。游标内容充分性仍由独立前向考试验证。

## 字符串防线边界

保留连接符分段、路径前缀/引号归一化与 shell wrapper 正反例；只有五类危险命令。
保护路径仅判断 Edit/Write/MultiEdit/patch 实际目标及常见 shell 写入目标，文档内容提及、读取或 commit message 不应误拦。
它不是完整 shell parser；解释器写文件、动态命令替换、运行时未覆盖的工具仍要靠项目权限和原有提交/CI 门。
自检验证选中工具的 SessionStart、PreToolUse、Stop 及 matcher，不能证明客户端已经加载这些配置。

## v4 兼容

各 adapter.json 和 files/ 保留旧安装接口，仅由 init-v4/doctor-v4 与显式 Standard/High Assurance 使用；新 Lite 不读取它们。
旧 Common/Standard 模板保留 admission、需求、发现等原行为，供存量恢复和原回归测试；不作为新方法论正本、不向 Lite 自动回灌。
