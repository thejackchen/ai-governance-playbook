import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

const KINDS = new Set(["component", "runtime", "external-repository", "guide"]);
export const CATEGORIES = new Set(["产品与业务", "架构与数据", "产品设计", "软件开发与范例", "Git与CI/CD", "环境与接入", "安全与凭据", "运行维护"]);
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const safePath = (value) => nonempty(value) && !value.startsWith("/") &&
  !/[\\\u0000-\u001f\u007f*?\[\]{}]/u.test(value) &&
  !value.replace(/\/+$/u, "").split("/").some((part) => ["", ".", ".."].includes(part));
const normalizeScope = (value) => String(value).replace(/\/+$/u, "");
const within = (path, scope) => path === scope || path.startsWith(`${scope}/`);

function readScopeConfig(catalog, options, key, errors) {
  const configured = own(options, key) ? options[key] : catalog?.[key];
  if (configured === undefined) return { declared: false, valid: true, values: [] };
  if (!Array.isArray(configured) || configured.some((value) => !safePath(value))) {
    errors.push(`project-catalog: ${key} must be an array of safe relative paths`);
    return { declared: true, valid: false, values: [] };
  }
  const values = configured.map(normalizeScope);
  if (new Set(values).size !== values.length) errors.push(`project-catalog: duplicate ${key} declaration`);
  return { declared: true, valid: true, values };
}

function readWorkstreamConfig(catalog, options, errors) {
  const configured = own(options, "workstreamDirectory") ? options.workstreamDirectory : catalog?.workstreamDirectory;
  if (configured === undefined) return { declared: false, valid: true, value: "" };
  if (!safePath(configured)) {
    errors.push("project-catalog: workstreamDirectory must be a safe relative directory");
    return { declared: true, valid: false, value: "" };
  }
  return { declared: true, valid: true, value: normalizeScope(configured) };
}

function readDiscoveryConfig(catalog, options, errors) {
  const configured = own(options, "discoveryIds") ? options.discoveryIds : catalog?.discoveryIds;
  if (configured === undefined) return { declared: false, values: [] };
  if (!Array.isArray(configured) || configured.some((value) => !nonempty(value))) {
    errors.push("project-catalog: discoveryIds must be an array of nonempty strings");
    return { declared: true, values: [] };
  }
  if (new Set(configured).size !== configured.length) errors.push("project-catalog: duplicate discoveryIds declaration");
  return { declared: true, values: [...configured] };
}

function loadCredentialIds(root, assets, errors) {
  if (!assets.some((asset) => asset && own(asset, "credentialRefs"))) return undefined;
  try {
    const facts = JSON.parse(readFileSync(resolve(root, "docs/ops/extra-repo-facts.json"), "utf8"));
    if (facts?.schemaVersion !== 1 || !Array.isArray(facts.facts)) throw new Error("Invalid facts");
    const ids = new Set();
    for (const fact of facts.facts) {
      if (!fact || typeof fact !== "object" || Array.isArray(fact) || !nonempty(fact.id) || ids.has(fact.id)) throw new Error("Invalid fact ID");
      ids.add(fact.id);
    }
    return ids;
  } catch {
    errors.push("project-catalog: credentialRefs registry missing or invalid (docs/ops/extra-repo-facts.json)");
    return new Set();
  }
}

/**
 * Validate repository-owned catalog declarations. Source coverage is checked
 * only for explicitly configured sourceRoots; an omitted scope is reported as
 * unknown rather than silently treating the whole repository as in scope.
 * externalPath values are pointers and are never opened.
 */
