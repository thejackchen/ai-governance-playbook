---
name: governance-bootstrap
description: 为新项目安装或为存量项目迁移AI治理。用于建立治理、对齐治理、升级治理载体、安装Codex或Claude Code Hooks/CI、审计旧规则、选择Lite/Standard/High Assurance Profile，以及使用ai-governance-playbook验证治理闭环。
---

# Governance Bootstrap

以本仓库为唯一流程权威，不在skill内复制安装细节。

1. 读取仓库当前`setup.md`、`CORE.md`和`CORE.md 附(运行时适配)`。
2. 探测runtime、存量/新项目、风险、协作和前端扩展；选择最小Profile。
3. 存量项目先按`setup.md 附A(存量迁移)`逐条审计旧内容。
4. 先运行`node scripts/init.mjs ...` dry-run，确认后加`--write`。
5. 填写项目事实，启用并测试运行时Hooks/Rules/CI。
6. 运行`node scripts/doctor.mjs --target <project>`并按`setup.md 附B(验收自检)`验收。
7. 用无上下文AI执行真实案例；失败时修载体或判据，不泄露预期答案。
8. 交付runtime/Profile、载体表、未安装项、验证证据和仍可绕过边界。

保持skill简短；所有模板、命令和规则以仓库现读内容为准。
