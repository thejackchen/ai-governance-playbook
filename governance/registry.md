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
| R12 | 治理母版须经项目 AI 语义适配 | S1/S2 | session/upgrade | 新版已发布、适配证据缺失、项目验证失败或真实权威冲突 | warn/task/record | SessionStart + `scripts/governance-update.mjs` + 项目验证器 + 独立语义验收 | 模板是语义建议；项目自主采用/等价实现/说明不适用；不盲覆盖、不只改版本、不逐仓等人工指定；只无法解决的真实冲突交负责人；已有运行时门按项目合同保留 | REQ-GOV-004 负责人纠偏；版本已前移但语义/接线未变的假对齐；v4.2.0 将禁止脚本覆盖误解为禁止自主适配 |
| R13 | 压缩前必须注入可恢复坐标 | S1 | compact | PreCompact 缺失、仍是 echo、或未注入目录/分支/HEAD | warn/record | PreCompact + `pre-compact.mjs` | 不自动提交、不阻断压缩、不回收 worktree；Codex `decision:block` 不可靠 | 2026-08-23 AIOS Codex 压缩后把 /tmp 当消失、回退到旧 commit；macOS 重启清空 /tmp；Stop 自动删 worktree 已有反例 |
| R14 | 眼前这份必须含有公共线 | S1/S4 | session/action | 正在改的这份落后 `integrationLine` 仍写代码 | block/warn | SessionStart 人话 + PreToolUse + `scripts/lib/integration-line.mjs` | 落后 0 即使在旁支也可写；只拦写文件不拦测试；救火认领、合入公共线、文档入箱可过；不要求改分支名；不自动 merge/push | 2026-08-24 AIOS 8 天没先并后推；2026-07-17 开工对账判例载体下沉 |
| R15 | 开机自检通过才允许施工 | S1/S3/S4 | session/action | 项目验证失败、任一运行时未经正确适配器注入、受管事件含额外 Hook、许可缺失/过期、版本或关键治理载体变化 | block | universal admission + 三运行时 SessionStart/PreToolUse adapters + 项目验证器 | Codex/Claude/Grok 共用项目级许可；治理控制面始终需认领；读与诊断放行；许可不进 git、不跨项目复用 | 2026-08-26 v3.6.1 假发证与 v3.7.2 Grok 施工面无许可两次零上下文验收 |
| R16 | 项目发现只投影已声明事实 | S1/S3 | session/manual/commit | catalog、入口、凭据ID或显式范围缺失/无效，或把未声明范围当作全量覆盖 | block/warn | `project-catalog`/`discovery-map`/`catalog-search` + `governance-verify --fast` | 未配置就报告未配置；省略 `sourceRoots`/工作线时保持 unknown；地图不读凭据正文；项目资产留本地 | REQ-GOV-004；项目发现能力退出或被更强事实索引取代时复审 |
| R17 | 可选文件安装必须显式且可回滚 | S2/S4 | manual/action | 选择直接安装工具时未选能力、请求 `full`、目标/来源脏或未登记定制，或验证失败后仍写入采用状态 | block | `scripts/upgrade.mjs --capability discovery --write` + capability contract test | 默认只读；仅安装 8 个 discovery 文件；不改 base version/admission/Hook/policy/项目事实；失败整批回滚；`file-install-only` 不等于语义采用；本规则不要求项目 AI 适配前逐能力请求授权 | REQ-GOV-004；禁止脚本覆盖与自主语义适配分开；文件安装接口变化时复审 |
