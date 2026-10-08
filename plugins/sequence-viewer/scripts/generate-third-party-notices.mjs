import { execFile } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const FIRST_PARTY_PREFIXES = ["@openai/"];
const NOTICE_FILE_PATTERN = /^(?:license|licence|copying|notice)(?:\..*)?$/i;

export async function generateThirdPartyNotices(outputPath) {
  const { stdout } = await execFileAsync(
    "pnpm",
    ["licenses", "list", "--prod", "--json"],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  const licenseGroups = JSON.parse(stdout);
  const dependencies = await collectDependencies(licenseGroups);
  await writeFile(outputPath, renderNotices(dependencies), "utf8");
}

async function collectDependencies(licenseGroups) {
  const dependenciesByKey = new Map();

  for (const entries of Object.values(licenseGroups)) {
    if (!Array.isArray(entries)) {
      continue;
    }

    for (const entry of entries) {
      if (
        typeof entry?.name !== "string" ||
        FIRST_PARTY_PREFIXES.some((prefix) => entry.name.startsWith(prefix))
      ) {
        continue;
      }

      const versions = Array.isArray(entry.versions)
        ? entry.versions.map((version) => String(version ?? "unknown")).sort()
        : ["unknown"];
      const license =
        typeof entry.license === "string" && entry.license.length > 0
          ? entry.license
          : "Unknown";
      const key = [entry.name, versions.join(","), license].join("\0");
      if (dependenciesByKey.has(key)) {
        continue;
      }

      dependenciesByKey.set(key, {
        name: entry.name,
        versions,
        license,
        homepage: typeof entry.homepage === "string" ? entry.homepage : "",
        notices: await readPackageNotices(entry.paths?.[0]),
      });
    }
  }

  return [...dependenciesByKey.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

async function readPackageNotices(packagePath) {
  if (typeof packagePath !== "string" || packagePath.length === 0) {
    return [];
  }

  try {
    const entries = (await readdir(packagePath))
      .filter((entry) => NOTICE_FILE_PATTERN.test(entry))
      .sort();
    return await Promise.all(
      entries.map(async (entry) => ({
        fileName: entry,
        text: (await readFile(path.join(packagePath, entry), "utf8")).trim(),
      })),
    );
  } catch {
    return [];
  }
}

function renderNotices(dependencies) {
  const noticeGroups = new Map();
  const missingNoticeFiles = [];

  for (const dependency of dependencies) {
    if (dependency.notices.length === 0) {
      missingNoticeFiles.push(dependency);
      continue;
    }

    for (const notice of dependency.notices) {
      if (notice.text.length === 0) {
        continue;
      }

      const group = noticeGroups.get(notice.text) ?? {
        packages: new Set(),
        fileNames: new Set(),
      };
      group.packages.add(formatPackage(dependency));
      group.fileNames.add(notice.fileName);
      noticeGroups.set(notice.text, group);
    }
  }

  const lines = [
    "# Third-Party Notices",
    "",
    "This file is generated from the installed production dependency graph when the marketplace bundle is built.",
    "OpenAI-authored components are covered by the plugin's LICENSE and are excluded from this third-party inventory.",
    "",
    "## Dependency Inventory",
    "",
    "| Package | Version | License | Homepage |",
    "| --- | --- | --- | --- |",
    ...dependencies.map(
      (dependency) =>
        `| ${escapeMarkdown(dependency.name)} | ${escapeMarkdown(dependency.versions.join(", "))} | ${escapeMarkdown(dependency.license)} | ${escapeMarkdown(dependency.homepage)} |`,
    ),
    "",
    "## Included License And Notice Texts",
    "",
  ];

  let index = 1;
  for (const [noticeText, group] of noticeGroups) {
    lines.push(
      `### Notice ${index}`,
      "",
      `Used by: ${[...group.packages].sort().join(", ")}`,
      "",
      `Source files: ${[...group.fileNames].sort().map((name) => `\`${name}\``).join(", ")}`,
      "",
      ...noticeText.split("\n").map((line) => `    ${line}`),
      "",
    );
    index += 1;
  }

  if (missingNoticeFiles.length > 0) {
    lines.push(
      "## Packages Without A Root License Or Notice File",
      "",
      "The package manager reported the SPDX-style license identifiers below, but no root license or notice file was present in the installed package.",
      "",
      ...missingNoticeFiles.map(
        (dependency) =>
          `- ${formatPackage(dependency)}: ${escapeMarkdown(dependency.license)}`,
      ),
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}

function formatPackage(dependency) {
  return `\`${escapeMarkdown(dependency.name)}@${escapeMarkdown(dependency.versions.join(","))}\``;
}

function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

const currentFilePath = fileURLToPath(import.meta.url);
if (
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === currentFilePath
) {
  const outputArgIndex = process.argv.indexOf("--output");
  const outputPath = process.argv[outputArgIndex + 1];
  if (outputArgIndex === -1 || outputPath == null || outputPath.trim() === "") {
    throw new Error("Usage: node generate-third-party-notices.mjs --output <path>");
  }
  await generateThirdPartyNotices(outputPath);
}
