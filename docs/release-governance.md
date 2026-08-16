# 发布治理

发布治理把“代码已经改好”到“目标环境真实可用”之间的路径编译为可发现、可执行、可留证的控制回路。它保护：

- **真相在文本**：每个有发布面的项目维护一份本地 release runbook，记录项目事实；
- **行动跟文本**：零上下文执行者从项目 `docs/index.md` 找到该 runbook，再执行唯一入口；
- **底线在机器**：可确定的身份、制品、阶段和成功判据由脚本、权限或 CI 验证。

本页不替项目选择云厂商、商店、容器平台或发布命令，也不保存项目 AppID、主机、端口、凭据和环境路径。**通用合同在这里，项目事实留在项目仓库。**

## 项目必须回答的八项合同

| 字段 | 必须回答的问题 | 优先载体 |
|---|---|---|
| Target identity | 发布到哪个账号、应用、环境、区域或运行对象？ | 配置校验 + 目标端回读 |
| Artifact identity | 发布哪个不可变制品、完整 commit SHA、镜像 digest 或包哈希？ | 干净构建 + 结构化回执 |
| Canonical entrypoint | 唯一发布命令、项目配置和工作目录是什么？ | wrapper script |
| Stage boundaries | build、upload、review、release、rollout 哪些阶段存在，各自何时完成？ | 状态机/平台状态 |
| Authorization | 每个阶段谁可执行，哪些不可逆动作需要当次批准？ | IAM + approval |
| Success/failure evidence | 哪个目标端正向信号代表成功，哪些反向标记必须判失败？ | 输出解析 + API readback |
| Runtime readback | 发布后用哪个真实用户路径、健康探针或版本接口确认正在运行？ | smoke test/monitor |
| Rollback/stop/receipt | 何时停止、如何回滚、回执存在哪里且包含什么？ | runbook + 自动回执 |

项目存在发布面时，必须在本地建立唯一 release runbook，并从本地 `docs/index.md` 路由。没有发布面的项目不创建空模板，也不安装虚假门禁。

## 最小执行序列

1. **读身份**：目标账号/应用/环境与执行者身份必须显式读回，不凭窗口标题、旧日志或路径名猜测。
2. **冻结制品**：从 exact SHA、digest 或等价不可变标识生成干净制品；脏工作树只保留开发状态，不直接成为共享发布物。多 worktree 并发时尤其禁止“当前目录大概就是目标代码”。
3. **运行唯一入口**：命令显式接收目标、制品和阶段参数；供应商 CLI、配置文件和端口属于项目 runbook，不进入本页。
4. **同时验证正负信号**：shell exit code、CI green、GUI banner、preview 或 upload 都不能单独证明成功。只有目标端明确成功信号存在、已知失败信号不存在，才进入下一阶段。
5. **阶段分别记账**：upload 不等于 review，review 不等于 production release，release 不等于 rollout 健康。平台没有某阶段时可以裁剪，但不得合并仍然独立的状态。
6. **运行态回读**：读取实际运行版本并走至少一个真实消费路径；候选代码、控制面安装件、存储目标和运行对象分别对账。
7. **落结构化回执**：保存目标、制品、入口、阶段、开始/结束时间、正负判据、执行结果和回读证据。凭据和 token 不进入回执。

## 判定与授权

- 路径存在、SHA/digest、配置一致、目标 ID、输出标记、平台状态和回执字段可机器判断，应进入脚本、测试、权限或 CI。
- 发布说明、风险接受、业务时机和不可逆生产动作由 owner 判断；AI 不把一次语义判断伪装成硬门。
- 任何身份、授权、阶段或成功证据不确定时 fail closed。停止是有效结果，不用“看起来应该成功”补齐证据。

## 项目落地模板

项目可把以下结构实例化到自己的 release runbook；值必须来自项目事实，不照抄示例占位：

```yaml
release_contract:
  target: { account: "...", application: "...", environment: "..." }
  artifact: { kind: "commit|image|package", immutable_id: "..." }
  entrypoint: { command: "...", config: "...", working_directory: "..." }
  stages: [build, upload, review, release, rollout]
  authorization: { upload: "...", release: "..." }
  evidence: { success: ["..."], failure: ["..."] }
  runtime_readback: ["..."]
  rollback: { trigger: "...", command_or_runbook: "..." }
  receipt: { path: "...", required_fields: [target, artifact, stage, result, timestamps] }
```

## 准入与复审

发布治理沿用 [CORE 规则准入六问](../CORE.md#4-规则准入六问)：消费者是发布执行者和验收者；来源必须是真实发布面、合同或事故；机器门只覆盖可靠可判定项；载体尽量靠近发布动作；绕过需留痕；平台或发布面消失时删除相应项目规则。

同族判例先看：

- [成功信号本身要被验证](../governance/cases/2026-07-25-成功信号本身要被验证.md)；
- [发布控制面必须自证运行身份与安装版本](../governance/cases/2026-07-29-发布控制面必须自证运行身份与安装版本.md)。
