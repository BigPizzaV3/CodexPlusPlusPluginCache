#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, readFile, realpath, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";

const allowedFlags = new Set(["agent-tools", "archive-sha256", "id", "kind", "package", "project", "version"]);
const values = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const flag = process.argv[index];
  if (!flag?.startsWith("--")) fail(`invalid argument: ${flag ?? "end of command"}`);
  const key = flag.slice(2);
  if (!allowedFlags.has(key)) fail(`unknown flag: ${flag}`);
  if (values.has(key)) fail(`duplicate flag: ${flag}`);
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) fail(`missing value for ${flag}`);
  values.set(key, value);
  index += 1;
}

const project = resolve(values.get("project") ?? process.cwd());
const packageName = values.get("package");
const requestedVersion = values.get("version");
const requestedArchiveSha256 = values.get("archive-sha256");
const kind = values.get("kind");
const id = values.get("id");
if (!packageName) fail("--package is required");
if (!["@flowstack-ui/atom", "@flowstack-ui/brick", "@flowstack-ui/colors", "@flowstack-ui/theme"].includes(packageName)) fail(`unsupported public Agent Tools package: ${packageName}`);
if (requestedVersion && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(requestedVersion)) fail("--version must be one exact package version");
if (requestedArchiveSha256 && !/^[a-f0-9]{64}$/u.test(requestedArchiveSha256)) fail("--archive-sha256 must be one lowercase SHA-256 digest");
if ((kind && !id) || (!kind && id)) fail("--kind and --id must be supplied together");
if (kind && !["guide", "component", "operation"].includes(kind)) fail(`unsupported owner kind: ${kind}`);

const projectRequire = createRequire(join(project, "package.json"));
let installedPackagePath;
let manifestPath;
try {
  manifestPath = projectRequire.resolve(`${packageName}/agents/manifest.json`);
} catch {}
try {
  installedPackagePath = projectRequire.resolve(`${packageName}/package.json`);
} catch {}
if (!installedPackagePath && manifestPath) installedPackagePath = await findPackageJson(manifestPath);
if (!installedPackagePath) {
  try {
    installedPackagePath = await findPackageJson(projectRequire.resolve(packageName));
  } catch {}
}

let installedPackage = null;
if (installedPackagePath) {
  installedPackage = await readJson(installedPackagePath);
  if (installedPackage.name !== packageName) fail(`installed package identity does not match ${packageName}`);
  if (!requestedArchiveSha256 && requestedVersion && requestedVersion !== installedPackage.version) {
    fail(`installed ${packageName}@${installedPackage.version} does not match requested ${requestedVersion}`);
  }
  if (manifestPath && !requestedArchiveSha256) {
    const result = await resolveInstalled(installedPackage, installedPackagePath, manifestPath);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(0);
  }
}

if (!installedPackage && !requestedVersion) {
  fail(`--version is required when ${packageName} is not exactly installed`);
}

const toolsIndexPath = await findAgentToolsIndex();
if (toolsIndexPath) {
  const result = await resolveDelivery(toolsIndexPath, installedPackage);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(0);
}

const exactVersion = requestedVersion ?? installedPackage?.version;
fail(`AGENT_KNOWLEDGE_UNAVAILABLE: no exact installed Agent Knowledge or Agent Tools route for ${packageName}@${exactVersion}`);

