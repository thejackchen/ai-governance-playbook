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
5. 母版通用层核对版本、kit 指纹和受管载体；项目自己的 `scripts/governance-verify.mjs --fast` 解释项目目录与领域规则；
6. 统一 admission 适配器检查权威入口、实际注入铭牌，并要求 Codex、Claude Code、Grok 的 Session Start/PreToolUse 各只有一条精确受管接线；Codex JSON 层只包装同源文本；
7. 两层都通过后才把短期施工许可写入 Git common dir。许可不进仓库、不跨项目复用。

写文件前，三个运行时的 PreToolUse 都验证同一张项目级许可。许可缺失、过期，或三套 Hook、统一许可适配器、共享启动/动作脚本、policy、index、项目验证器等关键载体变化时，写入 fail-closed；查看与诊断仍可继续。治理控制面还必须有认领，不能借 `.md` 或目录豁免拆门。

运行时适配器在一次 Session Start 里被升级时，当前进程仍可能装着旧代码。因此升级器先把 lock 标成 `restart_required`，本会话不发证；下一次 Session Start 由新适配器复验通过后才转为 `pass`。未知定制和项目验证失败分别记为 `needs_human_decision` / `failed`，不能藏在日志首行后继续施工。

## 哪些会自动改，哪些不会

- 自动更新：`session-start-admission.mjs`、`pre-tool-use-admission.mjs`、Codex JSON 薄适配器和 `boot-admission.mjs` 等 playbook 管理的运行时协议层。
- 窄迁移：明确指向旧共享入口的 Codex/Claude Code/Grok Session Start/PreToolUse，以及已知的缺失/`echo` PreCompact 插座。
- 只补不改：仓外正本索引等项目可继续定制的载体。
- 绝不自动覆盖：项目宪法、业务文档、ROADMAP/游标和项目 policy。
- 停手请负责人裁决：无法证明等价的自定义 Hook 或语义冲突。

这里的“不覆盖”只保护项目事实，不再把所有既有文件都当作不可升级。否则母版修了、项目线路仍旧，版本号会制造假对齐。

## 确定性与语义验收

确定性层验证版本、文件归属、接线、入口可读和载体活性。母版 doctor 不用通用目录假设解释消费项目；它调用项目验证器形成第二层。已冻结、可证明语义等价的迁移由 golden 反例测试覆盖；机器无法证明的项目定制进入内容语义门，按 `pass | block | needs_human_decision` 裁决。规则、I/O、模型和 golden 案例未满足 CORE §5 时，单次 LLM 判断没有自动改写或放行权。负责人拥有最终解释权。

## 手动升级与分享

```bash
node ~/working/ai-governance-playbook/scripts/upgrade.mjs --target . --write
```

远端未发布的本机新版本不会写入消费仓。离线时也不会猜测新版本；只有 lock 指纹证明当前项目来自同一份同版本 kit，才允许修复已知接线。

修改母版后必须提交并推送 GitHub；没推送，其他项目就拿不到。新项目按 `setup.md` 安装，存量项目运行上述升级命令并新开会话，确认出现 `✅ 开机自检`。
