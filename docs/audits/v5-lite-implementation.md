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