async function resolveInstalled(packageJson, packageJsonPath, unresolvedManifestPath) {
  const packageRoot = dirname(await realpath(packageJsonPath));
  const manifestPath = await containedFile(packageRoot, unresolvedManifestPath, "installed manifest");
  const manifest = await readJson(manifestPath);
  if (manifest.schema !== "flowstack.agent-manifest.v1") fail(`unsupported Agent Knowledge manifest schema in ${manifestPath}`);
  assertIdentity(manifest, packageJson.name, packageJson.version, "manifest");
  if (typeof manifest.coverage !== "string" || !manifest.coverage) fail("manifest coverage link is missing");
  const coveragePath = await existingArtifact(manifestPath, manifest.coverage, "coverage");
  const coverage = await readJson(coveragePath);
  if (coverage.schema !== "flowstack.agent-coverage.v1") fail(`unsupported Agent Knowledge coverage schema in ${coveragePath}`);
  assertIdentity(coverage, packageJson.name, packageJson.version, "coverage");
  validateInstalledClosure(manifest, coverage);

  const packageGuides = [];
  for (const entry of manifest.guides) packageGuides.push(await installedGuide(manifest, manifestPath, entry));

  return {
    schema: "flowstack.agent-skill-resolution.v1",
    source: "installed-package",
    sourceIdentity: { kind: "installed-package", packageJsonPath, archiveSha256: null },
    package: packageJson.name,
    version: packageJson.version,
    manifestPath,
    coveragePath,
    packageGuides,
    selected: kind ? await installedSelection(manifest, coverage, manifestPath, packageGuides) : null,
  };
}

function validateInstalledClosure(manifest, coverage) {
  const summary = coverage.summary;
  if (!summary || typeof summary !== "object") fail("coverage summary is missing");
  requireEqualCount(summary, "publicSurfaces", "classifiedPublicSurfaces");
  for (const key of ["unclassified", "invalidExclusions", "unresolvedSelections"]) requireZero(summary, key);
  for (const [key, value] of Object.entries(summary)) {
    if (/^(?:unclassified|invalid|unresolved)/u.test(key) && value !== 0) fail(`coverage counter ${key} must be zero`);
  }
  if (!Array.isArray(coverage.failures) || coverage.failures.length !== 0) fail(`coverage is not closed for ${coverage.package}@${coverage.packageVersion}`);

  const guides = exactEntries(manifest.guides, "manifest guides", { nonempty: true });
  const coveredGuides = coveredEntries(coverage.guides, "coverage guides");
  sameIds(guides, coveredGuides, "guide");
  requireCount(summary, "packageGuides", guides.length);
  for (const guide of guides) {
    const covered = coveredGuides.find((entry) => entry.id === guide.id);
    const json = covered.manifestPaths?.json ?? covered.json;
    const markdown = covered.manifestPaths?.markdown ?? covered.markdown;
    if (json !== guide.json || markdown !== guide.markdown) fail(`guide ${guide.id} manifest and coverage artifacts do not match`);
  }

  const components = exactEntries(manifest.components ?? [], "manifest components");
  const coveredComponents = coveredEntries(coverage.components, "coverage components");
  sameIds(components, coveredComponents, "component");
  requireEqualCount(summary, "componentOwners", "guidedComponentOwners");
  requireCount(summary, "componentOwners", components.length);
  const operations = exactEntries(manifest.operations ?? [], "manifest operations");
  const coveredOperations = coveredEntries(coverage.operations ?? [], "coverage operations");
  sameIds(operations, coveredOperations, "operation");
  const items = exactEntries(manifest.registryItems ?? [], "manifest registry items");
  const coveredItems = coveredEntries(coverage.registryItems ?? [], "coverage registry items");
  sameIds(items, coveredItems, "registry item");
  const owners = coveredEntries(coverage.owners ?? [], "coverage owners");

  const profile = coverage.profile?.kind ?? ((coverage.layer === "atom" || coverage.layer === "brick") ? "component-package" : null);
  if (profile === "component-package") {
    if (coverage.profile && coverage.profile.ownerUnit !== "component") fail("component-package ownerUnit must be component");
    if (operations.length || items.length || owners.length) fail("component package has non-component owners");
    return;
  }

  for (const key of ["invalidRegistryItems", "unresolvedDependencies"]) requireZero(summary, key);
  requireEqualCount(summary, "ownerUnits", "guidedOwnerUnits");
  requireCount(summary, "ownerUnits", owners.length);

  if (profile === "operation-package") {
    if (coverage.profile?.ownerUnit !== "operation") fail("operation-package ownerUnit must be operation");
    if (operations.length === 0) fail("manifest operations must be a nonempty array");
    if (items.length) fail("operation package has registry owners");
    sameIds(operations, owners, "operation owner");
    requireEqualCount(summary, "operationOwners", "guidedOperationOwners");
    requireCount(summary, "operationOwners", operations.length);
    requireCount(summary, "registryItems", 0);
    requireCount(summary, "guidedRegistryItems", 0);
    for (const operation of operations) {
      if (!guides.some((guide) => guide.json === operation.guide)) fail(`operation ${operation.id} has an unresolved guide`);
    }
    return;
  }

  fail(`unsupported coverage profile: ${profile ?? "missing"}`);
}

