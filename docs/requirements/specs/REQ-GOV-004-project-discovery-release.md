# REQ-GOV-004：项目发现能力的母版发布与安全采用

## 负责人授权与三行规格

- 解决什么：AIOS 已实现的索引、分类检索、开工地图及有界环境诊断尚未进入通用母版；只推 AIOS 分支不能让其他项目采用。
- 怎么验收：通用实现没有 AIOS/Mini 业务坐标；新项目与已有项目正反测试、无历史发现验收通过；母版发布版本可回读；消费项目逐项记录实际采用文件、验证和同步状态，不能靠版本号冒充采用。
- 本次不碰：业务代码、生产部署、主机/服务重启、凭据正文、个人全局配置、他人 WIP、旧工作区自动清理；不恢复项目已经退出的自动升级、许可或巡检机制。

负责人已确认推进母版与跨项目分发，延续 Luna Max 实现、主代理规划与独立验收。通用规则在母版，具体资产及正本入口仍在各项目。

## 实施与验收阶段

1. 盘点母版版本与消费仓；用 Git common-dir 区分独立项目和 worktree，记录实际版本、定制与脏状态。未知或冲突不自动覆盖。
2. 提炼可移植发现机制：八类任务导航、稳定资产ID/别名/标签/一跳关联、元数据按需地图、索引可达与范围源码归属检查、有界环境诊断。任务域可复用，源码根、工作线、重点对象、凭据引用和入口由项目提供；没有元数据明确报缺，不凭空登记示例机器。
3. 升级交付机制：显式、按能力采用，不因升级索引去迁移无关 admission/policy/Hook。已知受管文件以来源指纹判断可更新，未知定制或目标文件脏则拒写；计划默认只读，写入前整批检查。受管代码、项目事实、接线和版本回执分开；失败不能留下“已采用”版本。
4. 同步修正 v4.0.0 已裁决但代码未实现的自动升级退出：SessionStart 不 pull 或写入升级；旧启动入口调用也不得静默恢复自动迁移。显式升级保留，既有项目安全门不删除。
5. 完整运行母版 check/test/governance-verify 与无上下文新建/已有项目测试后发布；母版版本、SHA 与发布回读按 [ROADMAP.md](../../../ROADMAP.md) 当前游标登记，不能用版本号代替消费项目采用。
6. 消费端按只读盘点的真实清单逐个适配、验收、形成提交并核对远端；不得自动推业务发布分支。跨项目覆盖只对已识别且获安全采用的对象报告，其余明确缺口。

## 阶段验收与发布回读记录（截至 2026-09-07）

母版发布部分已完成；准确版本、实施发布基线、远端回读与母版验收证据见 [ROADMAP.md](../../../ROADMAP.md)。本节仅补充冷启动修复与消费盘点，真实客户端 UI trust 与全客户端现场仍不作宣称。

无上下文初始复核发现并已修复三类问题：非 ASCII 环境路径曾因使用 URL `.pathname` 造成 percent-encoded 路径与 `MODULE_NOT_FOUND`，改用 `fileURLToPath` 并纳入回归；未发布来源门改为只接受本地已抓取 `refs/remotes/origin/main`、发布 ref 包含当前 HEAD 且 `VERSION` 一致，缺 ref、candidate 或漂移拒绝写入且不自动联网；lock/fingerprint 改为在写入前复核来源版本、SHA、聚合指纹与受管文件回执，不一致、脏状态或未知定制 fail-closed，不能只靠版本号。本节只登记仓库身份与仓内相对正本指针，不记录凭据正文。

盘点范围只认以下五个规范消费仓的独立根目录；`worktree`、`build` 目录和旧 clone 均排除，不作为消费仓或覆盖率分母。用户已澄清范围仅为治理索引；母版发布完成，跨仓采用仍未完成且待范围确认：

| 规范消费仓 | 当前盘点结果与边界 | 仓内相对正本指针 |
|---|---|---|
| `aios`（AIOS） | 仅盘点：五个旧自定义库与母版冲突，自动采用被挡；既有 56 个资产与 `07cea` 成果保留，不重做。待明确范围、owner 与基线，未采用本母版。 | `docs/index.md`；`docs/architecture/project-catalog.json`；`docs/execution/ROADMAP.md` |
| `微信客服` | 仅盘点：8 个 discovery 文件可安装，但 `origin/main`、`codeup/main` 与 workline 分叉。待明确范围、owner 与正式交付基线，未采用。 | `docs/index.md`；`ROADMAP.md` |
| `新-产品中心` | 仅盘点：lock 有 WIP，明确拒写；本地与远端分叉。待明确范围、owner 与基线，未采用。 | `docs/index.md`；`ROADMAP.md` |
| `clearance-center` | 治理索引范围已澄清；状态：`file-install-only`，catalog 未配置，非完整索引采用。隔离 worktree `/Users/jack/working/clearance-discovery-adoption` 位于 `codex/discovery-adoption`；已安装 8 个 discovery 文件及 receipt（保留 base `3.1.2`），主代理 CI `85/85`、hash `8/8`，提交 `e05f8cddd19fc980f60aceb5a29e1ce00c23ec99` 已推送至 `origin/codex/discovery-adoption`，`gh api git/ref` 回读同 SHA，隔离 tree clean。无 PR、无 `main` 合入、无部署、未接线；原 `main` 的两个自有提交与 WIP 未动，worktree 保留不删除。 | `docs/index.md`；`ROADMAP.md` |
| `aios-extend` | 仅盘点：8 个 discovery 文件技术可装，但属独立协作 owner，禁止自动适配或写入。待明确范围、owner 与基线，未采用。 | `docs/index.md`；`docs/execution/ROADMAP.md` |

上述清单不把版本锚点当作采用证明；除已记录的 clearance 独立治理分支外，其他消费者仅盘点，均待明确范围、owner 与基线，不写成正在推进。消费者 worktree、commit、push 与接线状态以各仓后续证据为准；下一步先确定消费者采用分支与 owner，本轮不合入业务部署分支。

## 兼容与完成判据

保留各项目自有宪法、policy、INDEX、资产表、认领机制及运行时差异。能力单独采用时必须记录能力来源版本和验证回执，不把整个母版都盖章为最新。全量升级与能力升级分别记录。旧目录入口可用薄兼容入口，不能留下两份手工维护的事实或执行算法。

完成判据所需的母版准确版本/SHA、完整测试与新会话证据已由上述发布回读记录；各消费项目采用清单及未采用原因已逐项记录，其余采用待范围、owner 与基线等裁决。本 REQ 保持进行中，不能宣称跨项目采用完成。
