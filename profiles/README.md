# 治理 Profile

Profile 按风险和协作方式选择，不按项目“成熟度”评奖。默认从最小档开始，出现真实需求再升级。

## Lite

适用：本地原型、单人、多 AI 接力、尚无真实用户。

安装：

- 自动指令正本和运行时桥接；
- ROADMAP、CHANGELOG、docs/index；
- 最小 policy、SessionStart、PreToolUse、Stop；
- governance lint 与 doctor；
- questions / incidents 的空入口，仅在真实事件发生后写条目。

不安装：周心跳、能力清单、AI 审计、CODEOWNERS、复杂审批。

## Standard

适用：活跃开发、多贡献者、准备上线或已有真实用户。

在 Lite 上增加：

- registry 台账与 cases 判例库（incidents/questions 空入口 Lite 已含）；
- pre-commit 快速反馈；
- GitHub Actions 确定性验证；
- branch protection / required checks 操作清单；
- 每周自动对账；
- 可选只读 AI 审计。

## High Assurance

适用：资金、合规、生产关键数据、不可逆外部动作。

在 Standard 上增加：

- CODEOWNERS 和高风险路径审批；
- 生产凭据与开发凭据物理隔离；
- 发布、迁移和回滚证据包；
- 依赖与 Action 版本固定；
- fork PR 密钥隔离；
- 管理员强制策略或等效基础设施；
- 事故响应和恢复演练。

## 升降级信号

- Lite -> Standard：出现第二位贡献者、接入远端、进入真实用户灰度，或本地 Hook 被绕过。
- Standard -> High Assurance：接入资金、生产写权限、个人敏感信息或监管要求。
- 降级：连续两个复审周期零消费者、零触发且风险已消失；删除机制并留一条变更记录。
