# v5 Lite 实现与替代覆盖（2026-09-26，Unreleased）

负责人一次裁决：本轮只在 feat/v5-lite 母版施工，不写消费仓，不发布、不改 VERSION。冷启动理解考试由主控组织，不能以本报告替代。

## 解锁链

| 旧断言/门防什么 | 替代行为与正反证据 |
|---|---|
| installedFiles 每件存在，防安装缺件 | 历史条目不再有强制力；测试加入不存在的已退休条目必须通过，删除实际采用的 Stop 必须失败 |
| root/template 字节一致，防自托管漂移 | 全部源文件语法验证；本仓实际 hook 无许可可读写，危险 reset 仍阻断；安装行为继续经集成测试覆盖 |
| CORE LLM 五条件固定句式，防建议变成硬门 | 检查 deterministic 独立执行、AI job 只读且 continue-on-error；实现补齐此前未机器落实的 advisory 性质 |
| CORE/registry R11、Grok 文字，防找错仓外正本 | 空仓外索引实测报告 missing/error，不能声称装载成功；v5 改为宪法路径表与正本缺失行为测试 |
| CORE/registry R13 字样与脚本名，防压缩丢坐标 | 实际运行坐标收集，断言 repo/HEAD，/tmp 为临时目录、持久目录不误告警 |
| CORE/registry R14、integrationLine 文句，防公共线漏接 | 负责人明确撤销公共线门；普通工作无票据可执行，危险连接符命令依然拦截；v4 原行为测试保留在兼容路径 |

Standard/High Assurance 的旧接口继续作为 v4 兼容安装路径验证；Lite 的新行为使用独立正反测试。不是以删除旧测试冒充通过。

## 基线口径

bda4ce3，根 scripts 全部 .mjs（含当时放在 scripts 的测试）36 文件 / 5788 行；function check 声明 5 个（仅词法口径，不代表真实门数）。开工一次实测 1957.13 ms / 4984 bytes。最终增加同口径、项目安装面和稳定多次开工中位数。

## 分类拆除

- 许可层：删除母版 runtime 的三份 admission 实现，v4 兼容模板保留供存量恢复；原安装/许可正反测试显式走 init-v4/doctor-v4，断言不变。母版自己不发许可。默认入口在拆除阶段暂时桥接 v4，单脚本施工提交切换到新 lite；不把中间提交称为已完成的 v5 安装器。
- 项目发现：本仓 SessionStart 和默认 verify 停止加载 catalog/docs-index/discovery-map；母版 CLI 与库保留为按需工具，project-discovery 正反测试不删，v4 接线测试显式验证旧合同。新 Lite 不复制它们。
- 语义升级：母版开工不再调用 governance-update，不 fetch、不联网；保留母版显式 CLI 及离线/超时/不覆盖项目事实的原正反测试。旧自动注入只留 v4 兼容模板。
- 需求系统：母版 lint 删除需求段，删除根 requirements-check；真实历史需求不删。9 个需求正反测试迁到 tests/requirements-v4，仍对兼容模板执行；消费项目的需求权威不再被通用模板强制改写。
- 认领/登记/周报：停掉母版开工公告、claim/integration/Grok harness 判定与定时 heartbeat，registry 历史数据保留且停写；v4 专项正反测试继续保护兼容路径。危险命令和目标路径判断原实现保持在岗，直到下一刀合并。
- 仓外正本/空模板/判例：本仓取消 extra-repo-facts 库与开工加载，正本路径表进入 AGENTS；历史数据与 34 篇母版判例保留，索引按实际文件重建。空 ADR/architecture、判例安装只留显式 v4 路径，新 Lite 不携带；原仓外路径与 integration 库正反测试仍执行 v4 库。

## 单脚本 Lite

- 新默认只复制 Lite 文本、一个 governance.mjs 和实际工具接线；双工具 12 文件目标由安装测试验证。
- 三包装与各 hook 合并；compact 走 SessionStart source=compact，Stop 不执行检查。
- 以暂存区 blob 判断绝对软链，工作树换成安全链不能掩盖将提交的坏链。真实 gitleaks 扫描可提交的工作树文件和暂存内容（Git 忽略的本地凭据不误拦），缺失/异常均失败。
- 保留 standalone 母版 doctor/lint/verify 作为 CLI 别名与工程编排，不复制到项目；v4 兼容测试不删。
- 根包版本与 VERSION 仍为 4.3.0，schemaVersion=2 的 Lite 铭牌是候选实现采用记录，不代表 v5 已发布。

- 时区回归：本地 2026-09-26 / UTC 2026-09-25 的真实验证抓到日期误拦；安装日期改用本地日历，游标未来日期仅允许跨时区一天容差，过旧和远未来仍失败。

- 三条复核回归先实际失败再修复：同日追加决策取最新五条；Stop 放行后为下一轮变更更新基线；Codex features 之外的 hooks=true 不能掩盖禁用。这些没有依赖 mock 或放宽断言。
