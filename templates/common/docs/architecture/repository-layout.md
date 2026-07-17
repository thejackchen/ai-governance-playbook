# 仓库结构地图

> 本页描述目录职责与依赖边界，不列举每个文件。新增顶层目录、新运行时或跨层依赖先写ADR，再更新本页和自动检查。

| 路径 | 所有者/职责 | 允许内容 | 禁止内容 | 验证 |
|---|---|---|---|---|
| `{{SOURCE_DIR}}/` | {{SOURCE_OWNER}} | {{SOURCE_ALLOWED}} | {{SOURCE_FORBIDDEN}} | {{SOURCE_CHECK}} |
| `docs/` | 项目知识投影 | 架构、决策、需求、运行说明 | 生成缓存、业务运行数据 | 链接lint |
| `scripts/` | 可重复执行的项目工具 | 验证、迁移、生成脚本 | 一次性临时输出 | 语法/测试 |
| `governance/` | 治理状态与策略 | policy、事故、问题、规则 | 产品业务正文 | governance lint |

## 顶层目录准入

`governance/policy.json`中的`allowedTopLevelEntries`非空时，governance lint会拒绝未知顶层项。存量项目先完成分类再启用，避免把历史混乱直接合法化。

## 生成物与临时文件

- 生成物放项目指定目录，并标记来源；CI检查漂移。
- 缓存、日志、临时导出放固定目录并加入`.gitignore`。
- 禁止在仓库根留下未登记的截图、报告、JSON导出或调试文件。
