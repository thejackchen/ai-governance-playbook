# 认领门（Claim Gate）合同

## 为什么有这道门

认领门把「先登记，再执行」变成机器强制：AI 在写行为代码或派发 `codex exec` 前，必须在跨 worktree 可见的认领公告板上留下结构化记录。它解决的是多人/多 session 并发时意图不能传递、工作范围彼此不可见和代码改动不可安全收口的问题；纯文档工作和明确的救火通道仍有清晰路径。

认领文件统一存放在：

```text
$(git rev-parse --git-common-dir)/governance-claims/<claimId>.json
```

每个文件独立保存，使用临时文件加原子 `rename` 写入，并以 `0600` 权限创建。目录按 Git common dir 定位，因此同一仓库的不同 worktree 可以看到同一块公告板。

## 默认策略与记录 schema

默认行为代码范围是 `src/` 和 `scripts/`；`.md`、`docs/**`、锁文件、生成文件和 `node_modules` 豁免。默认 Bash 触发模式是 `codex exec` 与带 `--prompt-file` 的 Grok harness。项目可在 `governance/policy.json` 的 `claimGate` 中浅覆盖 `codeRoots`、`exemptPatterns` 和 `bashClaimPatterns`，不需要修改脚本：

```json
{
  "claimGate": {
    "codeRoots": ["src/", "scripts/"],
    "exemptPatterns": ["\\.md$", "^docs/"],
    "bashClaimPatterns": ["\\bcodex\\s+exec\\b", "\\bgrok\\b[^\\n]*--prompt-file(?:=|\\s)"]
  }
}
```

每条记录包含以下字段：

| 字段 | 含义 |
| --- | --- |
| `claimId` | 8 位随机小写 hex，文件名必须与它一致。 |
| `line` | 业务线 slug；也可为 `cross` 表示跨线。`open` 时必须对应存在的文档；救火模式可为 `null`。 |
| `docRef` | 普通 line 为 `docs/execution/branches/<slug>.md`；`cross` 固定落到保证随安装存在的 `docs/index.md`；无 line 时为 `null`。 |
| `docBaseline` | 对 `docRef` 执行 `git hash-object` 得到的基线 hash；无 line 时为 `null`。 |
| `task` | 一句话说明本次要做什么；救火模式可为空字符串。 |
| `acceptance` | 一句话说明怎么验收；救火模式可为空字符串。 |
| `nonGoals` | 本次明确不碰的范围。 |
| `scope` | 至少一个路径前缀组成的数组。 |
| `worktree` | `git rev-parse --show-toplevel` 后再 `realpath` 归一化的 worktree 根。 |
| `session` | `--session` 优先，其次 `GOVERNANCE_SESSION_ID`、工具厂商 session 变量；都没有时为 `null`。 |
| `agent` | `claude`、`codex` 或 `unknown`。 |
| `status` | 初始为 `active`；收口时为 `closed`、`continued` 或 `abandoned`。当前有效状态是 `active` 和 `continued`。 |
| `mode` | `normal` 或 `emergency`。 |
| `incidentRef` | 救火原因或事故引用；普通模式为 `null`。 |
| `createdAt` / `updatedAt` | ISO 时间戳；close 等写操作只更新 `updatedAt`。 |

普通认领是弱 session fencing：只有认领和当前 session 都非空且不相等时才不兼容，任一方为空都兼容。`emergency` 更严格，必须两边都有 session 且相等；这是特权救火通道，不是日常路径。

单线/全新项目在尚未分裂出 `docs/execution/branches/<slug>.md` 之前，`open` 必须使用 `--line cross`，这是常态而不是特殊降级；认领会落到 `docs/index.md`。只有项目确实按 CORE.md §2.5 分裂出对应的分支文件后，才切换到具体 slug。

## CLI

所有子命令都支持 `--json`，不带时输出适合人阅读的文本。

### 开普通认领

```bash
node scripts/claim.mjs open \
  --line feature-x \
  --task "实现功能 X" \
  --accept "目标测试和回读通过" \
  --non-goals "不改生产数据" \
  --scope "src/,scripts/" \
  --session "$GOVERNANCE_SESSION_ID" \
  --agent codex
```

`--line`、`--task`、`--accept`、`--non-goals` 和至少一项 `--scope` 必填。普通 slug 找 `docs/execution/branches/<slug>.md`，`cross` 找 `docs/index.md`。同一 line 已有 active 认领时只播报，不拒绝新的认领。

### 开救火认领

```bash
node scripts/claim.mjs emergency \
  --incident "认领账本损坏，需要先恢复门" \
  --scope "scripts/,governance/"
```

省略 line 时 `line`、`docRef`、`docBaseline` 都是 `null`；救火模式仍要求 incident 和 scope，且按严格 session fencing 处理。

### 查看、收口与清理

```bash
node scripts/claim.mjs list [--json]
node scripts/claim.mjs current [--json]
node scripts/claim.mjs close --id a1b2c3d4 [--status closed|continued|abandoned]
node scripts/claim.mjs prune --json
```

`list` 只展示所有 worktree 的记录并标记 orphan/stale，不删除文件。`current` 只接受当前 worktree、有效状态和 session 兼容的最新记录；账本不可读或 JSON 损坏时 fail-closed。`prune` 是唯一会删除文件的子命令，只清理超过 7 天的 `closed`/`abandoned` 记录。

### 提交前验证

```bash
node scripts/claim.mjs verify-commit [--json]
```

它用 `governance/policy.json` 的 `claimGate` 判断暂存区是否有行为代码改动。AI 环境中有命中改动时，当前 worktree 必须有 `active` 或 `continued` 认领；负责人手工提交不受这条门影响。

## PreToolUse 如何拦截

PreToolUse 只对两类动作增加认领判定：

1. `Edit`、`Write`、`apply_patch` 写入默认 `codeRoots` 且不命中豁免正则的路径；拿不到目标路径时按命中处理。
2. Bash 命令候选段命中 `bashClaimPatterns`。

`Read`、`Grep`、普通 Bash、`docs/**` 和 Markdown 写入不会触发这条新增判定。路径以 stdin 中的 `cwd` 为起点解析，再归一化到当前 worktree 根；认领账本则以该 cwd 对应的 Git common dir 为准。

无有效认领时，hook 返回 `decision: "block"`，理由包含可复制的 `node scripts/claim.mjs open ...` 模板、所有 worktree 的 active line 播报和本文件指引。账本读取失败或有损坏 JSON 时同样 block，并给出最小 emergency JSON 恢复模板。

没有环境变量、命令行参数或配置项可以全局关闭认领门；代码中不提供跳过旁路。

认领门随 `standard` 和 `high-assurance` profile 安装；`lite` 不安装认领账本脚本，但共享 hook 会动态探测脚本缺失并跳过认领判定，不影响其它危险命令保护。