async function installedGuide(manifest, manifestPath, entry) {
  const jsonPath = await existingArtifact(manifestPath, entry.json, `guide ${entry.id} JSON`);
  const markdownPath = await existingArtifact(manifestPath, entry.markdown, `guide ${entry.id} Markdown`);
  const machine = await readJson(jsonPath);
  assertMachineArtifact(machine, { schema: "flowstack.agent-guide.v1", id: entry.id, packageName: manifest.package, kind: "guide" });
  return { id: entry.id, json: jsonPath, markdown: markdownPath };
}

async function installedSelection(manifest, coverage, manifestPath, packageGuides) {
  const collection = kind === "guide" ? manifest.guides : kind === "component" ? manifest.components : kind === "operation" ? manifest.operations : manifest.registryItems;
  const matches = (collection ?? []).filter((candidate) => candidate.id === id);
  if (matches.length !== 1) fail(`AGENT_KNOWLEDGE_UNAVAILABLE: ${manifest.package}@${manifest.packageVersion} has no unique ${kind} ${id}`);
  const entry = matches[0];
  if (kind === "guide") {
    const guide = packageGuides.find((candidate) => candidate.id === id);
    return { package: manifest.package, kind, ...guide };
  }
  if (kind === "operation") {
    const guideEntry = manifest.guides.find((candidate) => candidate.json === entry.guide);
    if (!guideEntry) fail(`operation ${id} has an unresolved guide`);
    const guide = packageGuides.find((candidate) => candidate.id === guideEntry.id);
    return { package: manifest.package, kind, id, guideId: guide.id, json: guide.json, markdown: guide.markdown };
  }
  const jsonReference = entry.json ?? entry.agentJson;
  const markdownReference = entry.markdown ?? entry.agentMarkdown;
  const jsonPath = await existingArtifact(manifestPath, jsonReference, `${kind} ${id} JSON`);
  const markdownPath = await existingArtifact(manifestPath, markdownReference, `${kind} ${id} Markdown`);
  const machine = await readJson(jsonPath);
  if (kind === "component") {
    assertMachineArtifact(machine, { schema: "flowstack.agent-component.v1", id, packageName: manifest.package, kind });
  } else if (machine.$schema !== "flowstack.block-agent.v1" || machine.id !== id) {
    fail(`selected block artifact identity does not match ${manifest.package} ${id}`);
  }
  return { package: manifest.package, kind, id, json: jsonPath, markdown: markdownPath };
}

