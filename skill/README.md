# skill/ — playbook 技能入口目录

- `governance-bootstrap`：安装流程的薄入口封装，以 [setup.md](../setup.md)、[CORE.md](../CORE.md) 与 [CORE.md 附(运行时适配)](../CORE.md) 为权威，本目录只是调用壳（不在此复制流程，防止与仓库漂移）。`governance-bootstrap/agents/openai.yaml` 是其在 agent 平台的展示元数据。
- `pro-supervised-delivery`：高风险/高复杂度工作编排入口，承接 Pro+Codex 协作链路、证据包准备、交付分工与独立验收；该仓库为 playbook 正本，`~/.codex/skills` 只是安装实例，不承载新正本内容。
- `shoukou`：压缩、换工具或重启前把进度落到 durable 正本。机器侧 PreCompact 只检查+注入坐标；人说「收口」才提交。
- `governance-optimization`：治理架构减重与验效编排器——量化盘点→第一性判决（留/删/简化）→一次拍板→分批拆除→冷启动考试+减重不减防双测验效→沉淀回写。本仓为正本，`~/.claude/skills`、`~/.codex/skills` 只是安装实例。
