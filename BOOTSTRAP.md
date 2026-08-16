# 治理安装单一入口

这是给零上下文 AI 的确定性 runbook。目标是：在当前项目落下 AIOS 现行治理架构的通用部分——三句核心、字节一致的 `CLAUDE.md`/`AGENTS.md`、SessionStart 铭牌、认领门、Stop 收口提示、治理 lint 和 `governance.lock.json`。不要手工复制治理文件；所有落盘都由 `scripts/init.mjs` 完成。Codex 的 SessionStart 由 JSON 适配器包装同一份人类文本播报，写入 `.codex/hooks.json` 本身不等于生效，仍需 trusted + `/hooks` 审核当前哈希。

## 1. 确定当前项目

把待安装项目设为当前目录；如果 AI 已在项目根目录，直接执行：

```bash
PROJECT_DIR="${PROJECT_DIR:-$PWD}"
test -d "$PROJECT_DIR/.git" || test -f "$PROJECT_DIR/.git" || {
  echo "当前目录不是 Git 项目：$PROJECT_DIR" >&2
  exit 1
}
```

runtime 不凭 AI 自己猜。第 2 步让 playbook 可用后，必须调用它的 `scripts/lib.mjs` 中的 `detectRuntime()`；判定顺序是 `.codex`、`.claude`/`CLAUDE.md`、`CODEX_HOME`，否则为 `generic`。

## 2. 定位或克隆 playbook

`GOVERNANCE_PLAYBOOK_DIR` 与 SessionStart 使用同一个环境变量和默认目录：`~/working/ai-governance-playbook`。已是本 playbook checkout 就快进更新；目录不存在才克隆。已有但非法的目录不能覆盖：

```bash
GOVERNANCE_PLAYBOOK_DIR="${GOVERNANCE_PLAYBOOK_DIR:-$HOME/working/ai-governance-playbook}"

PLAYBOOK_NAME="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; try { console.log(JSON.parse(readFileSync(process.argv[1], "utf8")).name); } catch { console.log(""); }' "$GOVERNANCE_PLAYBOOK_DIR/package.json")"
if [ -e "$GOVERNANCE_PLAYBOOK_DIR/.git" ] \
  && [ -f "$GOVERNANCE_PLAYBOOK_DIR/CORE.md" ] \
  && [ "$PLAYBOOK_NAME" = "ai-governance-playbook" ]; then
  git -C "$GOVERNANCE_PLAYBOOK_DIR" pull --ff-only
else
  if [ -e "$GOVERNANCE_PLAYBOOK_DIR" ]; then
    echo "GOVERNANCE_PLAYBOOK_DIR 已存在但不是合法 playbook checkout，请换目录或由负责人处理：$GOVERNANCE_PLAYBOOK_DIR" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$GOVERNANCE_PLAYBOOK_DIR")"
  git clone https://github.com/thejackchen/ai-governance-playbook.git "$GOVERNANCE_PLAYBOOK_DIR"
fi
```

如果网络不可用，先把本仓库克隆到一个本地临时目录，再把该路径作为 `GOVERNANCE_PLAYBOOK_REMOTE` 交给 `scripts/bootstrap.mjs` 做等价验证；不要把业务仓库当 playbook。

## 3. 探测 runtime，并先看安装计划

用 playbook 的真实判定函数探测：

```bash
RUNTIME="$(cd "$GOVERNANCE_PLAYBOOK_DIR" && node --input-type=module -e 'import { detectRuntime } from "./scripts/lib.mjs"; console.log(detectRuntime(process.argv[1]));' "$PROJECT_DIR")"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
echo "runtime=$RUNTIME project=$PROJECT_DIR"
```

默认路径固定使用 `standard`，不把 profile 选择变成零上下文 AI 的额外决策。先执行 dry-run（不落盘）：

