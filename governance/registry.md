# 规则台账

> Profile预算：24条。规则必须写清触发、判定和效果；“写在AGENTS里”不是完整载体描述。

| ID | 规则 | 结构问题 | 触发 | 判定条件 | 效果 | 载体 | 绕过/证据 | 来源与死亡条件 |
|---|---|---|---|---|---|---|---|---|
| R1 | 不制造假全绿 | S3 | commit/merge | 测试配置或断言被规避 | block | review+CI | 变更diff/CI | 核心红线；项目终止时删除 |
| R2 | 不虚报完成 | S3 | session | 完成宣称缺少可复现证据 | warn/record | 自动指令+Stop | 最终报告 | 核心红线；项目终止时删除 |
| R3 | 危险命令保护 | S4 | action | 命中policy deny模式 | block | PreToolUse+Rules | Hook日志 | day-1底座；被更强权限取代时降级 |
| R4 | 治理结构可验证 | S1/S3 | session/merge | doctor或lint失败 | block | `.githooks/pre-commit` + `.github/workflows/governance.yml` + Stop hook | 命令输出 | day-1底座；治理卸载时删除 |
| R5 | 核心方法论只有一份 | S1/S2 | commit/merge | 适配器、Skill或模板出现独立核心原则 | block | contract测试+review | diff/CI | v2分叉风险；仓库终止时删除 |
| R6 | 适配器只承载运行时差异 | S1/S5 | commit/merge | adapter复制核心正文或引入供应商无关规则 | block | contract测试+review | diff/CI | 多运行时架构；只剩单运行时时复审 |
| R7 | 确定性门禁优先于AI审计 | S3/S4 | commit/merge | 可机器判定红线仅由LLM审计承载 | block | architecture review+CI | policy/工作流diff | 核心原则；出现更强等价载体时更新 |
| R8 | 发布需要自动与无上下文验证 | S1/S3 | manual/merge | 新版本缺少脚本测试或前向测试证据 | approval/block | 发布review+CI | 测试日志/`docs/evals/` | v3发布要求；评估机制变化时复审 |
| R9 | 凭据忽略规则覆盖派生形态 | S4 | commit/lint | `.env.local.bak/.old/.save/~` 等派生名未被 `git check-ignore` 挡住 | block | governance-lint | check-ignore 退出码 | 2026-07-25 六仓实测四漏(含本仓)；凭据不再以文件形式存在时删除 |
| R10 | 提交要真到远端 | S3 | commit/lint | `rev-list <remote>/HEAD..HEAD` 非零,或本仓无任何远端 | warn | governance-lint | rev-list 计数 | 2026-07-25 执行者把 CI 临时仓 push 输出当真推送(6 提交未出去)；全流程强制推送后删除 |
| R11 | 仓外正本必须有仓内路径指针 | S1/S3 | session/commit | 索引缺失、schema 非法、索引含秘密，或 SessionStart 未播报仓外正本 | block/warn | `docs/ops/extra-repo-facts.json` + SessionStart + governance-lint | 命令输出；家目录文件缺失只 warn | 2026-08-23 AIOS Demo 人名对照在家目录，其它 AI 拿 tenants.json 止搜；无仓外正本的项目可空列表；索引被密钥文件替代时删除 |
| R12 | 治理版本以 GitHub 为正本 | S1 | session | 本仓 lock 落后线上 VERSION | warn/record | SessionStart + `scripts/upgrade.mjs` | 只补缺失载体，不覆盖项目事实；失败不阻断开工 | 2026-08-23 要把最佳实践放到 GitHub；消费软件式开机检查；未发布 kit 不得写入消费仓 lock |
