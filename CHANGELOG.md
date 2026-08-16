# CHANGELOG

> 只追加有意义的仓库、架构、运行状态或治理变化。只读评审、讨论和无落盘任务不写。

## 2026-08-16 · v3.4.0 本地增量（未发布）
- [feat] 完善可选 `frontend-design-system` 扩展：以 `governance/frontend-policy.json` 统一 lifecycle、四条权威路径、生成物、配置检查和视觉回归；补齐 reference pack、primitive → semantic → component tokens、独立验证器和扩展安装契约。
- [design] 明确 `reference-pending` 可容纳未验证候选，不等于“尚未选风格”；品牌手册、官网和 Logo 来源色必须经过项目 semantic 映射、对比度与代表页面验证，不能直接绑定组件或业务身份。
- [feat] 公共 `governance-verify` 按 `--fast`/`--ci` 自动调用扩展验证器，SessionStart 在检测到 policy 时确定性播报 lifecycle 与 authority；`reference-pending`/`shadow` 的非结构检查只报告，`enforced` 的配置硬门禁才阻断。
- [test] 补扩展安装文件、SessionStart 触达、结构错误、enforced 空门禁和 shadow 非零检查不阻断测试。

## 2026-08-11 · v3.4.0 · AIOS 治理母版与单一入口
- [feat] 新增 `BOOTSTRAP.md`、`gov-bootstrap` 和通用认领门；新安装默认 Standard，认领门随 Standard/High Assurance 安装，Lite 动态降级。
- [fix] 新安装的 `CLAUDE.md`/`AGENTS.md` 改为字节一致双正本；lint 同时兼容真实存量的手写短桥接，并补版本漂移门。

