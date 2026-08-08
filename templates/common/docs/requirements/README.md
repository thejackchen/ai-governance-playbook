# 需求系统说明（模板版）

本文件与 `docs/requirements/backlog.md` 共同定义最小可执行需求投影。

## 两种模式

- **local**（默认）：`docs/requirements/backlog.md` 按本文件语义维护需求；
  需包含 `## 进行中需求`。没有已受理需求时必须明确写
  `> 当前无已受理需求。`，不得伪造占位需求来换取绿灯。
- **external**：不写本地状态正文；`docs/index.md` 和运行时指令中的 `REQUIREMENTS_SOURCE`
  必须直接指向外部系统（Issue tracker、PRD、Jira/Asana、设计系统 backlog 等），
  并保留映射/证据字段。

## 校验准则（给 `governance-lint`）

- 本地模式：必须有至少一条格式化需求，或明确的空状态标记；不允许仅保留
  `TODO(owner)`，也不允许保留未替换的模板占位。
- 本地进行中需求与标记为交付的需求（`- [ ]`/`- [x]`）都要求字段 `source_refs`、`spec_refs`、`acceptance`、`evidence` 必须齐全；
  `evidence` 可临时为 `pending`，但仅未交付条目可用。`spec_refs` 相对 backlog 文件目录解析，且每个规格必须存在、非空、无占位内容。
- 外部模式：本地不得再维护状态字段；只保留指向外部系统的单一入口。
- 所有模式：要求有可追溯证据（evidence/acceptance）字段。

## governance/policy.json 配置（模板新增）

`governance/policy.json` 支持 requirements 合同：

```json
{
  "requirements": {
    "mode": "local",
    "source": "docs/requirements/backlog.md",
    "validator": []
  }
}
```

local 模式始终运行 kit 内置的 `scripts/requirements-check.mjs`；`validator` 仅可追加项目特有检查，不能替换内置 checker。external 模式必须为空。
