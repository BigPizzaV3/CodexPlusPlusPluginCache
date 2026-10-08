import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

export interface CliSourcePermissions {
  codex: boolean;
  claude: boolean;
  git: boolean;
}

export interface DevRecapCliConfig {
  version: 1;
  sources: CliSourcePermissions;
  consentedAt: string;
}

export class SetupRequiredError extends Error {
  readonly code = "setup_required";
  constructor() {
    super("DevRecap needs permission to read your local development history. Run `devrecap setup` first.");
  }
}

export function cliConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.DEVRECAP_CONFIG?.trim()) return resolve(env.DEVRECAP_CONFIG);
  return resolve(homedir(), ".devrecap", "config.json");
}

export function readCliConfig(path = cliConfigPath()): DevRecapCliConfig | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<DevRecapCliConfig>;
    if (parsed.version !== 1 || !parsed.sources || typeof parsed.consentedAt !== "string") return null;
    const { codex, claude, git } = parsed.sources as Partial<CliSourcePermissions>;
    if (typeof codex !== "boolean" || typeof claude !== "boolean" || typeof git !== "boolean") return null;
    return { version: 1, sources: { codex, claude, git }, consentedAt: parsed.consentedAt };
  } catch {
    return null;
  }
}

export function requireCliConfig(path = cliConfigPath()): DevRecapCliConfig {
  const config = readCliConfig(path);
  if (!config) throw new SetupRequiredError();
  return config;
}

export function writeCliConfig(
  sources: CliSourcePermissions,
  path = cliConfigPath(),
  now = new Date(),
): DevRecapCliConfig {
  const config: DevRecapCliConfig = {
    version: 1,
    sources: { ...sources },
    consentedAt: now.toISOString(),
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return config;
}

export function effectiveSources(
  config: DevRecapCliConfig,
  requested: CliSourcePermissions,
): CliSourcePermissions {
  return {
    codex: config.sources.codex && requested.codex,
    claude: config.sources.claude && requested.claude,
    git: config.sources.git && requested.git,
  };
}
