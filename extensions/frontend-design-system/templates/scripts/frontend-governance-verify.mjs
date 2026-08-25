#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, join, relative, resolve } from "node:path";

const allowedModes = new Set(["fast", "ci"]);
const argv = process.argv.slice(2);
for (const arg of argv) if (!arg.startsWith("--") || !allowedModes.has(arg.slice(2))) usage(arg);
if (argv.length !== 1) usage(argv.length ? argv[0] : "");

const mode = argv[0].slice(2);
const root = process.cwd();
const policyPath = join(root, "governance/frontend-policy.json");
const structuralErrors = [];
let policy = null;

if (!existsSync(policyPath)) {
  structuralErrors.push("缺少 governance/frontend-policy.json");
} else {
  try {
    policy = JSON.parse(readFileSync(policyPath, "utf8"));
  } catch (error) {
    structuralErrors.push(`governance/frontend-policy.json 无法解析: ${error.message}`);
  }
}

if (!isRecord(policy)) {
  if (existsSync(policyPath)) structuralErrors.push("frontend policy 必须是对象");
} else {
  validatePolicy(policy);
}

if (structuralErrors.length) {
  for (const error of structuralErrors) console.error(`[frontend-governance] STRUCTURE ERROR ${error}`);
  console.error(`[frontend-governance] lifecycle structure blocked: ${structuralErrors.length} error`);
  process.exit(1);
}

const checks = policy.checks.filter((check) => check.modes.includes(mode));
const reports = [];
const blockingFailures = [];

console.log(`[frontend-governance] lifecycle=${policy.lifecycle} mode=${mode} checks=${checks.length}`);
for (const check of checks) {
  const result = spawnSync(check.command, {
    cwd: root,
    shell: true,
    stdio: "inherit",
    encoding: "utf8"
  });
  const status = result.error ? `error: ${result.error.message}` : `exit ${result.status ?? "signal"}`;
  if (result.status === 0) {
    console.log(`[frontend-governance] PASS ${check.id} ${check.name}`);
    continue;
  }

  const failure = `${check.id} ${check.name} (${status})`;
  if (policy.lifecycle === "enforced" && check.enforcement === "block") blockingFailures.push(failure);
  else reports.push(failure);
}

for (const report of reports) console.warn(`[frontend-governance] REPORT ${report}`);
for (const failure of blockingFailures) console.error(`[frontend-governance] BLOCK ${failure}`);

if (reports.length || blockingFailures.length) {
  console.log(`[frontend-governance] ${reports.length} report / ${blockingFailures.length} blocking failure`);
}
if (blockingFailures.length) process.exit(1);
console.log(`[frontend-governance] ${policy.lifecycle} ${mode} 通过`);

function validatePolicy(value) {
  if (value.schemaVersion !== 1) structuralErrors.push("schemaVersion 必须为 1");
  const lifecycles = new Set(["reference-pending", "shadow", "enforced"]);
  if (!lifecycles.has(value.lifecycle)) structuralErrors.push(`lifecycle 必须为 reference-pending、shadow 或 enforced: ${value.lifecycle}`);

  if (!isRecord(value.authority)) {
    structuralErrors.push("authority 必须是对象");
  } else {
    for (const key of ["designSystem", "tokens", "referencePack", "surfaces"]) {
      const fullPath = validateExistingPath(value.authority[key], `authority.${key}`);
      if (key === "designSystem" && fullPath) validateDesignSystem(fullPath);
      if (key === "tokens" && fullPath) validateTokenLayers(fullPath);
      if (key === "referencePack" && fullPath) validateReferencePack(fullPath);
    }
  }

  validateRepresentativeJourneys(value.representativeJourneys, value.lifecycle);

  if (!Array.isArray(value.generatedOutputs)) {
    structuralErrors.push("generatedOutputs 必须是数组");
  } else {
    for (const [index, output] of value.generatedOutputs.entries()) validateGeneratedOutput(output, index);
  }

  if (!Array.isArray(value.checks)) {
    structuralErrors.push("checks 必须是数组");
  } else {
    const ids = new Set();
    for (const [index, check] of value.checks.entries()) {
      if (!isRecord(check)) {
        structuralErrors.push(`checks[${index}] 必须是对象`);
        continue;
      }
      if (!nonEmptyString(check.id)) structuralErrors.push(`checks[${index}].id 必须是非空字符串`);
      else if (ids.has(check.id)) structuralErrors.push(`checks.id 重复: ${check.id}`);
      else ids.add(check.id);
      if (!nonEmptyString(check.name)) structuralErrors.push(`checks[${index}].name 必须是非空字符串`);
      if (!Array.isArray(check.modes) || !check.modes.length || !check.modes.every((item) => allowedModes.has(item))) {
        structuralErrors.push(`checks[${index}].modes 必须是 fast/ci 的非空数组`);
      }
      if (!nonEmptyString(check.command) || /[\r\n]/.test(check.command)) structuralErrors.push(`checks[${index}].command 必须是单行非空字符串`);
      if (!new Set(["report", "block"]).has(check.enforcement)) {
        structuralErrors.push(`checks[${index}].enforcement 必须为 report 或 block`);
      }
    }
    if (value.lifecycle === "enforced") {
      if (!value.checks.length) structuralErrors.push("enforced lifecycle 不能使用空 checks");
      else if (!value.checks.some((check) => isRecord(check) && check.enforcement === "block")) {
        structuralErrors.push("enforced lifecycle 至少需要一个 enforcement=block 的配置门禁");
      }
    }
  }

  validateVisualRegression(value.visualRegression, value.checks);
}

