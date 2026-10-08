#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SCRIPT_VERSION = "1.0.0";
const DEFAULT_MAX_LOG_FILES = 8;
const DEFAULT_MAX_LOG_BYTES = 2 * 1024 * 1024;
const DEFAULT_LOOKBACK_HOURS = 168;
const MAX_SETTINGS_BYTES = 10 * 1024 * 1024;

function usage() {
  return `LS Doctor read-only diagnostic collector ${SCRIPT_VERSION}

Usage:
  node collect-diagnostics.mjs [--pretty]

Options:
  --pretty                 Pretty-print JSON.
  --platform <win32|darwin> Override platform for fixture tests.
  --config-root <path>     Inspect only this app-data root (repeatable).
  --install-root <path>    Inspect only this install/app path (repeatable).
  --no-system-probe        Skip processes, registry, permissions, and hardware helpers.
  --max-log-files <n>      Inspect at most n recent log files (default: 8, max: 20).
  --max-log-bytes <n>      Read at most n tail bytes per log (default: 2097152, max: 4194304).
  --lookback-hours <n>     Ignore logs older than n hours (default: 168, max: 720).
  --help                   Show this help.

The script writes JSON to stdout only. It never edits settings or emits raw log lines,
credentials, account state, device IDs, stream keys, server URLs, or record folders.`;
}

