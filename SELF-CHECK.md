# 安装自检

> 每项附命令、输出或文件链接。`doctor`为0 error是最低线，不代表语义已经对齐。

## 运行时与单一真相

- [ ] runtime和Profile选择有风险依据，不是默认全装；
- [ ] Codex只有`AGENTS.md`正文，Claude Code只有`CLAUDE.md`正文，另一文件是桥接；
- [ ] 项目意图已由负责人确认；
- [ ] ROADMAP、架构、需求、目录结构各有唯一权威；
- [ ] `governance.lock.json`记录版本、runtime、profile和已安装文件。
- [ ] 已形成获授权的Git基线，或明确报告全部未跟踪/未提交文件；没有基线时不宣称可回退或Hook哈希稳定。

## 载体

- [ ] 每条核心规则写清trigger、predicate、effect、carrier和绕过；
- [ ] 需要物理禁止的规则优先落IAM、只读凭据、schema或API边界；
- [ ] Codex项目已trusted，并用`/hooks`审核当前Hook哈希；
- [ ] PreToolUse危险命令fixture真实被阻断；
- [ ] Stop验证失败时会要求修复，第二次仍失败会如实报告而不是无限循环；
- [ ] `.rules`用`codex execpolicy check`验证match/not_match（Codex）；
- [ ] pre-commit已启用或明确不安装（Standard及以上）；
- [ ] CI deterministic job真实运行；required check状态如实登记；
- [ ] AI review只读且不是唯一硬门禁。

## 内容审计

- [ ] 旧规则逐条完成保留/合并/降级/删除/升级载体判断；
- [ ] 没有“已废弃但仍像现行指令”的正文；
- [ ] 普通规则有消费者和来源；安全/合规预防规则有责任依据；
- [ ] 只读任务不被强制写CHANGELOG或commit；
- [ ] 规则预算符合Profile。

## 目录结构

- [ ] `repository-layout.md`覆盖所有顶层职责；
- [ ] 临时文件、缓存和生成物有固定位置和ignore；
- [ ] 启用`allowedTopLevelEntries`前已完成人工分类；
- [ ] 新顶层目录和跨层依赖需要ADR。

## 前端扩展（安装时才检查）

- [ ] 设计意图、token、组件和资产各有唯一权威；
- [ ] 多端token由结构化来源生成，不手工维护副本；
- [ ] 新设计原语有复用门和决策记录；
- [ ] 可访问性、响应式、关键交互和视觉回归有验证计划。

## 机器验证

```bash
npm test
npm run check
node scripts/doctor.mjs --target /path/to/project
```

- [ ] 全部0 error；warn有负责人、风险和处理期限；
- [ ] common模板、三个adapter和profile契约测试通过；
- [ ] 无上下文AI案例至少覆盖新项目、存量迁移和红线压力；
- [ ] 验收失败修载体，不修改期望答案迁就结果。

## 交付

- [ ] 报告列出装了什么、没装什么、为什么；
- [ ] 列出仍可绕过的边界；
- [ ] 负责人知道何时从Lite升级Standard或High Assurance；
- [ ] 变更已按授权提交，未夹带目标项目的无关改动。
