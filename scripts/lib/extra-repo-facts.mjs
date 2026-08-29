import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export const EXTRA_REPO_FACTS_REL = "docs/ops/extra-repo-facts.json";

const SECRET_PATTERNS = [
  { name: "g2a key", pattern: /\bg2a_[A-Za-z0-9]+/ },
  { name: "sk- prefix key", pattern: /\bsk-[A-Za-z0-9_-]{12,}/ },
  { name: "xai key", pattern: /\bxai-[A-Za-z0-9_-]{8,}/ },
  { name: "github token", pattern: /\bghp_[A-Za-z0-9]{20,}/ },
  { name: "bearer token", pattern: /Bearer\s+[A-Za-z0-9._-]{16,}/i },
  { name: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "password assignment", pattern: /(?:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*\S+/i },
];

const PRESENCE_VALUES = new Set(["local-required", "local-optional", "host-only"]);

function oneLine(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function expandFactPath(raw, { root, home = homedir() } = {}) {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (trimmed.startsWith("~/")) return join(home, trimmed.slice(2));
  if (trimmed === "~") return home;
  if (isAbsolute(trimmed)) return trimmed;
  return resolve(root, trimmed);
}

export function scanPointerSecrets(text, rel = EXTRA_REPO_FACTS_REL) {
  const errors = [];
  const source = String(text || "");
  for (const entry of SECRET_PATTERNS) {
    if (entry.pattern.test(source)) {
      errors.push(`${rel} 命中秘密模式（${entry.name}）——索引只写路径，禁止写入密钥或口令`);
    }
  }
  return errors;
}

export function loadExtraRepoFacts(root, { readFile = readFileSync } = {}) {
  const rel = EXTRA_REPO_FACTS_REL;
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    return {
      ok: false,
      missing: true,
      rel,
      errors: [`缺少 ${rel}——仓外正本必须有仓内路径索引（可为空列表）`],
      warnings: [],
      facts: [],
    };
  }
  let parsed;
  let text;
  try {
    text = readFile(abs, "utf8");
    parsed = JSON.parse(text);
  } catch (cause) {
    return {
      ok: false,
      missing: false,
      rel,
      errors: [`${rel} 不是可解析 JSON: ${cause instanceof Error ? cause.message : String(cause)}`],
      warnings: [],
      facts: [],
    };
  }
  const errors = scanPointerSecrets(text, rel);
  const warnings = [];
  if (parsed?.schemaVersion !== 1) errors.push(`${rel} schemaVersion 必须为 1`);
  if (!Array.isArray(parsed?.facts)) {
    errors.push(`${rel} 缺 facts 数组`);
    return { ok: false, missing: false, rel, errors, warnings, facts: [], parsed };
  }
  const ids = new Set();
  const facts = [];
  for (const [index, fact] of parsed.facts.entries()) {
    const at = `${rel} facts[${index}]`;
    if (!fact || typeof fact !== "object" || Array.isArray(fact)) {
      errors.push(`${at} 必须是对象`);
      continue;
    }
    for (const key of ["id", "class", "covers", "doesNotCover", "missing"]) {
      if (typeof fact[key] !== "string" || !fact[key].trim()) errors.push(`${at} 缺 ${key}`);
    }
    if (!Array.isArray(fact.paths) || fact.paths.length === 0 || fact.paths.some((path) => typeof path !== "string" || !path.trim())) {
      errors.push(`${at} paths 必须是非空字符串数组`);
    }
    if (fact.id) {
      if (ids.has(fact.id)) errors.push(`${at} id 重复: ${fact.id}`);
      ids.add(fact.id);
    }
    const presence = fact.presence || "local-required";
    if (!PRESENCE_VALUES.has(presence)) errors.push(`${at} presence 非法: ${presence}`);
    const decoys = Array.isArray(fact.decoys) ? fact.decoys : fact.decoys == null ? [] : null;
    if (decoys == null) {
      errors.push(`${at} decoys 必须是数组`);
      continue;
    }
    for (const [decoyIndex, decoy] of decoys.entries()) {
      if (!decoy || typeof decoy !== "object" || typeof decoy.path !== "string" || !decoy.path.trim()) {
        errors.push(`${at} decoys[${decoyIndex}] 缺 path`);
      }
    }
    facts.push({ ...fact, presence, decoys });
  }
  return { ok: errors.length === 0, missing: false, rel, errors, warnings, facts, parsed };
}

export function inspectExtraRepoFacts(root, options = {}) {
  const loaded = loadExtraRepoFacts(root, options);
  const home = options.home || homedir();
  const exists = options.existsSync || existsSync;
  const inspected = (loaded.facts || []).map((fact) => {
    const paths = (fact.paths || []).map((raw) => {
      const expanded = expandFactPath(raw, { root, home });
      return { raw, expanded, present: exists(expanded) };
    });
    const anyPresent = paths.some((path) => path.present);
    let status = "unloaded";
    if (anyPresent) status = "loaded";
    else if (fact.presence === "host-only") status = "remote-ok";
    else if (fact.presence === "local-optional") status = "optional-missing";
    return { ...fact, paths, anyPresent, status };
  });
  return { ...loaded, inspected };
}

export function formatExtraRepoFactsReport(inspectedResult, options = {}) {
  const compact = options.compact === true;
  if (inspectedResult.missing) {
    return "📂 仓外正本: 索引未安装 docs/ops/extra-repo-facts.json";
  }
  const items = inspectedResult.inspected || [];
  if (items.length === 0) {
    return "📂 仓外正本: 0 条登记（无仓外正本或尚未盘点）";
  }
  const loaded = items.filter((fact) => fact.status === "loaded").length;
  const unloaded = items.filter((fact) => fact.status === "unloaded").length;
  const lines = [`📂 仓外正本: ${items.length} 条登记 · 已装载 ${loaded} · 正本未装载 ${unloaded}`];
  if (compact) {
    for (const fact of items.filter((item) => item.status === "unloaded")) {
      const shown = fact.paths.map((path) => path.raw).join(" | ");
      lines.push(`- ${fact.class}: 正本未装载 ${shown}`);
      if (fact.missing) lines.push(`  缺失时: ${oneLine(fact.missing)}`);
    }
    return lines.join("\n");
  }
  for (const fact of items) {
    const shown = fact.paths.map((path) => path.raw).join(" | ");
    if (fact.status === "loaded") {
      const hit = fact.paths.filter((path) => path.present).map((path) => path.raw).join(" | ");
      lines.push(`- ${fact.class}: 已装载 ${hit} · 不覆盖 ${oneLine(fact.doesNotCover)}`);
    } else if (fact.status === "remote-ok") {
      lines.push(`- ${fact.class}: 本机未挂载（宿主机/远程正本 ${shown}）`);
    } else if (fact.status === "optional-missing") {
      lines.push(`- ${fact.class}: 本机无此文件（可选） ${shown}`);
    } else {
      lines.push(`- ${fact.class}: 正本未装载 ${shown}`);
      if (fact.missing) lines.push(`  缺失时: ${oneLine(fact.missing)}`);
    }
    for (const decoy of fact.decoys || []) {
      const avoided = decoy.doesNotCover ? `不管 ${oneLine(decoy.doesNotCover)}` : decoy.covers ? `只覆盖 ${oneLine(decoy.covers)}` : "";
      lines.push(`  易混替身: ${decoy.path}${avoided ? `（${avoided}）` : ""}`);
    }
  }
  return lines.join("\n");
}

export function lintExtraRepoFacts(root, options = {}) {
  const loaded = loadExtraRepoFacts(root, options);
  const errors = [...loaded.errors];
  const warnings = [...loaded.warnings];
  const exists = options.existsSync || existsSync;
  const home = options.home || homedir();
  const readFile = options.readFile || readFileSync;
  if (!loaded.missing) {
    for (const fact of loaded.facts) {
      for (const decoy of fact.decoys || []) {
        if (!decoy?.path) continue;
        const decoyAbs = expandFactPath(decoy.path, { root, home });
        const inRepo = !decoy.path.startsWith("~") && !isAbsolute(decoy.path);
        if (inRepo && !exists(decoyAbs)) {
          errors.push(`${loaded.rel} 易混替身文件不存在: ${decoy.path}`);
          continue;
        }
        if (decoy.mustContain) {
          try {
            const body = readFile(decoyAbs, "utf8");
            if (!body.includes(decoy.mustContain)) {
              errors.push(`${decoy.path} 必须声明「${decoy.mustContain}」——看起来完整的替身必须写明不覆盖的事实类`);
            }
          } catch {
            if (inRepo) errors.push(`${decoy.path} 无法读取，无法核对待身声明`);
          }
        }
      }
      if (fact.presence === "local-required") {
        const anyPresent = (fact.paths || []).some((raw) => exists(expandFactPath(raw, { root, home })));
        if (!anyPresent) {
          warnings.push(`仓外正本未在本机装载: ${fact.class}（${(fact.paths || []).join(" | ")}）。${fact.missing}`);
        }
      }
    }
  }
  return { errors, warnings };
}