function parseArgs(argv) {
  const options = {
    pretty: false,
    platform: process.platform,
    configRoots: [],
    installRoots: [],
    systemProbe: true,
    maxLogFiles: DEFAULT_MAX_LOG_FILES,
    maxLogBytes: DEFAULT_MAX_LOG_BYTES,
    lookbackHours: DEFAULT_LOOKBACK_HOURS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--pretty") options.pretty = true;
    else if (arg === "--platform") options.platform = next();
    else if (arg === "--config-root") options.configRoots.push(path.resolve(next()));
    else if (arg === "--install-root") options.installRoots.push(path.resolve(next()));
    else if (arg === "--no-system-probe") options.systemProbe = false;
    else if (arg === "--max-log-files") options.maxLogFiles = Number.parseInt(next(), 10);
    else if (arg === "--max-log-bytes") options.maxLogBytes = Number.parseInt(next(), 10);
    else if (arg === "--lookback-hours") options.lookbackHours = Number.parseInt(next(), 10);
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (!new Set(["win32", "darwin"]).has(options.platform)) {
    throw new Error("LS Doctor currently supports --platform win32 or darwin.");
  }
  if (!Number.isInteger(options.maxLogFiles) || options.maxLogFiles < 0 || options.maxLogFiles > 20) {
    throw new Error("--max-log-files must be an integer from 0 to 20.");
  }
  if (!Number.isInteger(options.maxLogBytes) || options.maxLogBytes < 1024 || options.maxLogBytes > 4 * 1024 * 1024) {
    throw new Error("--max-log-bytes must be between 1024 and 4194304.");
  }
  if (!Number.isInteger(options.lookbackHours) || options.lookbackHours < 1 || options.lookbackHours > 720) {
    throw new Error("--lookback-hours must be an integer from 1 to 720.");
  }
  return options;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function exists(candidate) {
  try {
    return fs.existsSync(candidate);
  } catch {
    return false;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const redactionRoots = unique([
  process.env.USERPROFILE,
  process.env.HOME,
  process.env.APPDATA,
  process.env.LOCALAPPDATA,
]).sort((left, right) => right.length - left.length);

function scrubString(value) {
  let result = String(value).replace(/[\u0000-\u001f\u007f]/g, " ");
  for (const root of redactionRoots) {
    result = result.replace(new RegExp(escapeRegExp(root), "gi"), root === process.env.APPDATA
      ? "<APPDATA>"
      : root === process.env.LOCALAPPDATA
        ? "<LOCALAPPDATA>"
        : "<HOME>");
  }
  result = result
    .replace(/(bearer\s+)[a-z0-9._~-]+/gi, "$1<redacted>")
    .replace(/\bsk-[a-z0-9_-]{12,}\b/gi, "<redacted-secret>")
    .replace(/((?:password|passwd|token|cookie|authorization|stream[_ -]?key|server[_ -]?url)\s*[:=]\s*)[^\s,;]+/gi, "$1<redacted>")
    .replace(/(https?:\/\/[^\s?"'<>]+)\?[^\s"'<>]+/gi, "$1?<query-redacted>")
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, "<redacted-email>")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "<redacted-ip>");
  return result.length > 240 ? `${result.slice(0, 237)}...` : result;
}

function scrubDeviceLabel(value) {
  const result = scrubString(value).replace(/[\\/]+/g, " ").trim();
  return result.length > 80 ? `${result.slice(0, 77)}...` : result;
}

function redactPath(candidate) {
  return scrubString(path.resolve(candidate));
}

function safeStat(candidate) {
  try {
    return fs.statSync(candidate);
  } catch {
    return null;
  }
}

function run(command, args, timeout = 8_000) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      timeout,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function runJson(command, args, timeout = 8_000) {
  const output = run(command, args, timeout);
  if (!output) return null;
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

function discoverMatchingDirectories(starts, matcher, maxDepth = 3, maxResults = 40) {
  const results = [];
  let visited = 0;
  const queue = starts.filter(exists).map((directory) => ({ directory, depth: 0 }));

  while (queue.length && results.length < maxResults && visited < 1_200) {
    const current = queue.shift();
    visited += 1;
    let entries = [];
    try {
      entries = fs.readdirSync(current.directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const fullPath = path.join(current.directory, entry.name);
      if (matcher.test(entry.name)) results.push(fullPath);
      if (current.depth < maxDepth && !new Set(["node_modules", ".git", "Caches.db"]).has(entry.name)) {
        queue.push({ directory: fullPath, depth: current.depth + 1 });
      }
      if (results.length >= maxResults) break;
    }
  }
  return results;
}

function findNamedFiles(starts, fileName, maxDepth = 5, maxResults = 12) {
  const results = [];
  let visited = 0;
  const queue = starts.filter(exists).map((directory) => ({ directory, depth: 0 }));

  while (queue.length && results.length < maxResults && visited < 1_500) {
    const current = queue.shift();
    visited += 1;
    let entries = [];
    try {
      entries = fs.readdirSync(current.directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current.directory, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) results.push(fullPath);
      else if (entry.isDirectory() && !entry.isSymbolicLink() && current.depth < maxDepth) {
        queue.push({ directory: fullPath, depth: current.depth + 1 });
      }
      if (results.length >= maxResults) break;
    }
  }
  return results;
}

function defaultRoots(platform) {
  if (platform === "win32") {
    return {
      configRoots: unique([
        process.env.APPDATA && path.join(process.env.APPDATA, "TikTok LIVE Studio"),
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "TikTok LIVE Studio"),
      ]),
      installRoots: unique([
        process.env.ProgramFiles && path.join(process.env.ProgramFiles, "TikTok LIVE Studio"),
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "TikTok LIVE Studio"),
      ]),
    };
  }

  const home = os.homedir();
  const installRoots = [
    "/Applications/TikTok LIVE Studio.app",
    path.join(home, "Applications", "TikTok LIVE Studio.app"),
  ];
  let bundleId = "";
  for (const appPath of installRoots.filter(exists)) {
    const candidate = run("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleIdentifier", path.join(appPath, "Contents", "Info.plist")]);
    if (/^[a-z0-9.-]{3,200}$/i.test(candidate)) {
      bundleId = candidate;
      break;
    }
  }
  const libraryStarts = [
    path.join(home, "Library", "Application Support"),
    path.join(home, "Library", "Containers"),
    path.join(home, "Library", "Group Containers"),
    path.join(home, "Library", "Logs"),
    path.join(home, "Library", "Caches"),
  ];
  const explicit = [
    path.join(home, "Library", "Application Support", "TikTok LIVE Studio"),
    path.join(home, "Library", "Application Support", "TikTokLiveStudio"),
    path.join(home, "Library", "Logs", "TikTok LIVE Studio"),
    bundleId && path.join(home, "Library", "Application Support", bundleId),
    bundleId && path.join(home, "Library", "Logs", bundleId),
    bundleId && path.join(home, "Library", "Containers", bundleId, "Data", "Library", "Application Support"),
    bundleId && path.join(home, "Library", "Containers", bundleId, "Data", "Library", "Logs"),
  ];
  const discovered = discoverMatchingDirectories(
    libraryStarts,
    /(?:tiktok.*live.*studio|live.*studio.*tiktok)/i,
    3,
    40,
  );
  return {
    configRoots: unique([...explicit, ...discovered]),
    installRoots,
  };
}

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function safeValue(value) {
  if (typeof value === "boolean" || typeof value === "number" || value === null) return value;
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.slice(0, 8).map(safeValue);
  return undefined;
}

function projectObject(source, keys) {
  const result = {};
  if (!source || typeof source !== "object") return result;
  for (const key of keys) {
    if (!Object.hasOwn(source, key)) continue;
    const value = safeValue(source[key]);
    if (value !== undefined) result[key] = value;
  }
  return result;
}

const STREAM_FIELDS = [
  "gearId", "resolution", "secondResolution", "fps", "bitrateA", "bitrate", "use265",
  "videoEnc", "audioEnc", "videoSaveFormat", "rateControl", "gopSize", "streamDelay",
  "displayMode", "displayRatio",
];

const AUDIO_FIELDS = [
  "name", "volume", "isMute", "isHearVoice", "disabled", "audioType", "inputType",
  "system_mute", "system_volume", "isMono", "monitor_type", "enable_aec", "outputAudioType",
];

function projectAudioDevices(value) {
  const devices = Array.isArray(value) ? value : [];
  return devices.slice(0, 24).map((device) => {
    const projected = projectObject(device, AUDIO_FIELDS);
    if (typeof projected.name === "string") projected.name = scrubDeviceLabel(projected.name);
    return projected;
  });
}

function loadSettings(serviceFiles) {
  const failures = [];
  for (const serviceFile of serviceFiles) {
    try {
      const stat = safeStat(serviceFile);
      if (!stat?.isFile() || stat.size > MAX_SETTINGS_BYTES) {
        failures.push(`${redactPath(serviceFile)}: settings file missing or exceeds the 10 MiB safety cap`);
        continue;
      }
      const root = JSON.parse(fs.readFileSync(serviceFile, "utf8"));
      const state = parseMaybeJson(root?.StreamSetting?.state);
      if (!state || typeof state !== "object") {
        failures.push(`${redactPath(serviceFile)}: StreamSetting.state was not an object`);
        continue;
      }
      return {
        status: "loaded",
        source: redactPath(serviceFile),
        streamSettingVersion: safeValue(root?.StreamSetting?.version),
        stream: projectObject(state, STREAM_FIELDS),
        audio: {
          inputs: projectAudioDevices(state.audioInputs),
          outputs: projectAudioDevices(state.audioOutputs),
          appOutputs: projectAudioDevices(state.audioAppOutputs),
          pcmOutputs: projectAudioDevices(state.audioPcmOutputs),
        },
        privacyNote: "Projected allowlisted fields only; account services, IDs, record folders, keys, and raw config are excluded.",
      };
    } catch (error) {
      failures.push(`${redactPath(serviceFile)}: ${scrubString(error.message)}`);
    }
  }
  return {
    status: serviceFiles.length ? "unreadable" : "not-found",
    failures: failures.slice(0, 4),
    privacyNote: "No raw config content was emitted.",
  };
}

function collectLogFiles(configRoots, platform) {
  const found = [];
  let visited = 0;
  const queue = configRoots.filter(exists).map((directory) => ({ directory, depth: 0 }));
  while (queue.length && visited < 2_000) {
    const current = queue.shift();
    visited += 1;
    let entries = [];
    try {
      entries = fs.readdirSync(current.directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current.directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink() && current.depth < 6) {
        queue.push({ directory: fullPath, depth: current.depth + 1 });
      } else if (entry.isFile()) {
        const lowerPath = fullPath.toLowerCase();
        const extension = path.extname(entry.name).toLowerCase();
        const parentSegments = path.dirname(lowerPath).split(path.sep);
        const insideLogDirectory = parentSegments.some((segment) => /^logs?$/.test(segment));
        const insideBrowserStorage = parentSegments.some((segment) => new Set([
          "session storage", "local storage", "indexeddb", "cache", "code cache",
        ]).has(segment));
        if (insideLogDirectory || (!insideBrowserStorage && new Set([".log", ".txt"]).has(extension))) {
          found.push(fullPath);
        }
      }
    }
  }

  if (platform === "darwin") {
    const diagnosticRoot = path.join(os.homedir(), "Library", "Logs", "DiagnosticReports");
    try {
      for (const entry of fs.readdirSync(diagnosticRoot, { withFileTypes: true })) {
        if (entry.isFile() && /tiktok.*live.*studio|live.*studio.*tiktok/i.test(entry.name)) {
          found.push(path.join(diagnosticRoot, entry.name));
        }
      }
    } catch {
      // Diagnostic reports are optional.
    }
  }
  return unique(found);
}

function readTail(filePath, maxBytes) {
  const stat = safeStat(filePath);
  if (!stat?.isFile()) return "";
  const length = Math.min(stat.size, maxBytes);
  const buffer = Buffer.alloc(length);
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, "r");
    fs.readSync(descriptor, buffer, 0, length, Math.max(0, stat.size - length));
  } catch {
    return "";
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  let nulls = 0;
  for (const byte of buffer) if (byte === 0) nulls += 1;
  if (buffer.length && nulls / buffer.length > 0.05) return "";
  return buffer.toString("utf8");
}

const LOG_PATTERNS = {
  crash: /\b(?:fatal|crash(?:ed)?|unhandled\s+exception|access\s+violation)\b/gi,
  audio: /\b(?:audio|microphone|speaker|wasapi|coreaudio)\b[^\r\n]{0,120}\b(?:error|fail(?:ed|ure)?|unavailable|denied|lost|invalid)\b/gi,
  camera: /\b(?:camera|webcam|virtual\s*cam(?:era)?|video\s+device)\b[^\r\n]{0,120}\b(?:error|fail(?:ed|ure)?|unavailable|denied|busy|lost|invalid)\b/gi,
  network: /\b(?:network|upload|rtmp|socket|bandwidth|bitrate)\b[^\r\n]{0,120}\b(?:drop(?:ped)?|error|fail(?:ed|ure)?|timeout|disconnect|unstable|reset)\b/gi,
  encoder: /\b(?:encoder|encoding|nvenc|videotoolbox|qsv|amf)\b[^\r\n]{0,120}\b(?:overload|error|fail(?:ed|ure)?|unavailable|timeout|reset)\b/gi,
  memory: /\b(?:out\s+of\s+memory|memory\s+pressure|allocation\s+fail(?:ed|ure)?|oom)\b/gi,
  cohost: /\b(?:co-?host|linkmic|multi-?guest)\b[^\r\n]{0,120}\b(?:error|fail(?:ed|ure)?|timeout|disconnect|invalid)\b/gi,
  update: /\b(?:update|updater|version)\b[^\r\n]{0,120}\b(?:error|fail(?:ed|ure)?|rollback|corrupt|mismatch)\b/gi,
};

function countPattern(text, pattern) {
  pattern.lastIndex = 0;
  let count = 0;
  while (pattern.exec(text) && count < 10_000) count += 1;
  pattern.lastIndex = 0;
  return count;
}

function scanLogs(logFiles, maxFiles, maxBytes, lookbackHours) {
  const cutoff = Date.now() - lookbackHours * 60 * 60 * 1000;
  const candidates = logFiles
    .map((filePath) => ({ filePath, stat: safeStat(filePath) }))
    .filter((item) => item.stat?.isFile() && item.stat.mtimeMs >= cutoff)
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)
    .slice(0, maxFiles);

  const totals = Object.fromEntries(Object.keys(LOG_PATTERNS).map((key) => [key, 0]));
  const files = [];
  for (const item of candidates) {
    const text = readTail(item.filePath, maxBytes);
    const signals = {};
    for (const [key, pattern] of Object.entries(LOG_PATTERNS)) {
      const count = countPattern(text, pattern);
      signals[key] = count;
      totals[key] += count;
    }
    files.push({
      path: redactPath(item.filePath),
      sizeBytes: item.stat.size,
      modifiedAt: item.stat.mtime.toISOString(),
      bytesInspected: Buffer.byteLength(text, "utf8"),
      signals,
    });
  }
  return {
    filesInspected: files.length,
    lookbackHours,
    maxFiles,
    maxBytesPerFile: maxBytes,
    totals,
    files,
    privacyNote: "Counts only. Raw log lines are never included.",
  };
}

function collectProcessState(platform) {
  if (platform === "win32") {
    const output = run("tasklist.exe", ["/fo", "csv", "/nh"]);
    const names = [];
    for (const line of output.split(/\r?\n/)) {
      const match = line.match(/^"([^"]+)"/);
      if (match && /^(?:TikTok LIVE Studio|MediaSDK_Server)\.exe$/i.test(match[1])) names.push(match[1]);
    }
    return { running: names.length > 0, processNames: unique(names).slice(0, 8) };
  }
  const output = run("ps", ["-axo", "comm="]);
  const names = output.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(?:.*\/)?(?:TikTok LIVE Studio(?: Helper(?: \([^)]*\))?)?|MediaSDK_Server)$/i.test(line))
    .map((line) => path.basename(line));
  return { running: names.length > 0, processNames: unique(names).slice(0, 8) };
}

