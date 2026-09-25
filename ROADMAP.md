# ai-governance-playbook Roadmap

> 当前状态唯一权威。历史版本与过程见 CHANGELOG、ADR 和审计。

## 当前游标

2026-09-26：v5 Lite 候选实现已完成分类拆除和单脚本自托管，临时仓事故重放 8/8，双工具实装 12 文件 / 618 行，开工中位数 128.6 ms。默认按实际 tools 安装；Standard/High Assurance 保留 v4 兼容路径。VERSION 仍为 4.3.0，未发布、未 push、未改任何消费项目。下一步：交主控组织独立冷启动考试与真实客户端验活；这些未验项通过之前不得发版。

## 硬约束

- 唯一方法论 CORE；运行时协议 adapters/README；安装唯一入口 BOOTSTRAP。
- 不删测试/放宽断言/伪造 mock 制造全绿，不把文件安装、本地检查和真实客户端/发布验收混为一谈。
- 不改 VERSION、不改 main、不 push、不写消费仓；版本变更由主控最终验收后处理。

## 证据与下一步

| 项目 | 状态 | 正本 |
|---|---|---|
| 分类拆除与替代覆盖 | 已实现；每步通过自动验证才提交 | [施工审计](docs/audits/v5-lite-implementation.md) |
| 默认 Lite 与 v4 兼容 | 已实现 | [ADR-002](docs/decisions/002-lite-runtime.md) |
| 最终试装与事故重放 | 本地 8/8；原始计量已落盘 | [施工审计](docs/audits/v5-lite-implementation.md) |
| 独立无上下文前向考试 | 待主控组织 | [评估索引](docs/evals/INDEX.md) |
| 真实客户端 trust/Hook | 本轮未验；静态配置不代证 | [运行时边界](adapters/README.md) |