function validateVisualRegression(value, checks) {
  if (!isRecord(value)) {
    structuralErrors.push("visualRegression 必须是对象");
    return;
  }
  if (typeof value.enabled !== "boolean") structuralErrors.push("visualRegression.enabled 必须是布尔值");
  if (!nonEmptyString(value.checkId)) structuralErrors.push("visualRegression.checkId 必须是非空字符串");
  if (!nonEmptyString(value.baselinePath)) structuralErrors.push("visualRegression.baselinePath 必须是非空字符串");
  if (value.enabled) {
    if (!Array.isArray(checks) || !checks.some((check) => isRecord(check) && check.id === value.checkId)) {
      structuralErrors.push(`visualRegression.checkId 不在 checks 中: ${value.checkId}`);
    }
    validateExistingPath(value.baselinePath, "visualRegression.baselinePath", { fileOrDirectory: true });
  }
}

function validateGeneratedOutput(value, index) {
  if (typeof value === "string") {
    validateRelativePath(value, `generatedOutputs[${index}]`);
    return;
  }
  if (!isRecord(value)) {
    structuralErrors.push(`generatedOutputs[${index}] 必须是路径字符串或对象`);
    return;
  }
  if (!nonEmptyString(value.source)) structuralErrors.push(`generatedOutputs[${index}].source 必须是非空字符串`);
  else validateExistingPath(value.source, `generatedOutputs[${index}].source`);
  if (!Array.isArray(value.outputs) || !value.outputs.length || !value.outputs.every(nonEmptyString)) {
    structuralErrors.push(`generatedOutputs[${index}].outputs 必须是非空字符串数组`);
  } else {
    for (const [outputIndex, output] of value.outputs.entries()) validateRelativePath(output, `generatedOutputs[${index}].outputs[${outputIndex}]`);
  }
}

function validateRelativePath(value, label) {
  if (!nonEmptyString(value)) {
    structuralErrors.push(`${label} 必须是非空相对路径`);
    return null;
  }
  if (isAbsolute(value)) {
    structuralErrors.push(`${label} 必须是仓库内相对路径: ${value}`);
    return null;
  }
  const rel = relative(root, resolve(root, value));
  if (rel.startsWith("..") || isAbsolute(rel)) structuralErrors.push(`${label} 越出项目根目录: ${value}`);
  return rel;
}

function validateExistingPath(value, label, { fileOrDirectory = false } = {}) {
  if (!nonEmptyString(value)) {
    structuralErrors.push(`${label} 必须是非空相对路径`);
    return null;
  }
  if (isAbsolute(value)) {
    structuralErrors.push(`${label} 必须是仓库内相对路径: ${value}`);
    return null;
  }
  const fullPath = resolve(root, value);
  const rel = relative(root, fullPath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    structuralErrors.push(`${label} 越出项目根目录: ${value}`);
    return null;
  }
  if (!existsSync(fullPath)) structuralErrors.push(`${label} 不存在: ${value}`);
  else {
    const stats = statSync(fullPath);
    if (!stats.isFile() && !(fileOrDirectory && stats.isDirectory())) {
      structuralErrors.push(`${label} 必须指向文件${fileOrDirectory ? "或目录" : ""}: ${value}`);
    }
  }
  return fullPath;
}