async function resolveDelivery(unresolvedIndexPath, installedPackage) {
  const indexPath = await containedFile(dirname(unresolvedIndexPath), unresolvedIndexPath, "Agent Tools index");
  const index = await readJson(indexPath);
  if (index.schema !== "flowstack.agent-delivery-index.v1") fail(`unsupported Agent Tools index schema in ${indexPath}`);
  const exactVersion = requestedVersion ?? installedPackage?.version;
  if (!exactVersion) fail(`--version is required when ${packageName} is not exactly installed`);
  const records = index.packages.filter((entry) => entry.name === packageName && entry.version === exactVersion);
  if (records.length !== 1) fail(`AGENT_KNOWLEDGE_UNAVAILABLE: Agent Tools has no unique exact route for ${packageName}@${exactVersion}`);
  const record = records[0];
  validateDeliveryRecord(record);

  const routes = index.routes.filter((route) => route.package === record.id && route.version === record.version);
  const keys = new Set();
  const paths = new Set();
  for (const route of routes) {
    const key = `${route.kind}:${route.id}`;
    if (keys.has(key) || paths.has(route.path)) fail(`Agent Tools has duplicate routes for ${packageName}@${record.version}`);
    keys.add(key);
    paths.add(route.path);
  }
  const expectedCounts = { guide: record.counts.guides, component: record.counts.components, operation: record.counts.operations, package: 1 };
  for (const [routeKind, count] of Object.entries(expectedCounts)) {
    if (routes.filter((route) => route.kind === routeKind).length !== count) fail(`Agent Tools ${routeKind} route count does not match ${packageName}@${record.version}`);
  }

  const publicRoot = dirname(indexPath);
  const packageRoute = routes.find((route) => route.kind === "package" && route.path === record.route);
  if (!packageRoute) fail(`AGENT_KNOWLEDGE_UNAVAILABLE: Agent Tools package route is missing for ${packageName}@${record.version}`);
  const guideRoutes = routes.filter((route) => route.kind === "guide");
  if (guideRoutes.length === 0) fail(`Agent Tools has no mandatory package guides for ${packageName}@${record.version}`);
  const packageGuides = [];
  for (const route of guideRoutes) packageGuides.push(await deliveryArtifact(publicRoot, route, record));

  let selected = null;
  if (kind) {
    const matches = routes.filter((candidate) => candidate.kind === kind && candidate.id === id);
    if (matches.length !== 1) fail(`AGENT_KNOWLEDGE_UNAVAILABLE: Agent Tools has no unique ${kind} ${id} for ${packageName}@${record.version}`);
    selected = await deliveryArtifact(publicRoot, matches[0], record);
  }
  return {
    schema: "flowstack.agent-skill-resolution.v1",
    source: "agent-tools-route",
    sourceIdentity: { kind: "locked-archive", archiveSha256: record.archiveSha256 },
    package: packageName,
    version: record.version,
    indexPath,
    packageRoute: await deliveryArtifact(publicRoot, packageRoute, record, { identity: false }),
    packageGuides,
    selected,
  };
}

function validateDeliveryRecord(record) {
  if (!/^[a-f0-9]{64}$/u.test(record.archiveSha256 ?? "")) fail(`Agent Tools archive digest is invalid for ${packageName}@${record.version}`);
  if (requestedArchiveSha256 && record.archiveSha256 !== requestedArchiveSha256) {
    fail(`AGENT_KNOWLEDGE_UNAVAILABLE: archive digest does not match ${packageName}@${record.version}`);
  }
  const coverage = record.coverage;
  if (!coverage || coverage.failures !== 0 || coverage.publicSurfaces !== coverage.classifiedPublicSurfaces) {
    fail(`AGENT_KNOWLEDGE_UNAVAILABLE: Agent Tools coverage is not closed for ${packageName}@${record.version}`);
  }
  if (!record.counts || !Number.isInteger(record.counts.guides) || record.counts.guides <= 0) fail(`Agent Tools guide count is invalid for ${packageName}@${record.version}`);
  for (const key of ["components", "operations"]) if (!Number.isInteger(record.counts[key]) || record.counts[key] < 0) fail(`Agent Tools ${key} count is invalid`);
  const profile = record.profile;
  if (profile?.kind === "component-package" && profile.ownerUnit === "component") {
    if (record.counts.components <= 0 || record.counts.operations !== 0) fail("Agent Tools component profile counts are inconsistent");
  } else if (profile?.kind === "operation-package" && profile.ownerUnit === "operation") {
    if (record.counts.operations <= 0 || record.counts.components !== 0) fail("Agent Tools operation profile counts are inconsistent");
  } else {
    fail(`unsupported Agent Tools coverage profile for ${packageName}@${record.version}`);
  }
}

