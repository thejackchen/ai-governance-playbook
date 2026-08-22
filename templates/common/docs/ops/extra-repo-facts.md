# 仓外正本指引

> 这是 **仓外知识的核心页**，对标仓内的 `docs/index.md`。  
> 机器表是同目录 [extra-repo-facts.json](extra-repo-facts.json)：只写路径，不写秘密。  
> 仓内知识仍以 `docs/index.md` 为准；本页不管 Git 里已经能读到的文档。无仓外正本时保持 JSON `facts: []`。

## 双核

| 范围 | 核心页 | 机器强制 |
|---|---|---|
| 仓内 | `docs/index.md` | 没登记进索引 = 不存在 |
| 仓外 | 本页 + `extra-repo-facts.json` | 索引缺失/漏进秘密 = 提交失败；家目录文件缺失只警告 |

## 以后每个 AI 必须遵守

1. **先查索引，再碰文件。** 不要在仓内看起来完整的台账里止搜。
2. **正本未装载就停。** 报「正本未装载」，禁止用替身凑答案，禁止向负责人索要已经登记过的秘密。
3. **永不把仓外正文写进 Git、日志、回复。** SessionStart 只报路径和在/缺。
4. **共享秘密不进工具目录。** 禁止把跨工具、跨仓库都要用的凭据放进某个 coding agent 的家目录（例如 `~/.claude/`、`~/.grok/`）。
5. **新增或搬家先改索引。** 先在 JSON 登记，再创建或移动仓外文件。

## 目录规划

人级共享走 `~/.config/<域>/`，不跟任何 coding agent 姓。各工具自己的家目录只放那个工具的设置。项目本机宏放仓内 gitignore；主机运行时放该机配置目录。

## 维护

新增：查 JSON → 加 `id/class/paths/covers/doesNotCover/missing/presence` → 有替身就登记 `decoys`。  
搬家：新路径写在 `paths` 前面，读取端新路径优先。  
退役：改为 `local-optional`，写明可忽略的条件；不要删条目装成从没存在过。
