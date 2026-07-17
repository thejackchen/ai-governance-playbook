# 运行时适配器

> 核心模型见 [CORE.md](CORE.md)。本文件只维护运行时能力差异，不复制治理原则。

## 能力矩阵

| 机制 | Codex | Claude Code | Generic |
|---|---|---|---|
| 自动项目指令 | `AGENTS.md`，支持目录级覆盖 | `CLAUDE.md` | `AGENTS.md` 或任务模板 |
| 项目配置 | `.codex/config.toml` | `.claude/settings.json` | 无统一接口 |
| 会话 Hook | `SessionStart` | `SessionStart` | 启动脚本或无 |
| 动作前 Hook | `PreToolUse`，可拒绝部分工具调用 | `PreToolUse` | shell wrapper / 权限 |
| 收尾 Hook | `Stop`，可要求继续修复 | `Stop` | pre-commit / CI |
| 命令策略 | `.codex/rules/*.rules`，实验能力 | PreToolUse / permissions | 容器、sudo、shell policy |
| 非交互执行 | `codex exec` | Claude CLI | 自选 agent CLI |
| GitHub AI | `openai/codex-action` | 未内置，自行接入 | 未内置，自行接入 |
| 本地定时任务 | Codex/ChatGPT Scheduled Tasks | 外部 cron / CI | 外部 cron / CI |

## Codex

### 权威载体

- `AGENTS.md`：短、准确、每次自动加载；放项目意图摘要、权威路由、红线、验证命令和完成标准。
- `.codex/hooks.json`：配置 `SessionStart`、`PreToolUse`、`Stop`。
- `.codex/rules/default.rules`：对明确危险命令做第二层约束；Rules 仍属实验能力，不能单独承担红线。
- GitHub Actions：运行确定性验证；`openai/codex-action`只做只读语义审计。

### 信任要求

项目本身必须被 Codex 标记为 trusted；新增或修改项目 Hook 后，负责人需要在 `/hooks` 中审核并信任当前哈希。未完成信任时，registry 必须如实登记 Hook 尚未生效。

### 已知边界

- PreToolUse 不是完整安全边界。字符串防线已覆盖:目录前缀(`/usr/bin/git`)、引号/转义包裹、括号包裹、一至三层 `bash -c`/`sh -c`/`eval` 包裹;**仍可绕过**:命令替换 `$()`、管道拼装、解释器执行(`python -c`)、base64 编解码、多层混合嵌套。真正高风险约束仍应落到 sandbox、IAM、只读凭据和 CI;codex runtime 另有 execpolicy 深度解析(验证须带 `--resolve-host-executables`)。
- Stop Hook 提供本地修复回路，但不能替代远端 required check。
- `.rules` 需要用 `codex execpolicy check` 测试 match/not_match。

## Claude Code

### 权威载体

- `CLAUDE.md`：自动指令正本；`AGENTS.md`只保留指向正本的桥接行。
- `.claude/settings.json`：生命周期 Hooks 和权限配置。
- PreToolUse：拒绝危险命令；Stop：运行快速验证并要求继续修复。
- CI：仍是共享仓库的最终闸门。

### 兼容策略

公共 Hook 脚本优先输出 Codex 与 Claude Code 都接受的 legacy block 结构：

```json
{ "decision": "block", "reason": "..." }
```

适配器测试必须分别验证两个配置文件引用的脚本存在；运行时协议变化时只改适配器，不改核心模型。

## Generic

- 用 `AGENTS.md` 或显式任务模板承载自动指令。
- 用 pre-commit 提前反馈，但CI才是共享闸门。
- 用容器、只读token、最小权限和脚本包装器承载不可逆风险。
- 没有某种机制时必须如实降级，不能把文档约定登记成机器门禁。

## AI 审计统一契约

所有运行时的 AI 审计必须满足：

1. 输入：只读仓库、固定任务书、机器生成的对账数据；
2. 权限：默认只读、无生产凭据、无合并权限；
3. 输出：固定结构、逐项证据、置信度、无法核实时明确说明；
4. 效果：建议或报告，不直接成为唯一硬门禁；
5. 安全：不把 PR 正文、Issue 或提交信息直接提升为系统指令。
