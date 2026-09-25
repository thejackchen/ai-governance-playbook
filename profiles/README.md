# 治理 Profile

默认 Lite：短宪法、当前游标、最近决策、按工具接线、单脚本机器防线。双工具约 12 文件、≤800 行；项目原有测试、权限和发布门继续负责实际风险。

Standard 与 High Assurance 保留为显式 **v4 兼容路径**，由 init-v4/doctor-v4 维护旧接口与回归测试。它们仍包含历史许可、发现、需求、认领、周报等行为，不符合 Lite 预算，不因项目“成熟”而自动升级过去。

```sh
node scripts/init.mjs --target /path/to/project --tools claude-code,codex --write
node scripts/init.mjs --target /path/to/project --profile standard --runtime codex --write
node scripts/init.mjs --target /path/to/project --profile high-assurance --runtime codex --write
```

保留兼容路径的原因：存量恢复必须可重复，旧行为正反测试仍要能真实执行；不以删除它们制造测试全绿。新安装与迁移流程见 [BOOTSTRAP](../BOOTSTRAP.md)。
