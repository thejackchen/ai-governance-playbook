# 治理编译、版本升级与开机自检

> 给负责人和消费项目：远端保存通用母版，项目仓保存结合自身事实后的治理实例。

## 线上正本

GitHub 默认分支的 `VERSION` 标记当前通用母版：

https://github.com/thejackchen/ai-governance-playbook

消费仓的 `governance.lock.json` 记录实际采用的版本、kit 指纹和确定性适配结果。版本号相同不等于接线有效。

## 开机流程

Session Start 只做一次以下流程，不在每轮对话或每次工具调用时打网：

1. 拉取并核对远端 `VERSION`；
2. 把母版载体分成项目所有、playbook 管理、已知旧接线、未知定制四类；
3. 保留项目宪法、游标、业务文档和 policy，更新 playbook 管理的薄适配器，窄迁移能够证明等价的旧接线；
4. 输出结构化适配报告。未知定制返回 `needs_human_decision`，不做半套迁移；
5. Codex JSON 适配器检查 lock、权威入口、Session Start/PreToolUse 接线和实际注入铭牌；
6. 通过后把短期施工许可写入 Git common dir。许可不进仓库、不跨项目复用。

写文件前，Codex PreToolUse 会验证许可。许可缺失、过期，或版本、宪法、关键接线变化时，写入 fail-closed；查看与诊断仍可继续。

## 哪些会自动改，哪些不会

- 自动更新：`session-start-codex.mjs`、`pre-tool-use-codex.mjs`、`boot-admission.mjs` 等 playbook 管理的薄运行时适配器。
- 窄迁移：明确指向旧共享入口的 Codex Session Start/PreToolUse，以及已知的缺失/`echo` PreCompact 插座。
- 只补不改：仓外正本索引等项目可继续定制的载体。
- 绝不自动覆盖：项目宪法、业务文档、ROADMAP/游标和项目 policy。
- 停手请负责人裁决：无法证明等价的自定义 Hook 或语义冲突。

这里的“不覆盖”只保护项目事实，不再把所有既有文件都当作不可升级。否则母版修了、项目线路仍旧，版本号会制造假对齐。

## 确定性与语义验收

确定性层验证版本、文件归属、接线、入口可读和载体活性。已冻结、可证明语义等价的迁移由 golden 反例测试覆盖；机器无法证明的项目定制进入内容语义门，按 `pass | block | needs_human_decision` 裁决。规则、I/O、模型和 golden 案例未满足 CORE §5 时，单次 LLM 判断没有自动改写或放行权。负责人拥有最终解释权。

## 手动升级与分享

```bash
node ~/working/ai-governance-playbook/scripts/upgrade.mjs --target . --write
```

远端未发布的本机新版本不会写入消费仓。离线时也不会猜测新版本；只有 lock 指纹证明当前项目来自同一份同版本 kit，才允许修复已知接线。

修改母版后必须提交并推送 GitHub；没推送，其他项目就拿不到。新项目按 `setup.md` 安装，存量项目运行上述升级命令并新开会话，确认出现 `✅ 开机自检`。