```bash
node "$GOVERNANCE_PLAYBOOK_DIR/scripts/init.mjs" \
  --target "$PROJECT_DIR" \
  --runtime "$RUNTIME" \
  --profile standard \
  --project-name "$PROJECT_NAME"
```

如果明确是一次性原型或极简场景，可以参照 [`setup.md` 的 Profile 说明](setup.md#0-先探测不猜) 改用其它 profile；本入口默认不走那条分支。

## 4. 写入并跑硬验证

确认 dry-run 计划没有要覆盖的项目事实后，加 `--write` 落盘：

```bash
node "$GOVERNANCE_PLAYBOOK_DIR/scripts/init.mjs" \
  --target "$PROJECT_DIR" \
  --runtime "$RUNTIME" \
  --profile standard \
  --project-name "$PROJECT_NAME" \
  --write
```

然后必须从 playbook checkout 运行 doctor 和治理 lint；任一命令不是 0 error 都不算完成：

```bash
node "$GOVERNANCE_PLAYBOOK_DIR/scripts/doctor.mjs" --target "$PROJECT_DIR"
node "$GOVERNANCE_PLAYBOOK_DIR/scripts/governance-lint.mjs" --root "$PROJECT_DIR"
```

Standard 及以上的新安装会包含 `scripts/claim.mjs` 与 `governance/claim-gate.md`；三个共享 hook 会在 `lite` 中动态跳过缺失的认领脚本，保留危险命令拦截。新安装的 `CLAUDE.md` 与 `AGENTS.md` 是同一份完整正文，不是桥接 stub。

新安装无论 `runtime` 探测结果为何，都会同时落下 `.claude/settings.json` 与 `.codex/{hooks.json,config.toml,rules/default.rules}`；`runtime` 仍只决定原生指令/桥接入口和 Codex 专属 CI 变体。单线或尚未按 CORE.md §2.5 分裂出 `docs/execution/branches/<slug>.md` 的项目，开普通认领时使用 `--line cross`（落到 `docs/index.md`）；只有真的分裂出对应分支文件后才使用具体 slug。

## 5. 填项目事实

按 [`setup.md` §2 填项目事实](setup.md#2-填项目事实) 完成 `TODO(owner)`、真实游标、架构/需求指针、策略和目录地图。不要用安装器默认文字冒充项目事实。

完成项目化后重新跑第 4 步的 doctor 和治理 lint；两者都全绿后再进入下一步。

## 6. 形成 Git 基线

全绿后先审查本次安装实际改变了什么：

```bash
git -C "$PROJECT_DIR" status --short
git -C "$PROJECT_DIR" diff --check
```

全新项目且确认工作树只有本次安装内容时，可以明确暂存并提交：

```bash
git -C "$PROJECT_DIR" add -A
git -C "$PROJECT_DIR" diff --cached --stat
git -C "$PROJECT_DIR" commit -m "chore: establish governance baseline"
```

存量项目只 `git add` 已审查的本次文件，不要用 `add -A` 带入无关改动。若负责人没有明确允许提交，先问负责人，拿到允许后再执行 `git commit`；不要把未提交的生成物冒充已定格基线。

## 7. 交安装报告

按 [`setup.md` §7 安装报告](setup.md#7-安装报告) 交付 runtime/profile、实际载体、未安装项、doctor/lint 与 Hook 证据、无上下文演练和仍可绕过的边界。报告必须区分“骨架已生成”“本地 fixture 通过”“Git 基线形成”和“远端 required check 生效”。

## 一命令入口

playbook 已经在本机可用时，也可以让 `gov-bootstrap` 负责定位/更新 checkout 并透传 init 参数；它默认补 `--profile standard`，但仍保持 dry-run，不自动加 `--write`：

```bash
node "$GOVERNANCE_PLAYBOOK_DIR/scripts/bootstrap.mjs" \
  --target "$PROJECT_DIR" \
  --runtime "$RUNTIME" \
  --project-name "$PROJECT_NAME"
```
