# 仓库结构地图

新增顶层目录或跨层依赖先写 ADR。本轮没有新增顶层目录。

| 路径 | 职责与边界 |
|---|---|
| CORE.md | 唯一核心方法论；不承载运行时协议细节 |
| BOOTSTRAP.md | 唯一安装、迁移、验收入口 |
| adapters/ | 运行时协议说明；files 与 manifest 为 v4 兼容配置 |
| profiles/ | Lite 默认；Standard/High Assurance 显式 v4 兼容 |
| templates/lite/ | 新项目短入口和状态模板；不预造空业务制度 |
| templates/common、standard、standard-codex、high-assurance | v4 接口兼容源，旧行为只在此路径安装 |
| scripts/governance.mjs | 唯一复制到 Lite 项目的治理代码；四个子命令 |
| scripts/ 其余文件 | 母版安装/验收/按需命令；init-v4/doctor-v4 为兼容入口 |
| tests/ | 新行为、事故重放和兼容测试；不以测试数量替代效力 |
| docs/ | 当前路由、真实规格、历史审计/决策/评估，临时产物不进根目录 |
| governance/ | 母版 policy、历史事故/账本、按需判例；历史数据不删除 |
| extensions/、skill/ | 按需领域扩展与薄流程入口，不复制核心方法论 |
| .codex、.grok、.githooks、.github | 母版自托管、项目工程门和 CI；客户端 trust 需现场确认 |

临时试装、日志、计量产物放 /tmp；最终证据归 docs/audits 或 docs/evals，并进入索引。
