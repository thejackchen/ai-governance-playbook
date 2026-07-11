# 规则台账

> Profile预算：24条。规则必须写清触发、判定和效果；“写在AGENTS里”不是完整载体描述。

| ID | 规则 | 结构问题 | 触发 | 判定条件 | 效果 | 载体 | 绕过/证据 | 来源与死亡条件 |
|---|---|---|---|---|---|---|---|---|
| R1 | 不制造假全绿 | S3 | commit/merge | 测试配置或断言被规避 | block | review+CI | 变更diff/CI | 核心红线；项目终止时删除 |
| R2 | 不虚报完成 | S3 | session | 完成宣称缺少可复现证据 | warn/record | 自动指令+Stop | 最终报告 | 核心红线；项目终止时删除 |
| R3 | 危险命令保护 | S4 | action | 命中policy deny模式 | block | PreToolUse+Rules | Hook日志 | day-1底座；被更强权限取代时降级 |
| R4 | 治理结构可验证 | S1/S3 | session/merge | doctor或lint失败 | block | Stop+CI | 命令输出 | day-1底座；治理卸载时删除 |
| R5 | 核心方法论只有一份 | S1/S2 | commit/merge | 适配器、Skill或模板出现独立核心原则 | block | contract测试+review | diff/CI | v2分叉风险；仓库终止时删除 |
| R6 | 适配器只承载运行时差异 | S1/S5 | commit/merge | adapter复制核心正文或引入供应商无关规则 | block | contract测试+review | diff/CI | 多运行时架构；只剩单运行时时复审 |
| R7 | 确定性门禁优先于AI审计 | S3/S4 | commit/merge | 可机器判定红线仅由LLM审计承载 | block | architecture review+CI | policy/工作流diff | 核心原则；出现更强等价载体时更新 |
| R8 | 发布需要自动与无上下文验证 | S1/S3 | manual/merge | 新版本缺少脚本测试或前向测试证据 | approval/block | 发布review+CI | 测试日志/`docs/evals/` | v3发布要求；评估机制变化时复审 |
