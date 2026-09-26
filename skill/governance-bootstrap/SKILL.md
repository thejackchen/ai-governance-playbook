---
name: governance-bootstrap
description: 为新项目安装或为存量项目迁移AI治理。用于建立治理、对齐治理、升级治理载体、安装Codex或Claude Code Hooks/CI、审计旧规则、选择Lite/Standard/High Assurance Profile，以及使用ai-governance-playbook验证治理闭环。
---

# 治理安装薄入口

1. 读取母版 BOOTSTRAP.md 和 CORE.md，按任务查看 adapters/README.md。
2. 新装默认 Lite，确认实际工具后用 --tools 生成只读计划，明确写入范围再 --write。
3. 存量保留真实意图和 WIP，按 BOOTSTRAP 三步迁移，不用模板重置事实。
4. 运行真实自检、项目原测试、客户端正反探针和独立无上下文考试；缺 gitleaks 即失败。
5. 分别说明文件、自检、真实 hook、业务和发布证据；未验不代证。

本 Skill 不复制方法论，具体命令与验收只在 BOOTSTRAP。
