# skill/ — playbook 技能入口目录

- `governance-bootstrap`：安装流程的薄入口封装，以 [setup.md](../setup.md)、[CORE.md](../CORE.md) 与 [CORE.md 附(运行时适配)](../CORE.md) 为权威，本目录只是调用壳（不在此复制流程，防止与仓库漂移）。`governance-bootstrap/agents/openai.yaml` 是其在 agent 平台的展示元数据。
- `pro-supervised-delivery`：高风险/高复杂度工作编排入口，承接 Pro+Codex 协作链路、证据包准备、交付分工与独立验收；该仓库为 playbook 正本，`~/.codex/skills` 只是安装实例，不承载新正本内容。
