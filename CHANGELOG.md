# CHANGELOG

> 只追加有意义的仓库、架构、运行状态或治理变化。只读评审、讨论和无落盘任务不写。

## 2026-08-26 · v3.6.1 · 发布状态结账
- [docs] REQ-GOV-003 在远端回读与 AIOS 正负开机 fixture 后由进行中移入完成；ROADMAP 替换为现役 v3.6.1 投影。
- [governance] 版本补丁用于避免 v3.6.0 发布后继续以同版本修改 kit 指纹；行为合同与 v3.6.0 相同。

## 2026-08-26 · v3.6.0 · 治理编译与开机施工许可
- [fix] 升级器不再把“补缺失文件+更新 lock”当作完成：项目事实保留，playbook 管理的薄适配器可更新，已知旧接线窄迁移，未知定制原子停手并返回 `needs_human_decision`；版本相同也检查载体，离线只信 lock 指纹验证过的同版本 kit。
- [feat] `governance.lock.json` 增加确定性适配结果；`upgrade.mjs` 输出结构化适配报告。CORE §7.2 与 R12 明确“通用母版 → 项目实例”的治理编译合同，负责人保留最终解释权。
- [feat] Codex Session Start 增加开机自检，核对权威入口、实际注入铭牌与 Session Start/PreToolUse 专用接线；通过后在 Git common dir 签发短期施工许可。许可缺失、过期或关键载体变化时，直接写文件 fail-closed。
- [test] 增加同版本旧接线、未知定制不半迁移、离线已验 kit、许可缺失/过期/接线变化、doctor 识别旧适配器等正反例。
- [governance] 来源：AIOS 已登记 v3.5.0 但 Codex 仍接旧 Session Start 的假对齐事故；修复目标为“门牌、线路、实际注入和施工许可”四者一致。

## 2026-08-25 · v3.5.0 · 执行正本结账制与内容语义门
- [feat] CORE §7.5：执行正本=现役投影不是施工日志。形状门（固定形状/唯一游标/预算背压）、收工结账三问、开工投影式读、知识路由（每段文本有类型+出处指针+触发器，写不出触发器=尾气不入库）、记录政策（机器门槛复杂度由失败挣，知识记录获取即记落外挂线）。
- [feat] CORE §5：新增「内容语义门」——AI 结论挣得阻断权的五条件：冻结规则集只判机器判不了的少数几件、固定 I/O 且解析失败绝不视为 pass、golden 正反案例套通过=装门前置、发送安全确定性前置、本地便利层/远程 CI 权威层分层。原「不把 LLM 单次结论作为唯一合并阻断条件」收窄为「未满足条件的不得阻断」。
- [feat] CORE §3：载体必须可验活——hook 迁移位置必须盘点旧位存量，doctor 校验接线指向与残留可执行钩子；「门死了没门在看」是最危险的静默失效。
- [case] 新增判例 30：执行正本长成流水账与语义门挣得阻断权；补登记漏索引的判例 28（压缩坐标）、29（公共线）。
- [fix] 落盘 frontend-design-system 扩展既有未提交施工（README/模板/policy/verify 脚本，2026-08-24 遗留）。
- [governance] 发布 `v3.5.0`。来源：AIOS 2026-08-25，wechat-cs 正本膨胀事故与当日两层门整改（L1 路由门+L2 语义门上线、golden 8/8 独立复验、门活性检查、pre-push 部署源防线复活）。参考实现暂留 AIOS 仓（ADR-012），脚本模板化收编=下一版候选。

## 2026-08-24 · v3.4.4 · 眼前这份必须含有公共线
- [feat] CORE §7.4：公共线是仓内约定（`integrationLine`），不是 Git 字段。缺同事已推上公共线的提交时不许继续改代码；跑测试、开 PR 另算。不是分支必须叫某个名字。
- [feat] `governance/policy.json` 增加 `integrationLine`（remote/branch/label）。
- [feat] SessionStart 用人话报告含有公共线 / 还缺同事的提交。不报吓人的领先数字，不要求改分支名。
- [feat] PreToolUse 仅在主工作树**落后**公共线时拦截写代码；已经含有公共线即使在旁支上也可以写。允许合入、文档入箱、冲突解决、救火认领。不自动 merge、不自动 push。
- [test] `tests/integration-line.test.mjs` 覆盖落后拦截、跟上的旁支放行、临时 worktree 放行。
- [case] 新增判例：日常目录离开公共主干就会双线分叉（AIOS 2026-08-24）；2026-07-17 开工对账判例载体从待下沉改为 R14。
- [governance] 发布候选升到 `v3.4.4`。来源：AIOS 日常目录在功能旁支上停了 8 天。

