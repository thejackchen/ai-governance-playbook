# 最近决策与交接

- 2026-09-26 负责人批准 v5 Lite 一次裁决：退出许可/发现/升级/需求/账本常驻机制，保留低成本实际防线。
- 2026-09-26 Standard/High Assurance 作为显式 v4 兼容路径保留；历史账本和原行为测试保留，默认新装为 Lite。
- 2026-09-26 母版自装 codex,grok 两套实际已有工具接线；项目安装按 --tools 选择。
- 2026-09-26 不 push、不改 main、不写消费仓、不改 VERSION；冷启动考试由主控另行组织，未验不发版。

恢复：工作目录为本仓 git worktree，分支 feat/v5-lite；HEAD 以 git rev-parse 为准。
验证与替代断言：[施工审计](audits/v5-lite-implementation.md)。下一步更新文档并完成试装/事故重放。
