# {{PROJECT_NAME}} Roadmap

> 当前状态唯一权威。只保留当前投影；历史进入CHANGELOG和ADR。

## 当前游标

{{CURRENT_CURSOR}}

## 硬约束

| 约束 | 权威定义 | 自动守护 |
|---|---|---|
| {{CONSTRAINT}} | {{CONSTRAINT_SOURCE}} | {{CONSTRAINT_GUARD}} |

## 战线

> 战线 < 3：人手维护下方标记块内的表即可。战线 ≥ 3 且单表压不住叙事时，把每条战线毕业成 `docs/execution/branches/<slug>.md`（段式见 playbook 的分支模板 `_TEMPLATE.md`）各持「当前游标」；然后 `node scripts/governance-status.mjs --write` 会**自动删除本文件顶部的「## 当前游标」段**（单线遗留的第二正本）并用投影**覆盖**下方标记块（自此勿手改，改状态就改游标）。`--check` 是漂移门：投影漂移、**或分裂态下顶部单游标仍在**，都会退 1；已接进 `governance/policy.json`，`init` 已激活 `core.hooksPath` 使 pre-commit 本地 commit 即拦；CI 也会跑，须配 branch-protection/required-check 后才阻断合并。方法论见 playbook `CORE.md` §2.5。

<!-- governance-status:projection:start -->
| 战线 | 状态 | 当前里程碑 | 下一步 | 卡点 | 深度文档 |
|---|---|---|---|---|---|
| {{WORKSTREAM}} | 推进 | {{MILESTONE}} | {{NEXT_STEP}} | - | - |
<!-- governance-status:projection:end -->

> ↑ 单线（战线 < 3）时上表人手维护；分裂后 `--write` 会整体覆盖上面 start/end 之间的内容。
