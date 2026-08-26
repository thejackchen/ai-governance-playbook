# 规则台账

> Profile预算：{{RULE_BUDGET}}条。规则必须写清触发、判定和效果；“写在AGENTS里”不是完整载体描述。

| ID | 规则 | 结构问题 | 触发 | 判定条件 | 效果 | 载体 | 绕过/证据 | 来源与死亡条件 |
|---|---|---|---|---|---|---|---|---|
| R1 | 不制造假全绿 | S3 | commit/merge | 测试配置或断言被规避 | block | review+CI | 变更diff/CI | 核心红线；项目终止时删除 |
| R2 | 不虚报完成 | S3 | session | 完成宣称缺少可复现证据 | warn/record | 自动指令+Stop | 最终报告 | 核心红线；项目终止时删除 |
| R3 | 危险命令保护 | S4 | action | 命中policy deny模式 | block | PreToolUse+Rules | Hook日志 | day-1底座；被更强权限取代时降级 |
| R4 | 治理结构可验证 | S1/S3 | commit/session/merge | doctor或lint失败 | block | pre-commit + Stop + CI(governance.yml) | 命令输出 | day-1底座；治理卸载时删除 |
| R11 | 仓外正本必须有仓内路径指针 | S1/S3 | session/commit | 索引缺失、schema 非法、索引含秘密 | block/warn | `docs/ops/extra-repo-facts.json` + SessionStart + governance-lint | 家目录文件缺失只 warn | 2026-08-23 仓外正本无指针被替身止搜；无仓外正本时可空列表 |
| R12 | 治理母版须编译成项目实例 | S1/S2 | session | lock 落后、项目验证失败、旧接线或未知定制冲突 | block/warn/record | SessionStart + playbook `scripts/upgrade.mjs` + 项目 `governance-verify --fast` | 项目事实不覆盖；热升级先 `restart_required`；未知定制停手 | 版本号不能替代项目适配结果 |
| R13 | 压缩前必须注入可恢复坐标 | S1 | compact | PreCompact 缺失或仍是 echo | warn/record | PreCompact + `pre-compact.mjs` | 不自动提交、不阻断压缩 | 2026-08-23 压缩后把 durable 路径当成 /tmp 已消失 |
| R15 | 开机自检通过才允许施工 | S1/S3/S4 | session/action | 项目验证失败、受管 Hook 不唯一、许可缺失/过期或关键治理载体变化 | block | 运行时 SessionStart + boot admission + PreToolUse adapter | 读与诊断放行；许可不进 git、不跨项目复用 | 门牌更新但线路仍旧的假对齐事故 |