## 2026-08-10 · 死链门收敛 + 非 ASCII 路径修复(卫星仓迁移实战暴露)
- [fix] `governance-lint` 死链门收敛(此前扫全仓 *.md、对历史文档与误报一刀切，逼迁移者去改文档凑绿——违「求真优先」）：①豁免历史/append-only/时点快照文档（handoff/audit/archive/draft 目录、`YYYY-MM-DD-*` 快照、CHANGELOG、incidents、含 draft／交接）；②跳过 `file://`／含正则元字符 `[]^*`／未平衡括号（Next.js 路由组 `(dashboard)`）／行号后缀 `:40` 的目标；③扫描前剥离 code block 与 inline code span（考题里演示死链的 `` `[x](y)` `` 不再误判）。实测新-产品中心 123 死链→0，零文档改动。
- [fix] `governance-verify` 与 session/stop hooks 改用 `fileURLToPath` 取脚本路径（此前 `new URL().pathname` 在非 ASCII 仓库路径「新-产品中心」下返回 percent-encoded → `MODULE_NOT_FOUND`，pre-commit 根本跑不起来）。
- 来源：微信客服 + 新-产品中心 全量迁 v3 实战；两仓均已迁完（v3 正本＋三句核心＋机器门，WIP 守死、零上下文接管考试 PASS）。

## 2026-08-10 · 执行状态建模入 CORE(状态即投影)
- [feat] CORE.md 新增 §2.5「执行状态建模」:游标唯一可写 / ROADMAP 是机器投影(生成物) / 战线≥3 才分裂成分支文件 / 每分支从立项到当下完整叙事——AIOS 一年实践 + 三方会审收编的 generalizable 部分(AIOS 特有九段全检/锚点门不进核心)。
- [feat] governance-status.mjs 升级为自适应生成器+漂移门:未分裂打印单游标;已分裂从各分支「当前游标」`--write` 投影 ROADMAP、`--check` 比对(pre-commit/CI 漂移门)。fixture 实测:漂移拦截 exit1、投影一致 exit0、`_TEMPLATE` 忽略。
- [feat] 新增分支最小模板 `templates/common/docs/execution/branches/_TEMPLATE.md`(使命/阶段阶梯/当前游标/本阶段规格/已验事实/待裁决;最小六段,非 AIOS 九段)。
- [feat] `INSTRUCTIONS.md` 模板补三句核心 + 状态权威改为「游标唯一可写、ROADMAP 是投影」。
- [fix] `init.mjs` 安装末尾自动 `git config core.hooksPath .githooks`——否则 pre-commit 只是躺着的文件、不在提交路径上（漂移门宣称拦实测不拦，是零上下文考试揪出的宣称>实现）。
- [fix] `--write` 分裂时自动删除 ROADMAP 顶部单游标段 + `--check`／pre-commit 拦「分裂态残留顶部『## 当前游标』」——给「不留第二份状态正本」上机器载体（否则只是文字要求，违第三句「无载体不出生」）。
- [fix] 模板 `registry.md` R4 登记 `pre-commit`＋`governance.yml` 载体；day-1 装机不再自 lint 报「载体未登记」。CORE §2.5／INSTRUCTIONS／ROADMAP 对 CI「须配 branch-protection 才阻断合并」、pre-commit「查工作树、快反馈层」如实标注，不夸大。
- [test] 新增 `tests/governance-status.test.mjs` 4 条回归（单线空过／投影+删顶部游标／漂移拦 exit1／第二正本拦 exit1）。
- 验收：经 **4 轮零上下文接管考试**逐轮加固后 PASS——每轮由一个零历史 AI 亲装真项目、真 `git commit`，依次揪出「门未接进 policy.json」→「init 未激活 hooksPath」→「顶部单游标无机器载体」三个真缺口，全部修实并实测。

## 2026-08-08 · 三句核心入 CORE(方法论最高纲领)
- [feat] CORE.md 新增 0 章「三句核心」:真相在文本 / 行动跟文本 / 底线在机器——外部对标(甲壳虫宪法模板)与 AIOS 实践收敛,负责人定纲;一切治理零件必须回指其一。
- [governance] 新增判例两条:事故驱动体系的慢性失血盲区(演化式治理防不住无报警声的损耗)、参考外部体系先对齐整条链再动手(三段法:原样摆清→逐环对账→只动差集)。AIOS 母版同日已装载体(收件箱+三层机器网+宪法锚点 doctor 校验)。

## 2026-07-29 · v3.3.1（fail-closed requirements/install governance）
- [fix] local 需求校验固定运行 kit 内置语义 checker；`source_refs/spec_refs/acceptance/evidence`、规格相对路径、完成项证据和段落边界均纳入硬门。
- [fix] external 需求权威要求 policy、运行时指令、`docs/index.md` 三处 URL 完全一致；已安装项目不能由普通 init 在 local 与 external 之间半迁移。
- [fix] `.env.local` 派生形态和 `.env.production` 通过 `git check-ignore` 验证；lock 追加 kit 内容指纹，doctor 不再仅信任版本字符串。
- [governance] AIOS 集成事故回流：共享 checkout 的多代理实现必须按文件单写者；负向测试必须同时证明失败状态与目标拒绝语义。两条均已写入判例和 `pro-supervised-delivery` 验收参考。

## 2026-07-29 · v3.3.0（最小可执行合同）
- [feat] `scripts/init.mjs` 增加 requirements 外部源模式（`--requirements-mode local|external` + `--requirements-source`），与 `templates/common/docs/index.md`/`INSTRUCTIONS.md` 指针对齐，`docs/requirements/backlog.md` 不再允许空白通过。
- [feat] `scripts/governance-lint.mjs` 增加 requirements living-system 校验：本地 backlog 必须有有效需求条目；外部模式下禁止维护状态化本地 backlog 并要求指针可追溯。
- [feat] `scripts/doctor.mjs` 增加 playbook 版本审计（当前 kit 与 `governance.lock.json` 漏斗一致性）、治理脚本兼容性提示；保留只读审计，不写变更。
- [feat] `templates/common/docs/requirements` 新增 README 与 `specs/_TEMPLATE.md`，明确需求最小可执行语义与字段要求；`templates/common/docs/requirements/backlog.md` 从空白占位升级为最小可执行模板。
- [feat] `templates/common/governance/cases/README.md` 与 `skill/README.md` 收敛为指针入口，新增 `skill/pro-supervised-delivery` 作为高阶交付边界 skill（不复制核心方法论正文）。
- [governance] 明确多人/多AI的Git交付边界：活跃开发可暂时未提交；获授权后由任务分支形成提交并push/MR，经共享门禁后合并默认分支，默认不让多个执行者直接写`main`；无Git授权时必须标记`local-only`。

## 2026-07-28 · v3.3.0
- [feat] **README 顶部立「北极星」**(负责人定纲):甩链接给任何 AI(新建或中途加入)= 一致治理水平、每轮要点全记载、随时无缝切换;附三条可检验收(lock+doctor / hook 实效 / 游标新鲜度),负责人随时抽查任何项目。
- [feat] `governance-lint` 加 **hook 载体实效检查**:settings.json/hooks.json 存在但无 Stop 段 = 空壳假绿(手工抄治理的典型残留),warn。既有检查只验文件存在,「守卫文件是空壳」此前无人看守。
- [feat] `governance-lint` 加 **ROADMAP 游标新鲜度检查**:正文最新日期落后最新提交 >7 天即 warn——「无缝切换」败给的往往不是缺文档,是文档陈旧(aios 游标冻结 13 天实证)。
- [case] 新判例 **绕过安装器手工抄治理必漏hook**:模板对、安装器对,项目没跑 init 才是真因;守卫安装的东西自己没守卫(同根因第三例)。setup.md 顶部加「禁手工抄」硬话;存量残骸按附A 收编(aios 已实证收编,双门全绿)。

## 2026-07-25 · v3.2.0
- [feat] `governance-lint` 加**反向覆盖检查**:枚举实际在跑的载体(`.githooks/*`、`.github/workflows/*`)反查 registry.md 有无登记,未登记即 warn。既有检查只验「登记的是否存在」(installedFiles),「实际在跑却没登记」此前无人看守——母版实证台账停摆 15 天漏登 4 类正在运行的载体,且漏的恰是被真实事故逼出来那批,导致规则预算读数失真。**warn 而非 error**:新检查对存量项目先观察,不在升级当天打断任何人的 CI。装上当天即在本库自身抓到 2 条漏登(pre-commit / governance.yml),已补进 R4 载体列(顺带践行本表自述「载体要写清,概念不算」)。
- [feat] 周报模板加**流量对账**读数:近 7 天修复类提交数 vs 事故簿最新条目年龄,疑断流即标记。来源同上判例的推论——**补条目只修库存不修流量**,手写账本断流的根因是「写入与事件无绑定」,光补历史不防再断。只报告、不设门禁、零新载体。
- [test] 心跳测试改用新契约(`##` 标题制含闭环判定 + 流量读数在位);19/19 通过。

- [cases] 母版(产品中心)反哺第 14 条判例:**自动账本活、手写账本死**——同仓两周实测,生成制账本(能力清单 `--check`)零漂移且两次拦下真实漂移,而三本手写账本(规则台账/事故簿/问题队列)全体断流 15-18 天,漏登的恰是被真实事故逼出来的新载体。机制=写入动作是否与触发事件绑定(生成器绑在每次提交、必然发生;手写绑在「想起来」、必然丢);推论=补条目只修库存不修流量,须给手写账本加流量对账读数。判例含反模式警告:生成器必须印明扫描范围,否则「自动」冒充「完备」比手写漏登更危险。
- [fix] `templates/common/governance/questions.md` 改 `##` 标题制(原表格格式)+ `templates/standard/scripts/weekly-governance-review.mjs` 未结数正则同步改。根因:跨项目收件箱聚合器按 `##` 标题解析,表格/编号列表格式聚合不到——产品中心实测五个项目里三个(含 playbook 自身模板)静默贡献 0,队列写了等于没写。这是「集中地必须配触达层」判例在本体系内的现行反例,格式即触达层的一部分。
- [chore] 删 `templates/KNOWLEDGE_BASE/` 空壳目录(只有空 insights/、零文件,纯噪音)。

## 2026-07-19

- [fix] PreToolUse 跨命令误报回流(来源:AI-OS 会话同日实测两次误拦)——denyCommandPatterns 原对整串候选匹配,`git push … && git worktree remove … --force` 被跨 && 拼成假命中;改为候选生成按 shell 连接符(&&/||/;/|/&/换行)拆独立命令段、逐段匹配,含连接符整串不再进候选(连接符伪装由 unwrapShell 解包后重新分段覆盖)。顺带补一个漏拦:链中非首命令的目录前缀(`cd /tmp && /usr/bin/git reset --hard`)原可绕过 (^|\s) 锚点,拆段后逐段归一化拦住。测试 +1(9 block+3 allow 分段矩阵,19/19);root 自托管副本同步字节一致。

- [cases] clearance-center 反哺:门禁判定面最小化——判「改什么」看目标不做全文匹配,误伤率决定门禁存活率(v3.1.2 修复的判例正本;负责人批准 promote,判例库 12→13)。

- [fix] v3.1.2:两处实测缺陷回流(来源:clearance-center v3 安装,首个 v2→v3 存量迁移实践)——
  ① protectedPaths 判定面最小化:模板原为全输入序列化子串匹配,保护文件名被文档链接引用即误拦(首启当场实证);改为 Edit/Write 只比对目标路径字段、Bash 只拦写入形态(重定向/tee/sed -i/mv·cp),纯读放行;测试补 3 条误伤回归断言。判例候选:vault「门禁判定面最小化」(validated,待拍板 promote)。
  ② init.mjs 日期本地时区:TODAY 与 lock.installedAt 原用 toISOString(UTC),跨日窗口日期错一天——v2.3.0 已在心跳脚本修过同款,init 漏改,本次补齐。

## 2026-07-19

- [fix] v3.1.1:session-start hook 增加判例库开工保鲜(静默 pull playbook,路径可配、离线不阻塞)——多项目并发时判例同步延迟从「隔天」降到「下个会话」。README 版本引用同步。

- [cases] 反哺积压清账:vault 已验证判例 7 条一次推入(git 卫生 6 次复现 / 工具通道防御 / 载体抢跑 / 治理不吞工程域 / 集中地配触达层 / 归档前抽认知 / 观察者不是门禁),判例库 4→11 条,索引齐。实时更新机制定版:判例 validated 即推、每日心跳的判例检查为提醒载体,不再积压。

## 2026-07-17

- [cases] 判例:负责人看不懂是最高优先级事故——S5 注意力预算算总账,响应只能是减法(唯一收件箱/人机视图分层/机制冻结)。

- [release] **v3.0.0 世代切换**:v3(单一 CORE 权威 + 三档 Profile + init/doctor/governance-verify 脚本化 + policy.json 机器台账)经四维无记忆实测(理解 93.75 / 判例行为 99 / 安装 90 / 对抗两轮)+ 13+4 项修复后合入 main。v2.3.1 增量已全量语义移植;v2 历史保留于 git 与 tag v2.3.1。判据:「发布 = 通过无记忆实测,不是 push 完成」。

- [release] main 发布 v2.3.1：复测残留 3 处 P2 修复（本地定时器完成判据 / 心跳尾注去硬编码层级 / 自检措辞对齐最小档）——v3 合流时已语义移植。
- [release] main 发布 v2.3.0：四维无记忆实测驱动的 16 项修复（判例库接线入口 / 判例六字段统一 / 复制清单补全 / CJS 生成器 / 心跳本地时区 / CI 无远端降级 / VERSION 锚点 / 最小档豁免段）——v3 合流时已语义移植；其中能力清单相关修复不适用（v3 已将该机制移出核心，见 docs/audits/v3-content-audit.md）。
- [cases] 母版（产品中心）首批三条判例反哺：机器节拍与数字门槛不继承人类惯性 / 组成部分读出来不背清单 / 多人协作仓开工先 fetch 对账（10 天双线分叉实证）。均经负责人当场纠正或批准，一事一文，含可泛化边界与载体落点。

## 2026-07-11

- [governance] 将v2升级为v3：采用单一核心与Codex/Claude Code/Generic适配器，增加三档Profile、目录治理、可选前端设计系统、自动门禁和无上下文前向测试。

- [cases] AI-OS 反哺:「冻结令是急刹车,稳态是理性取舍」(负责人 2026-07-19 当面校准+批准 promote,判例库 11→12)——一刀切禁令的保质期与恢复行驶协议,补「负责人看不懂」判例后半程。