function validateTokenLayers(filePath) {
  let tokens;
  try {
    tokens = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    structuralErrors.push(`tokens 无法解析: ${error.message}`);
    return;
  }
  for (const layer of ["primitive", "semantic", "component"]) {
    if (!isRecord(tokens[layer]) || !Object.keys(tokens[layer]).length) {
      structuralErrors.push(`tokens 缺少非空 ${layer} 层`);
    }
  }
}

function validateReferencePack(filePath) {
  let body;
  try {
    body = readFileSync(filePath, "utf8");
  } catch (error) {
    structuralErrors.push(`referencePack 无法读取: ${error.message}`);
    return;
  }
  for (const layer of ["baseSystem", "industryPatterns", "brandLayer"]) {
    if (!new RegExp(`^###\\s+${layer}\\s*$`, "m").test(body)) {
      structuralErrors.push(`referencePack 缺少 ${layer} 三层来源段`);
    }
  }
}

function validateDesignSystem(filePath) {
  let body;
  try {
    body = readFileSync(filePath, "utf8");
  } catch (error) {
    structuralErrors.push(`designSystem 无法读取: ${error.message}`);
    return;
  }
  for (const heading of [
    "设计意图",
    "设计语言",
    "信息层级",
    "页面族与代表链路",
    "组件、状态与边界",
    "验证与晋级",
  ]) {
    if (!new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*$`, "m").test(body)) {
      structuralErrors.push(`designSystem 缺少 ## ${heading}`);
    }
  }
}

function validateRepresentativeJourneys(value, lifecycle) {
  if (!Array.isArray(value)) {
    structuralErrors.push("representativeJourneys 必须是数组");
    return;
  }
  const ids = new Set();
  for (const [index, journey] of value.entries()) {
    if (!isRecord(journey)) {
      structuralErrors.push(`representativeJourneys[${index}] 必须是对象`);
      continue;
    }
    if (!nonEmptyString(journey.id)) {
      structuralErrors.push(`representativeJourneys[${index}].id 必须是非空字符串`);
    } else if (ids.has(journey.id)) {
      structuralErrors.push(`representativeJourneys.id 重复: ${journey.id}`);
    } else {
      ids.add(journey.id);
    }
    if (!nonEmptyStringArray(journey.surfaces)) {
      structuralErrors.push(`representativeJourneys[${index}].surfaces 必须是非空字符串数组`);
    }
    if (!nonEmptyStringArray(journey.states)) {
      structuralErrors.push(`representativeJourneys[${index}].states 必须是非空字符串数组`);
    }
    if (!Array.isArray(journey.evidence) || !journey.evidence.every(nonEmptyString)) {
      structuralErrors.push(`representativeJourneys[${index}].evidence 必须是字符串路径数组`);
    } else {
      for (const [evidenceIndex, evidence] of journey.evidence.entries()) {
        validateExistingPath(evidence, `representativeJourneys[${index}].evidence[${evidenceIndex}]`, { fileOrDirectory: true });
      }
    }
    if (lifecycle !== "reference-pending" && (!Array.isArray(journey.evidence) || journey.evidence.length === 0)) {
      structuralErrors.push(`representativeJourneys[${index}].evidence 在 ${lifecycle} lifecycle 必须至少有一条证据路径`);
    }
  }
  if (lifecycle !== "reference-pending" && value.length === 0) {
    structuralErrors.push(`${lifecycle} lifecycle 至少需要一个 representative journey`);
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function nonEmptyStringArray(value) {
  return stringArray(value) && value.length > 0 && value.every(nonEmptyString);
}

function usage(bad) {
  if (bad) console.error(`[frontend-governance] 未知参数: ${bad}`);
  console.error("用法: node scripts/frontend-governance-verify.mjs [--ci|--fast]");
  process.exit(2);
}
