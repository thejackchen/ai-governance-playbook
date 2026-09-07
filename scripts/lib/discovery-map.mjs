#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./project-catalog.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CREDENTIAL_REGISTRY_ERROR = "CREDENTIAL_REGISTRY_INVALID";
const DISCOVERY_CONFIG_ERROR = "DISCOVERY_CONFIG_INVALID";
const ENTRY_ERROR = "DISCOVERY_ENTRY_INVALID";
const safePath = (value) => typeof value === "string" && value.trim() && !value.startsWith("/") &&
  !/[\\\u0000-\u001f\u007f*?\[\]{}]/u.test(value) &&
  !value.replace(/\/+$/u, "").split("/").some((part) => ["", ".", ".."].includes(part));
const oneLine = (value) => String(value ?? "").replace(/[\r\n\t]/gu, " ");
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function invalidCredentialRegistry() {
  const error = new Error("credential registry missing or invalid");
  error.code = CREDENTIAL_REGISTRY_ERROR;
  return error;
}

function invalidDiscoveryConfig() {
  const error = new Error("discovery IDs missing or invalid");
  error.code = DISCOVERY_CONFIG_ERROR;
  return error;
}

function invalidEntry() {
  const error = new Error("discovery entry missing or outside repository");
  error.code = ENTRY_ERROR;
  return error;
}

function validateSelectedMetadata(assets) {
  for (const asset of assets) {
    for (const key of ["aliases", "tags", "credentialRefs"]) {
      if (own(asset, key) && (!Array.isArray(asset[key]) || !asset[key].length || !asset[key].every((value) => typeof value === "string" && value.trim()))) {
        throw invalidDiscoveryConfig();
      }
    }
  }
}

function selectedDiscoveryIds(catalog, options = {}) {
  const configured = own(options, "discoveryIds") ? options.discoveryIds : catalog?.discoveryIds;
  if (!Array.isArray(configured) || configured.length === 0 || configured.some((id) => typeof id !== "string" || !id.trim())) {
    throw invalidDiscoveryConfig();
  }
  if (new Set(configured).size !== configured.length) throw invalidDiscoveryConfig();
  return configured;
}

/** Validate only credential IDs projected for selected objects. Paths and fact bodies are never read. */
function validateCredentialRefs(root, assets) {
  const references = assets.flatMap((asset) => Array.isArray(asset?.credentialRefs) ? asset.credentialRefs : []);
  if (!references.length) return;
  let registry;
  try {
    registry = JSON.parse(readFileSync(resolve(root, "docs/ops/extra-repo-facts.json"), "utf8"));
  } catch {
    throw invalidCredentialRegistry();
  }
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.facts)) throw invalidCredentialRegistry();
  const ids = new Set();
  for (const fact of registry.facts) {
    if (!fact || typeof fact !== "object" || Array.isArray(fact) || typeof fact.id !== "string" || !fact.id.trim() || ids.has(fact.id)) {
      throw invalidCredentialRegistry();
    }
    ids.add(fact.id);
  }
  if (references.some((reference) => !ids.has(reference))) throw invalidCredentialRegistry();
}

function validateEntries(root, assets) {
  let realRoot;
  try { realRoot = realpathSync(root); } catch { throw invalidEntry(); }
  for (const asset of assets) {
    if (!safePath(asset?.entry) || asset.entry.endsWith("/")) throw invalidEntry();
    const destination = resolve(root, asset.entry);
    if (!existsSync(destination)) throw invalidEntry();
    let realEntry;
    try { realEntry = realpathSync(destination); } catch { throw invalidEntry(); }
    const local = relative(realRoot, realEntry);
    if (local === ".." || local.startsWith("../") || isAbsolute(local) || !statSync(destination).isFile()) throw invalidEntry();
  }
}