function collectWindowsDetails() {
  const uninstallScript = [
    "$roots=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
    "'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
    "'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*');",
    "$x=Get-ItemProperty $roots -ErrorAction SilentlyContinue | ",
    "Where-Object {$_.DisplayName -match 'TikTok.*LIVE Studio'} | Select-Object -First 1 ",
    "DisplayName,DisplayVersion,InstallLocation,Publisher; if($x){$x|ConvertTo-Json -Compress}",
  ].join("");
  const privacyScript = [
    "$b='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore';",
    "$m=(Get-ItemProperty \"$b\\microphone\" -ErrorAction SilentlyContinue).Value;",
    "$c=(Get-ItemProperty \"$b\\webcam\" -ErrorAction SilentlyContinue).Value;",
    "[pscustomobject]@{microphone=$m;camera=$c}|ConvertTo-Json -Compress",
  ].join("");
  const gpuScript = "@(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object Name,DriverVersion)|ConvertTo-Json -Compress";
  return {
    registration: runJson("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", uninstallScript]),
    privacy: runJson("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", privacyScript]),
    graphics: runJson("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", gpuScript]),
  };
}

function collectMacDetails(installRoots) {
  let registration = null;
  for (const appPath of installRoots.filter(exists)) {
    const info = path.join(appPath, "Contents", "Info.plist");
    const bundleId = run("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleIdentifier", info]);
    const executable = run("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleExecutable", info]);
    const version = run("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleShortVersionString", info]);
    const build = run("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleVersion", info]);
    const architectures = executable
      ? run("/usr/bin/lipo", ["-archs", path.join(appPath, "Contents", "MacOS", executable)]).split(/\s+/).filter(Boolean)
      : [];
    registration = {
      displayName: "TikTok LIVE Studio",
      bundleId: bundleId || null,
      version: version || null,
      build: build || null,
      architectures,
      installLocation: redactPath(appPath),
    };
    break;
  }

  const displays = runJson("system_profiler", ["SPDisplaysDataType", "-json"], 15_000);
  const audio = runJson("system_profiler", ["SPAudioDataType", "-json"], 15_000);
  const cameras = runJson("system_profiler", ["SPCameraDataType", "-json"], 15_000);

  const collectNames = (value, results = []) => {
    if (Array.isArray(value)) for (const item of value) collectNames(item, results);
    else if (value && typeof value === "object") {
      if (typeof value._name === "string") results.push(scrubString(value._name));
      for (const child of Object.values(value)) collectNames(child, results);
    }
    return unique(results).slice(0, 24);
  };

  return {
    registration,
    graphicsAndDisplays: collectNames(displays),
    audioDevices: collectNames(audio),
    cameraDevices: collectNames(cameras),
    permissionNote: "Check Camera, Microphone, and Screen & System Audio Recording in System Settings; the collector does not read or modify TCC.",
  };
}