async function deliveryArtifact(publicRoot, route, record, { identity = true } = {}) {
  const lexicalPath = resolve(publicRoot, route.path.replace(/^\//u, ""));
  const path = await containedFile(publicRoot, lexicalPath, `Agent Tools route ${route.path}`);
  const content = await readFile(path);
  const digest = createHash("sha256").update(content).digest("hex");
  if (!Number.isInteger(route.bytes) || content.length !== route.bytes || !/^[a-f0-9]{64}$/u.test(route.sha256) || digest !== route.sha256) {
    fail(`AGENT_KNOWLEDGE_UNAVAILABLE: Agent Tools route integrity failed for ${route.path}`);
  }
  if (identity) {
    const text = content.toString("utf8");
    if (!text.includes(`\nSource: ${record.name}@${record.version}\n`) || !text.includes(`\nKind: ${route.kind}\n`) || !text.includes(`\nID: ${route.id}\n`)) {
      fail(`Agent Tools route identity does not match ${record.name} ${route.kind} ${route.id}`);
    }
  }
  return { package: record.name, kind: route.kind, id: route.id, route: route.path, path };
}

async function findAgentToolsIndex() {
  const supplied = values.get("agent-tools");
  if (supplied) {
    const target = resolve(supplied);
    const info = await stat(target).catch(() => null);
    if (!info) return null;
    if (!info.isDirectory()) return target;
    for (const candidate of [join(target, "public", "index.json"), join(target, "index.json")]) {
      if (await access(candidate).then(() => true).catch(() => false)) return candidate;
    }
    return null;
  }
  try {
    return projectRequire.resolve("@flowstack-ui/agent-tools/index.json");
  } catch {
    return null;
  }
}

async function existingArtifact(manifestPath, artifact, label) {
  if (typeof artifact !== "string" || !artifact) fail(`${label} path is missing`);
  const base = dirname(manifestPath);
  const path = resolve(base, artifact);
  const relativePath = relative(base, path);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`)) fail(`escaping manifest artifact: ${artifact}`);
  return containedFile(base, path, label);
}

async function containedFile(root, path, label) {
  const rootPath = await realpath(root);
  const filePath = await realpath(path).catch(() => null);
  if (!filePath) fail(`${label} is missing`);
  const relativePath = relative(rootPath, filePath);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`)) fail(`${label} escapes its authority root`);
  const info = await stat(filePath);
  if (!info.isFile()) fail(`${label} is not a file`);
  return filePath;
}

function assertMachineArtifact(machine, expected) {
  if (machine.schema !== expected.schema || machine.id !== expected.id || machine.package !== expected.packageName || machine.kind !== expected.kind) {
    fail(`selected artifact identity does not match ${expected.packageName} ${expected.kind} ${expected.id}`);
  }
}

function assertIdentity(value, name, version, label) {
  if (value.package !== name || value.packageVersion !== version) fail(`${label} identity does not match installed ${name}@${version}`);
}

function exactEntries(entries, label, { nonempty = false } = {}) {
  if (!Array.isArray(entries) || (nonempty && entries.length === 0)) fail(`${label} must be ${nonempty ? "a nonempty" : "an"} array`);
  const ids = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id || ids.has(entry.id)) fail(`${label} has a missing or duplicate id`);
    ids.add(entry.id);
  }
  return entries;
}

function coveredEntries(entries, label) {
  const result = exactEntries(entries, label);
  if (result.some((entry) => entry.status !== "covered")) fail(`${label} contains an uncovered owner`);
  return result;
}

function sameIds(left, right, label) {
  const leftIds = left.map(({ id }) => id).sort();
  const rightIds = right.map(({ id }) => id).sort();
  if (JSON.stringify(leftIds) !== JSON.stringify(rightIds)) fail(`${label} manifest and coverage ids do not match`);
}

function requireCount(summary, key, expected) {
  if (!Number.isInteger(summary[key]) || summary[key] !== expected) fail(`coverage counter ${key} must equal ${expected}`);
}

function requireEqualCount(summary, left, right) {
  if (!Number.isInteger(summary[left]) || !Number.isInteger(summary[right]) || summary[left] !== summary[right]) fail(`coverage counters ${left} and ${right} must match`);
}

function requireZero(summary, key) {
  requireCount(summary, key, 0);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function findPackageJson(start) {
  let directory = dirname(start);
  while (true) {
    const candidate = join(directory, "package.json");
    const json = await readJson(candidate).catch(() => null);
    if (json?.name === packageName) return candidate;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