export function inspectProjectCatalog(root, options = {}) {
  const errors = [];
  const coverage = {
    source: { total: 0, covered: 0, uncovered: [], overlapping: [], unknownUniverse: true },
    workstreams: { total: 0, covered: 0, uncovered: [], unknownUniverse: true },
    external: { declared: 0, complete: 0, unknownUniverse: true },
  };
  let catalog;
  let tracked;
  try {
    catalog = JSON.parse(readFileSync(resolve(root, "docs/architecture/project-catalog.json"), "utf8"));
  } catch (error) {
    errors.push(`project-catalog: cannot read catalog (${error.code ?? error.name})`);
    return { errors, coverage };
  }
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog?.assets)) {
    errors.push("project-catalog: schemaVersion must be 1 and assets must be an array");
    return { errors, coverage };
  }
  const sourceRoots = readScopeConfig(catalog, options, "sourceRoots", errors);
  const sourceCollections = readScopeConfig(catalog, options, "sourceCollections", errors);
  const workstreamDirectory = readWorkstreamConfig(catalog, options, errors);
  const discovery = readDiscoveryConfig(catalog, options, errors);
  try {
    tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  } catch {
    errors.push("project-catalog: cannot enumerate Git tracked files");
    return { errors, coverage };
  }
  const uniqueTracked = [...new Set(tracked)];
  const workstreamPrefix = workstreamDirectory.value ? `${workstreamDirectory.value}/` : "";
  const workstreamFiles = workstreamDirectory.declared && workstreamDirectory.valid
    ? uniqueTracked.filter((file) => file.startsWith(workstreamPrefix) && file.slice(workstreamPrefix.length).length > 0 && !file.slice(workstreamPrefix.length).includes("/") && file.endsWith(".md"))
    : [];
  const branches = workstreamFiles.map((file) => file.slice(workstreamPrefix.length, -3));
  const scopedFiles = sourceRoots.declared && sourceRoots.valid
    ? uniqueTracked.filter((file) => sourceRoots.values.some((scope) => within(file, scope)))
    : [];
  coverage.source.unknownUniverse = !sourceRoots.declared || !sourceRoots.valid;
  coverage.workstreams = { total: 0, covered: 0, uncovered: [], unknownUniverse: !workstreamDirectory.declared || !workstreamDirectory.valid };
  const files = sourceRoots.declared ? scopedFiles : [];
  const owners = new Map(files.map((file) => [file, []]));
  const referenced = new Set();
  const ids = new Set();
  const idLabels = new Map();
  const invalidLabels = new Set();
  const externalLabels = [];
  const relations = [];
  let realRoot;
  try {
    realRoot = realpathSync(root);
  } catch (error) {
    errors.push(`project-catalog: repository root unavailable (${error.code ?? error.name})`);
    return { errors, coverage };
  }
  const credentialIds = loadCredentialIds(root, catalog.assets, errors);

  if (sourceRoots.declared && sourceRoots.valid && sourceRoots.values.length) {
    for (const scope of sourceRoots.values) {
      const full = resolve(root, scope);
      let present = false;
      try {
        const real = realpathSync(full);
        present = real.startsWith(`${realRoot}${sep}`) && statSync(real).isDirectory();
      } catch { /* Explicit roots must exist; report below without reading outside. */ }
      if (!present) errors.push(`project-catalog: sourceRoots path unavailable: ${scope}`);
    }
  }
  if (sourceCollections.declared && sourceCollections.valid && sourceRoots.declared && sourceRoots.valid) {
    for (const collection of sourceCollections.values) {
      if (!sourceRoots.values.some((scope) => within(collection, scope))) {
        errors.push(`project-catalog: sourceCollections path outside sourceRoots: ${collection}`);
      }
    }
  }
  if (workstreamDirectory.declared && workstreamDirectory.valid) {
    const full = resolve(root, workstreamDirectory.value);
    let present = false;
    try {
      const real = realpathSync(full);
      present = real.startsWith(`${realRoot}${sep}`) && statSync(real).isDirectory();
    } catch { /* Explicit workstream directories must exist; report below. */ }
    if (!present) errors.push(`project-catalog: workstreamDirectory unavailable: ${workstreamDirectory.value}`);
  }

  for (const [index, asset] of catalog.assets.entries()) {
    const label = `project-catalog asset ${index + 1}`;
    const before = errors.length;
    if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
      errors.push(`${label}: must be an object`);
      continue;
    }
    for (const key of ["id", "kind", "purpose", "entry", "owner", "boundaries"]) {
      if (!nonempty(asset[key])) errors.push(`${label}: missing/non-string ${key}`);
    }
    if (!KINDS.has(asset.kind)) errors.push(`${label}: invalid kind`);
    if (asset.category !== undefined && (!nonempty(asset.category) ||
      ![...CATEGORIES].some((category) => asset.category === category || asset.category.startsWith(`${category}/`)) ||
      asset.category.split("/").some((part) => !nonempty(part) || part !== part.trim()))) {
      errors.push(`${label}: category must be a known task domain with nonempty path segments`);
    }
    for (const key of ["aliases", "tags", "credentialRefs"]) {
      if (asset[key] !== undefined && (!Array.isArray(asset[key]) || !asset[key].length || !asset[key].every(nonempty))) {
        errors.push(`${label}: ${key} must be a nonempty string array`);
      }
    }
    for (const reference of Array.isArray(asset.credentialRefs) ? asset.credentialRefs : []) {
      if (!credentialIds?.has(reference)) errors.push(`${label}: unknown credentialRefs ID`);
    }
    if (nonempty(asset.id)) {
      if (ids.has(asset.id)) {
        errors.push(`${label}: duplicate id ${asset.id}`);
        invalidLabels.add(idLabels.get(asset.id));
      } else idLabels.set(asset.id, label);
      ids.add(asset.id);
    }
    let validEntry = false;
    if (safePath(asset.entry) && !asset.entry.endsWith("/") && uniqueTracked.includes(asset.entry)) {
      try {
        const entry = realpathSync(resolve(root, asset.entry));
        validEntry = entry.startsWith(`${realRoot}${sep}`) && statSync(entry).isFile();
      } catch { /* Missing canonical entry is reported below. */ }
    }
    if (!validEntry) errors.push(`${label}: invalid or missing repository entry (must be Git tracked)`);
    for (const key of ["sourcePaths", "workstreams", "links"]) {
      if (asset[key] !== undefined && (!Array.isArray(asset[key]) || !asset[key].every(nonempty))) {
        errors.push(`${label}: ${key} must be a string array`);
      }
    }
    for (const source of Array.isArray(asset.sourcePaths) ? asset.sourcePaths : []) {
      const sourcePath = safePath(source) ? normalizeScope(source) : "";
      const insideRoot = sourceRoots.declared && sourceRoots.values.some((scope) => within(sourcePath, scope));
      const broad = sourceCollections.values.some((collection) => sourcePath === collection);
      if (!sourcePath || broad || (sourceRoots.declared && !insideRoot)) {
        errors.push(`${label}: invalid or broad sourcePath ${String(source)}`);
        continue;
      }
      const matches = uniqueTracked.filter((file) => source.endsWith("/") ? file.startsWith(source) : file === source);
      if (!matches.length) errors.push(`${label}: sourcePath has no tracked match: ${source}`);
      for (const file of matches) if (owners.has(file)) owners.get(file).push(asset.id ?? label);
    }
    for (const branch of Array.isArray(asset.workstreams) ? asset.workstreams : []) {
      if (!coverage.workstreams.unknownUniverse && !branches.includes(branch)) errors.push(`${label}: unknown workstream ${String(branch)}`);
      else if (!coverage.workstreams.unknownUniverse) referenced.add(branch);
    }
    for (const target of Array.isArray(asset.links) ? asset.links : []) relations.push([label, target]);
    if (asset.externalPath !== undefined && !nonempty(asset.externalPath)) errors.push(`${label}: externalPath must be a nonempty string`);
    if (asset.kind === "external-repository") {
      coverage.external.declared++;
      externalLabels.push(label);
      if (!nonempty(asset.externalPath)) errors.push(`${label}: external repository requires externalPath`);
    }
    if (errors.length !== before) invalidLabels.add(label);
  }
  for (const [label, target] of relations) {
    if (!ids.has(target)) {
      errors.push(`${label}: dangling asset link`);
      invalidLabels.add(label);
    }
  }
  for (const id of discovery.values) {
    if (!ids.has(id)) errors.push(`project-catalog: unknown discovery ID`);
  }
  coverage.source.total = files.length;
  for (const [file, assigned] of owners) {
    if (!assigned.length) coverage.source.uncovered.push(file);
    else if (assigned.length > 1) {
      coverage.source.overlapping.push(file);
      for (const id of assigned) invalidLabels.add(idLabels.get(id));
    } else coverage.source.covered++;
  }
  coverage.workstreams.total = branches.length;
  coverage.workstreams.covered = referenced.size;
  coverage.workstreams.uncovered = branches.filter((branch) => !referenced.has(branch));
  for (const file of coverage.source.uncovered) errors.push(`project-catalog: uncovered source ${file}`);
  for (const file of coverage.source.overlapping) errors.push(`project-catalog: overlapping source ownership ${file}`);
  for (const branch of coverage.workstreams.uncovered) errors.push(`project-catalog: uncovered workstream ${branch}`);
  coverage.external.complete = externalLabels.filter((label) => !invalidLabels.has(label)).length;
  return { errors, coverage };
}
