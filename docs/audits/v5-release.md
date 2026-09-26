# v5.0.0 Lite 首版验收（2026-09-26）

## 前向测试来源与边界

负责人提供的首个项目实装结果：wechat-ai@ccf2079，2026-09-26。三名零上下文考生在五题均须引用文件:行的冷启动考试中分别得 99/100/99。唯一错题归因为项目自身文档漂移；这份报告没有直接读取或修改 wechat-ai 仓库，分数与归因记录为负责人提供的证据，不冒充本仓本轮重跑。真实客户端 trust/Hook 生命周期、远端发布及其他消费项目采用仍各自验收。

## 两处实装反馈与修复

| 反馈 | 修复 | 反测试 |
|---|---|---|
| 项目已有 `docs/ROADMAP.md` 时 init 另建根路线图，运行时优先读根文件 | init 与运行时共用实际路线图解析；优先保留 docs 路线图或 docs/index 已登记的其他路线图；新生成 AGENTS 与 docs/index 链接按实际路径渲染。原文缺带日期 `## 当前游标` 时计划和安装均提示，原文不改，自检保持失败 | 临时 Git 仓分别覆盖 docs 路线图、已登记自定义路径、缺游标；验证 KEEP、无根副本、原文不变、SessionStart 与 check 读同一正本 |
| 工作树副本在随机临时目录扫描，项目根 `.gitleaksignore` 指纹失效 | 在副本目录以 `gitleaks dir .` 扫描，使发现路径与指纹相对项目根；两次扫描显式传项目根豁免文件 | 真实 gitleaks 生成合成凭据指纹，登记并暂存后 check 通过；另加未登记合成凭据后 check 失败；既有暂存区泄漏与缺扫描器反例仍执行 |

只有确认误报后才使用行内 `gitleaks:allow` 或项目根 `.gitleaksignore` 的 `路径:规则:行号` 指纹；两种方式和扫描范围见 [安装说明](../../BOOTSTRAP.md)。合成凭据均为随机测试值，不是实际凭据。

## 发版坐标

- 分支：`feat/v5-lite`；施工起点：`c5e357f`。本轮不 push、不改 main、不写消费仓。
- 版本正本：VERSION、package.json、自托管 governance.lock.json、README 和 CHANGELOG 同步为 5.0.0；自托管 kit 指纹在全部文件定稿后重算并由 `npm run check` 核对。
- 机器验证：`npm run check` 为 0 error，`npm test` 为 191 pass / 0 fail；`node scripts/governance-verify.mjs --ci` 再次执行 check/test，结果 191 pass / 0 fail，`verify ciChecks 通过`。指纹在本文定稿后重算并复核；本地版本号不等于远端发布。
