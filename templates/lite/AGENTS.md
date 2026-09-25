# {{PROJECT_NAME}} · AI 执行宪法

治理铭牌见 `governance.lock.json`；唯一当前状态见 [{{ROADMAP_PATH}}]({{ROADMAP_PATH}})。

## 意图

待负责人填写：项目做什么、服务谁、当前取舍是什么。已有项目保留真实意图，不用模板重置。

## 红线

1. 不以删测试、放宽断言、skip 或伪造 mock 制造假全绿。
2. 不在验证证据与实际状态不一致时宣称完成。
3. 密钥、token、真实凭据不进入 git、日志或文档。
4. 一项事实只有一个正文正本；先读真实来源再判断，不凭替身补全。
5. 确定性红线落实到脚本、测试、权限或 CI，AI 建议不冒充硬门。
6. 不执行未经授权的不可逆操作；只提交范围明确、验证通过的改动。
7. 自动化测试与独立无上下文前向测试未通过，不发布新版本。

## 开工三步

1. 读 [{{ROADMAP_PATH}}]({{ROADMAP_PATH}}) 当前游标与 [docs/SESSION.md](docs/SESSION.md) 最近决策。
2. 检查 cwd、分支、HEAD 和工作树；保留别人的变更。
3. 按 [docs/index.md](docs/index.md) 找本任务正本；明确目标、边界与可证伪验收。

## 收尾四步

1. 运行项目自身检查/测试，并运行 `node scripts/governance.mjs check`。
2. 有代码或文档变化时更新 ROADMAP 当前游标与日期，写明结果、下一步、卡点。
3. 将新决策按 `- YYYY-MM-DD 内容` 写入 docs/SESSION.md，附验证证据和恢复坐标。
4. 报告真实结果与未验事项；获得提交授权才提交，不以本地检查代替部署或客户验收。

## 仓外正本路径表

| 类别 | 正本路径 | 使用边界 |
|---|---|---|
| 按项目事实登记 | 待填写（只写路径） | 未读取时明确“正本未装载”，不以仓内样例替代 |

## 指针

- 当前状态：[{{ROADMAP_PATH}}]({{ROADMAP_PATH}})
- 最近决策与交接：[docs/SESSION.md](docs/SESSION.md)
- 知识路由：[docs/index.md](docs/index.md)
- 机器检查：`scripts/governance.mjs check`；gitleaks 缺失即失败。建议接入已有 pre-commit。