function collectSystem(platform, installRoots, enabled) {
  const base = {
    platform,
    architecture: os.arch(),
    osType: os.type(),
    osRelease: os.release(),
    logicalCpuCount: os.cpus().length,
    cpuModel: scrubString(os.cpus()[0]?.model?.trim() || "unknown"),
    totalMemoryGiB: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
  };
  if (!enabled) return { ...base, probes: "skipped" };
  return {
    ...base,
    process: collectProcessState(platform),
    platformDetails: platform === "win32" ? collectWindowsDetails() : collectMacDetails(installRoots),
  };
}

function sanitizeTree(value) {
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map(sanitizeTree);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitizeTree(child)]));
  }
  return value;
}

function buildReport(options) {
  const defaults = defaultRoots(options.platform);
  const configRoots = unique(options.configRoots.length ? options.configRoots : defaults.configRoots);
  const installRoots = unique(options.installRoots.length ? options.installRoots : defaults.installRoots);
  const existingConfigRoots = configRoots.filter(exists);
  const existingInstallRoots = installRoots.filter(exists);
  const directServiceFiles = configRoots.flatMap((root) => [
    path.join(root, "TTStore", "services.json"),
    path.join(root, "services.json"),
  ]).filter(exists);
  const serviceFiles = unique([
    ...directServiceFiles,
    ...findNamedFiles(existingConfigRoots, "services.json", 5, 12),
  ]);
  const logFiles = collectLogFiles(existingConfigRoots, options.platform);
  const system = collectSystem(options.platform, installRoots, options.systemProbe);
  const running = system.process?.running ?? null;

  const warnings = [];
  if (running) warnings.push("TikTok LIVE Studio appears to be running. Keep changes read-only until the creator confirms they are offline.");
  if (!existingConfigRoots.length) warnings.push("No known app-data root was found. On macOS, report this as evidence-needed rather than assuming a Windows path.");
  if (!existingInstallRoots.length && !system.platformDetails?.registration) warnings.push("No install path was confirmed from the bounded checks.");

  return sanitizeTree({
    schemaVersion: "1.0",
    collectorVersion: SCRIPT_VERSION,
    generatedAt: new Date().toISOString(),
    readOnly: true,
    system,
    application: {
      installed: existingInstallRoots.length > 0 || Boolean(system.platformDetails?.registration),
      installCandidates: installRoots.map((candidate) => ({ path: redactPath(candidate), exists: exists(candidate) })),
      configCandidates: configRoots.map((candidate) => ({ path: redactPath(candidate), exists: exists(candidate) })),
      settings: loadSettings(serviceFiles),
      perAppRouting: {
        status: "requires-ui-review",
        note: options.platform === "win32"
          ? "Inspect the TikTok LIVE Studio and MediaSDK_Server rows in Windows Volume mixer; undocumented routing storage is not parsed."
          : "Inspect macOS Sound and any virtual or aggregate audio device in the UI.",
      },
    },
    logs: scanLogs(logFiles, options.maxLogFiles, options.maxLogBytes, options.lookbackHours),
    warnings,
    privacy: {
      emitted: "System/app version, architecture, hardware labels, projected settings, audio source labels/states, and log signal counts.",
      excluded: "Passwords, 2FA codes, cookies, tokens, account services, stream keys, server URLs, device IDs, record folders, raw configs, and raw log lines.",
      transmission: "None. The collector writes JSON to stdout only.",
    },
  });
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  }
  const report = buildReport(options);
  process.stdout.write(`${JSON.stringify(report, null, options.pretty ? 2 : 0)}\n`);
} catch (error) {
  process.stderr.write(`LS Doctor collector error: ${scrubString(error.message)}\n\n${usage()}\n`);
  process.exit(2);
}
