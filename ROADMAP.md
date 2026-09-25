# ai-governance-playbook Roadmap

> 当前状态唯一权威。历史版本与过程见 CHANGELOG、ADR 和审计。

## 当前游标

2026-09-26：v5.0.0 已在 feat/v5-lite 备齐本地发版内容；wechat-ai@ccf2079 首个项目实装与三名零上下文考生 99/100/99 的前向考试结果由负责人提供。两项实装反馈已修复：保留项目已有路线图并按实际路径生成指针；gitleaks 工作树扫描使用项目相对指纹并读取项目根豁免文件。版本文件、发版审计和自托管 kit 指纹同步；本仓检查 0 error、测试 191/191、CI 编排通过。本轮不 push、不合入 main，也未复验真实客户端 trust/Hook 生命周期；下一步由主控审查本地提交与验证结果，决定远端发布和消费项目后续采用。

## 硬约束

- 唯一方法论 CORE；运行时协议 adapters/README；安装唯一入口 BOOTSTRAP。
- 不删测试/放宽断言/伪造 mock 制造全绿，不把文件安装、本地检查和真实客户端/发布验收混为一谈。
- 不改 main、不 push、不写消费仓；本轮按负责人指令更新 VERSION 至 5.0.0，但本地版本不等于远端发布。

## 证据与下一步

| 项目 | 状态 | 正本 |
|---|---|---|
| 分类拆除与替代覆盖 | 已实现；每步通过自动验证才提交 | [施工审计](docs/audits/v5-lite-implementation.md) |
| 默认 Lite 与 v4 兼容 | 已实现 | [ADR-002](docs/decisions/002-lite-runtime.md) |
| 最终试装与事故重放 | 本地 8/8；原始计量已落盘 | [施工审计](docs/audits/v5-lite-implementation.md) |
| 独立无上下文前向考试 | 负责人提供 wechat-ai 结果 99/100/99；本仓未重跑 | [发版审计](docs/audits/v5-release.md) |
| 首个项目实装反馈 | 路线图重复与 gitleaks 豁免两处已修复；本仓首次全套 191/191 通过 | [发版审计](docs/audits/v5-release.md) |
| 真实客户端 trust/Hook | 本轮未验；静态配置不代证 | [运行时边界](adapters/README.md) |
