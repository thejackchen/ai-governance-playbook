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

## 文句合同替代明细

| 原 discovery-docs-contract 测试防什么 | 新行为覆盖 |
|---|---|
| CORE 7.2 固定句式防联网发现误当已采用 | 显式母版 --offline 返回 unknown，项目 intent/WIP/铭牌与文件集合不变；原语义发现错误/超时正反测试继续执行 |
| setup 升级措辞防无范围写入、无回滚 | 实际 --write 缺 capability 必须非零、目标不变；原 explicit-upgrade 测试继续验证脏树、定制、回滚与验收 |
| README/模板长句防盲复制事实 | 实际 Lite 安装保留 knowledge/requirements 原文，且不预造需求/catalog/registry |
| discovery 合同八域文字防猜覆盖 | 实际未配置 catalog 明确报未配置，配置不存在的源码根必须失败；原检索/范围负例保留 |
| 模板发现链接断言防死链 | 当前六份入口文档的真实相对链接必须存在，setup 必须已合并退出；v4 模板安装用旧集成测试继续覆盖 |
| registry R16/R17 文句防投影变成新正本 | registry 已退休；母版判例索引与实际案例文件逐一对应，避免手写旧数字；投影/只读/回滚实测仍留在 project-discovery 与 explicit-upgrade 套件 |

以上六项均替换成可观察行为或实际导航检查；没有删除旧功能实现的正反回归来求绿。

## 验效复核修正

- CORE 保留负责人原定的“真相在文本、行动跟文本、底线在机器”；压缩段落不更换核心原则。
- 新增两条先红后绿的回归：非 Git/仓库子目录安装必须在写文件前拒绝；Codex PreToolUse 缺 exec_command 覆盖必须失败。实际安装、真实客户端识别与检查必须指向同一个仓库根。

## 最终本地验效

可复跑入口：`node scripts/evaluate-lite.mjs`，仅在它新建的 `/tmp/governance-lite-eval-*` 仓库内制造和清理负例；不写消费项目。真实 gitleaks 版本 8.30.1。机器原始记录见 [v5-lite-metrics.json](v5-lite-metrics.json)，包括每个安装文件行数、全部采样和临时仓坐标。

| 指标 | bda4ce3 v4 Lite | bda4ce3 v4 Standard | v5 Lite 双工具 | v5 Lite 三工具 |
|---|---:|---:|---:|---:|
| 实际安装文件 | 49 | 57 | 12 | 13 |
| 安装总行数（含空行） | 4345 | 5259 | 618 | 658 |
| 项目治理代码文件 | 26 | 28 | 1 | 1 |
| 项目治理代码行数 | 3526 | 4202 | 449 | 449 |
| 门数代理指标：`function check` 声明 | 4 | 4 | 1 | 1 |
| 实际接线开工中位数 ms（5 次） | 1616.51 | 1416.64 | 128.6 | 128.93 |
| 开工上下文字节（末次） | 1005 | 1128 | 374 | 374 |

双工具=claude-code,codex；三工具额外 grok。v4 即使只选 Codex 也默认装三工具；两份旧档均由 bda4ce3 导出母版实装。计数排除 .git；计时均在首次提交前调用实际接线指向的 Codex 入口，不绕开 v4 许可包装，不禁用其线上发现。v4 首次联网存在波动，故保存所有样本并用中位数；此结果是本机 CLI 耗时，不是客户端 UI 耗时。

初始基线里的 801.07/776.44 ms 是 v4 共享内层 session-start 的三次中位数；原始 JSON 仍保留。最终表改用外层实际接线口径，避免省略原有许可层成本。新开工无网络，原许可、地图、fetch 和认领建议不再强制注入。

| 母版与文档指标 | 前 | 后 |
|---|---:|---:|
| 根 scripts 下全部 .mjs 文件 / 行数 | 36 / 5788 | 25 / 4231 |
| 同路径排除测试的代码行数 | 5689 | 4231 |
| 同路径 `function check` 声明 | 5 | 3 |
| 根 AGENTS 行数 | 59 | 43 |
| CORE 行数 | 408 | 64 |
| 安装入口总行数 | 561（两个入口） | 64（一个入口） |
| 母版 registry 历史数据行 | 17 | 17（停写保留） |
| 默认强制 registry / claim 登记 | 是 | 否 |
| 本轮启动采样 literal WARN 行 | 0 | 0 |

母版代码含按需发现/升级、v4 兼容安装器和验效脚本，不能冒充项目安装负担；原来放在 scripts 的 99 行需求测试只是迁入 tests，故另列排除测试口径。函数名计数仅是 SKILL 要求的门数代理指标；不能把合并函数宣称为实际安全义务减少。保留防线是否有效由下面的真实负例判断。历史 registry 增加停写说明但 17 条数据均保留；根仓没有独立 claims 账本，未虚构未收口数。母版本身就是治理产品，没有独立业务代码可作分母。

### 事故重放原始输出

```text
PASS remove Stop wiring: exit=1; [governance] ERROR codex Stop 接线缺失或无效
PASS stale cursor date: exit=1; [governance] ERROR ROADMAP 当前游标日期缺失、过旧或超出时区一天容差
PASS compact in /tmp: coordinates + temporary directory warning
PASS cd x && /usr/bin/git reset --hard: permissionDecision=deny; command not executed
PASS real gitleaks rejects synthetic staged credential: exit=1; [governance] ERROR gitleaks dir 失败：发现凭据或扫描失败，请本地用 --redact 复核 | [governance] ERROR gitleaks git 失败：发现凭据或扫描失败，请本地用 --redact 复核
PASS missing gitleaks fails closed: exit=1; [governance] ERROR gitleaks dir 失败：缺少 gitleaks（fail-closed） | [governance] ERROR gitleaks git 失败：缺少 gitleaks（fail-closed）
PASS staged external absolute symlink: exit=1; [governance] ERROR 仓外绝对路径软链接禁止提交: outside-link
PASS Stop prompts once for changes without cursor update: first block, second allow
RESULT 8/8; report=/tmp/governance-lite-evaluation.json
```

这些负例使用真实脚本、真实 Git 暂存区和真实扫描器。危险命令只输入判定器，不实际执行；凭据为随机合成测试值，无真实凭据。软链先暂存仓外绝对目标，再把工作树替换为安全相对目标，证明检查依据是待提交 blob。首次验效脚本在清理这条故意不一致的暂存记录时失败；修复仅对自建临时仓该记录使用 `git rm --cached -f`，未改门禁或断言，重跑 8/8。

母版按需 catalog 也已补齐新文件归属，实际源码覆盖 149/149、0 error；没有把它重新接回 Lite 的启动或 check。

### 验证边界与交接

文档提交 21fe88d 之前已实跑 `npm run check`（0 error）、`npm test`（186 pass / 0 fail / 0 skip）和 `node scripts/governance-verify.mjs --ci`（通过）。验效提交仍按同一三项门全部通过后才提交；最终原始尾部随交付答复提供。

独立无上下文前向考试按负责人要求留给主控；真实客户端 trust/Hook 生命周期、消费项目采用和远端 CI 本轮未验。不能据本地计时与脚本探针宣称这些层已完成。VERSION/package/铭牌版本保持 4.3.0，CHANGELOG 仅列 Unreleased v5.0.0，不 push、不改 main、不写消费仓。