/** Pure, bounded, allowlisted metadata projection; no external files or runtime checks. */
export function renderDiscoveryMap(catalog, options = {}) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.assets)) throw new Error("catalog schema missing or invalid");
  const ids = selectedDiscoveryIds(catalog, options);
  const assets = ids.map((id) => {
    const matches = catalog.assets.filter((candidate) => candidate?.id === id);
    if (matches.length !== 1) throw new Error("discovery ID missing or ambiguous");
    return matches[0];
  });
  validateSelectedMetadata(assets);
  const lines = [
    "🗺 项目发现地图（元数据，不是实时状态或操作授权）",
    "入口：docs/index.md → docs/architecture/project-catalog.json；详细事实只读对应正本。",
    "检索：node scripts/project-catalog.mjs --query <名称或别名>；--category <分类>；--related <资产ID>。无命中报缺，多命中保留候选。",
    "分类导航（统一入口 docs/architecture/project-catalog.json；下列命令按类筛选）：",
  ];
  for (const category of CATEGORIES) {
    const count = catalog.assets.filter((asset) => typeof asset?.category === "string" && (asset.category === category || asset.category.startsWith(`${category}/`))).length;
    lines.push(`- ${category}：${count} 项；--category '${category}'`);
  }
  const configuredRoots = Array.isArray(options.sourceRoots) ? options.sourceRoots : catalog.sourceRoots;
  lines.push(Array.isArray(configuredRoots)
    ? `声明范围（未在启动地图验证覆盖率）：项目提供 ${configuredRoots.length} 个 sourceRoots；其余范围未声明。`
    : "声明范围（未在启动地图验证覆盖率）：项目未提供 sourceRoots；不推测全仓或全盘覆盖。" );
  lines.push("重点对象（仅来自 discoveryIds；先读入口，凭据只按仓内登记ID定位，禁止输出正文）：");
  for (const asset of assets) {
    for (const field of ["purpose", "entry", "boundaries"]) {
      if (typeof asset[field] !== "string" || !asset[field].trim()) throw new Error("discovery object field missing");
    }
    lines.push(`- ${asset.id}｜别名：${(asset.aliases ?? []).map(oneLine).join("、") || "未登记"}`);
    lines.push(`  用途：${oneLine(asset.purpose)}；入口：${oneLine(asset.entry)}`);
    lines.push(`  凭据/通道ID：${(asset.credentialRefs ?? []).map(oneLine).join("、") || "缺少登记，不猜凭据"} → docs/ops/extra-repo-facts.json`);
    lines.push(`  边界：${oneLine(asset.boundaries)}`);
  }
  lines.push("地图只投影已声明对象，不读取仓外正文、不连接机器；未声明范围、实时状态和操作授权均需另行核验。");
  const maxLines = options.maxLines ?? 60;
  const maxBytes = options.maxBytes ?? 6144;
  const result = lines.join("\n");
  if (lines.length > maxLines || Buffer.byteLength(result, "utf8") > maxBytes) throw new Error("discovery map exceeds line/byte budget; objects not silently truncated");
  return result;
}

export function loadDiscoveryMap(root = ROOT, options = {}) {
  try {
    const catalog = JSON.parse(readFileSync(resolve(root, "docs/architecture/project-catalog.json"), "utf8"));
    const ids = selectedDiscoveryIds(catalog, options);
    const assets = ids.map((id) => {
      const matches = catalog.assets?.filter((candidate) => candidate?.id === id) ?? [];
      if (matches.length !== 1) throw invalidDiscoveryConfig();
      return matches[0];
    });
    validateSelectedMetadata(assets);
    validateEntries(root, assets);
    validateCredentialRefs(root, assets);
    return renderDiscoveryMap(catalog, options);
  } catch (error) {
    // Do not echo raw malformed metadata or file contents into session output.
    const reason = error.code === "ENOENT"
      ? "catalog或入口缺失"
      : error.code === CREDENTIAL_REGISTRY_ERROR
        ? "凭据登记缺失或无效"
        : error.code === DISCOVERY_CONFIG_ERROR
          ? "discoveryIds未配置或无效"
          : error.code === ENTRY_ERROR
            ? "重点对象入口缺失或越界"
            : "元数据无效或超出预算";
    return `🗺 项目发现地图：未装载（${reason}）。请从 docs/index.md 与 project-catalog.json 定位，禁止猜测凭据或运行目标。`;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(loadDiscoveryMap());