## 2026-08-23 · v3.4.3 · 压缩前必须留下可恢复坐标
- [feat] CORE §7.3：压缩和重启会丢掉聊天记忆与 `/tmp`；未进 git 的路径不是正本。
- [feat] 共享 `pre-compact.mjs` 检查临时目录/脏工作区，注入目录、分支、HEAD、下一步；不自动提交、不回收 worktree、不阻断压缩。
- [feat] Codex 用最薄 JSON 适配器 `pre-compact-codex.mjs`；Claude/Grok 直接读文本。
- [feat] 新安装三家 hook 都带 PreCompact；存量升级补缺失脚本，缺插座则补上，旧 `echo` 只替换这一条命令。
- [feat] 人说「收口」走 skill `shoukou`：停新功能、离开 `/tmp`、提交要保留的改动、把四行写入仓内正本。
- [test] doctor 校验 PreCompact；升级补丁不覆盖其它 hook 事件；脚本在 `/tmp` 与脏工作区给出警告且不调用 `git commit`。
- [case] 新增判例：压缩后会把临时目录和聊天记忆当成正本（AIOS Codex 线程）。
- [governance] 发布候选升到 `v3.4.3`。来源：AIOS 2026-08-23，负责人要求验证有效的经验点升母版。

## 2026-08-23 · v3.4.2 · 仓外正本必须有仓内路径指针
- [feat] CORE §7.1：密钥、口令、真人身份对照不能进 git，但仍是正本；仓内核心是 `docs/index.md`，仓外核心是 `docs/ops/extra-repo-facts.md` + 机器表 JSON。
- [feat] 人级共享秘密走 `~/.config/<域>/`，禁止放进 `~/.claude/` / `~/.grok/` / `~/.codex/`。
- [feat] SessionStart 注入事实类、路径、已装载/正本未装载，永不打印仓外文件内容。
- [feat] lint 拦索引缺失、schema 非法、索引漏进秘密；家目录文件缺失只 warn，CI 不因此变红。仓内替身文件可用 `decoys[].mustContain` 强制声明不覆盖的事实类。
- [feat] 新安装默认带上空索引、说明页与 `.grok/hooks/governance.json`；无仓外正本的项目保持 `facts: []`。
- [feat] Grok 薄适配：能力表加列；PreToolUse 在 `GROK_HOOK_EVENT` 下输出 `deny`；认领门认 `grok`；不另写核心。
- [feat] 治理版本以 GitHub `VERSION` 为正本；SessionStart 开机对照并 `upgrade.mjs` 安全补缺失载体、改 lock；不覆盖项目事实；未发布 kit 不写入消费仓。
- [case] 新增判例：仓外正本没有仓内指针就会被替身止搜（AIOS Demo 人名对照）。
- [governance] 发布候选升到 `v3.4.2`。来源：AIOS 2026-08-23，另一执行者把 `tenants.json` 当成人名正本。

## 2026-08-16 · v3.4.1 · Codex Hook 可视等价与收口提示
- [governance] 新增跨项目“发布治理”入口：以目标身份、不可变制品、唯一入口、阶段授权、正负成功证据、运行回读、回滚和结构化回执组成最小合同；项目事实留在本地 release runbook，不创建 Skill，也不把 upload/preview/exit 0 误作正式发布。
- [fix] 新增 `scripts/governance-hooks/session-start-codex.mjs` 作为最薄 Codex SessionStart JSON 适配器：直接复用现有 `session-start.mjs` 文本播报，同时写入 `systemMessage` 与 `hookSpecificOutput.additionalContext`，不给 Codex/Claude Code 维护两套状态生成逻辑。
- [fix] `.codex/hooks.json` 改接 JSON 适配器；`init`、模板和 kit 自校验同步纳入 `session-start-codex.mjs`，缺载体时 doctor 会报缺失文件。
- [fix] Stop Hook 现在每次都显式输出收工治理铭牌：成功至少包含从 `governance.lock.json` 读取的版本铭牌与 `✅ 治理验证: 通过`，失败/重复失败也带同一版本；额外只追加 active claim 与 dirty worktree 这类确定性提示，不猜“本轮进展”。
- [fix] `doctor` 对所有 `codexActive` 安装都提示 `/hooks` 信任边界，不再因 `runtime=claude-code` 漏报；`governance-lint` 远端领先检查先确认 `refs/remotes/<remote>/<branch>` 存在，消除不存在远端分支时的 `ambiguous argument` 噪音。
- [fix] `doctor` 追加 Codex hooks 顶层 schema 白名单校验：当前只接受 `description` / `hooks`，像 `$comment` 这类 JSON 语法虽合法但会被 Codex 拒载的字段现在能被迁移回归测试拦住。
- [governance] 发布候选升到 `v3.4.1`，结束 `v3.4.0` 同版本内容继续变化导致的 lock 版本/指纹混淆。

## 2026-08-16 · 前端设计语言代表旅程通用化（local-only，未发布）
- [feat] 将设计语言定义为跨页面/组件的可复用语法、信息角色、状态和交互契约；通用模板补齐设计意图、设计语言、信息层级、页面族与代表链路、组件状态边界、验证与晋级章节。
- [feat] `frontend-policy.json` 增加 `representativeJourneys` 原语：`reference-pending` 可空，`shadow/enforced` 至少一条旅程且每条有仓库内 evidence；verifier 增加 heading、schema、重复 id、路径和生命周期门。
- [feat] SessionStart 播报 `journeys=<count>` 和非空 journey ids；根脚本与 `templates/common` 保持同源。当前仅本地验证，未提交、未推送、未发布。

## 2026-08-16 · v3.4.0 候选增量（已并入 v3.4.1）
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
