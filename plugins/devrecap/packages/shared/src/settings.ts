/**
 * Settings persistence with sensible local-first defaults.
 *
 * NOTE (manual-import architecture): there is intentionally no Codex directory,
 * repository directory, or auto-scan setting. DevRecap never discovers or
 * connects to developer tools; it only analyzes files the user imports.
 */

import type { DB } from "./db.ts";
import type { Settings } from "./types.ts";

export function defaultSettings(): Settings {
  return {
    timezone: process.env.TZ || "UTC",
    aiProvider: "deterministic",
    aiModel: "",
    ollamaEndpoint: "http://localhost:11434",
    redactionEnabled: true,
    showPayloadPreview: true,
    excludedProjectIds: [],
    defaultStyle: "professional",
    defaultLength: "normal",
    defaultLanguage: "auto",
    dailyDurationSeconds: 60,
    reviewThreshold: 0.5,
  };
}

const KEY = "app_settings";

export function getSettings(db: DB): Settings {
  const row = db.get<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`,
    [KEY],
  );
  const stored = row ? (JSON.parse(row.value) as Partial<Settings>) : {};
  const settings = { ...defaultSettings(), ...stored };
  // Environment configuration is the RECOMMENDED secure way to supply the key
  // (it is never written to SQLite and never returned to the browser). When
  // set, it takes precedence over any stored value.
  const envKey = process.env.DEVRECAP_OPENAI_API_KEY;
  if (envKey) settings.openaiApiKey = envKey;
  return settings;
}

export interface SaveSettingsOptions {
  /** When true, explicitly clear the stored OpenAI API key. */
  clearOpenaiApiKey?: boolean;
}

export function saveSettings(
  db: DB,
  patch: Partial<Settings>,
  opts: SaveSettingsOptions = {},
): Settings {
  const current = getStoredSettings(db);
  const merged = { ...current, ...patch };
  // API-key persistence rules (never persist the env-supplied key):
  //   - clearOpenaiApiKey:true  → remove the stored key
  //   - a real, non-empty value → replace the stored key
  //   - undefined / ""          → PRESERVE the existing stored key
  if (opts.clearOpenaiApiKey) {
    merged.openaiApiKey = "";
  } else if (patch.openaiApiKey === undefined || patch.openaiApiKey === "") {
    merged.openaiApiKey = current.openaiApiKey;
  }
  db.run(
    `INSERT INTO settings(key, value) VALUES(?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [KEY, JSON.stringify(merged)],
  );
  // Return the effective settings (env key wins for the in-memory result, but
  // is never written above).
  return getSettings(db);
}

/** Settings as PERSISTED (no env override) — used internally by saveSettings so
 *  the env-supplied key is never accidentally written into SQLite. */
function getStoredSettings(db: DB): Settings {
  const row = db.get<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`,
    [KEY],
  );
  const stored = row ? (JSON.parse(row.value) as Partial<Settings>) : {};
  return { ...defaultSettings(), ...stored };
}

/**
 * A browser-safe view of settings: the raw API key is NEVER included. Instead
 * we expose whether a key is configured and a masked hint (last 4 chars). This
 * is what the settings endpoint returns.
 */
export interface SafeSettings extends Omit<Settings, "openaiApiKey"> {
  openaiApiKeySet: boolean;
  openaiApiKeyMasked: string;
  /** True when the key comes from the environment (cannot be edited in the UI). */
  openaiApiKeyFromEnv: boolean;
}

export function redactSettings(settings: Settings): SafeSettings {
  const key = settings.openaiApiKey ?? "";
  const { openaiApiKey: _omit, ...rest } = settings;
  return {
    ...rest,
    openaiApiKeySet: key.length > 0,
    openaiApiKeyMasked: key ? `••••••••${key.slice(-4)}` : "",
    openaiApiKeyFromEnv: Boolean(process.env.DEVRECAP_OPENAI_API_KEY),
  };
}
