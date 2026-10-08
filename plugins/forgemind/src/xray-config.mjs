import { readFile } from 'node:fs/promises';
import path from 'node:path';

const VIEWPORTS = new Set(['desktop', 'mobile']);

export async function loadXrayConfig({ workspace }) {
  const source = await readConfigSource(workspace);
  if (!source) return { value: emptyConfig(), gaps: [] };
  if (source.error) return { value: emptyConfig(), gaps: [gap('config', 'ForgeMind Xray configuration must be valid JSON.')] };
  return validateXrayConfig(source.value);
}

export function validateXrayConfig(value) {
  const config = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const xray = config.xray ?? config;
  if (!xray || typeof xray !== 'object' || Array.isArray(xray)) return { value: emptyConfig(), gaps: [gap('xray', 'Xray configuration must be an object.')] };
  const gaps = [];
  const web = validateWeb(xray.web, gaps);
  const api = validateApi(xray.api, gaps);
  return { value: { web, api }, gaps };
}

function emptyConfig() { return { web: null, api: null }; }

async function readConfigSource(workspace) {
  for (const name of ['forgemind.config.json', 'package.json']) {
    try {
      const parsed = JSON.parse(await readFile(path.join(workspace, name), 'utf8'));
      const value = name === 'package.json' ? parsed?.forgemind?.xray : parsed?.xray;
      if (value !== undefined) return { value };
    } catch (error) {
      if (error?.code !== 'ENOENT' && name === 'forgemind.config.json') return { error };
    }
  }
  return null;
}

function validateWeb(value, gaps) {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) { gaps.push(gap('web', 'web must be an object.')); return null; }
  const baseUrl = localUrl(value.baseUrl);
  if (!baseUrl) { gaps.push(gap('web.baseUrl', 'web.baseUrl must be an explicit local or .test HTTP URL.')); return null; }
  const viewports = value.viewports === undefined ? ['desktop'] : Array.isArray(value.viewports) && value.viewports.length > 0 && value.viewports.every((item) => VIEWPORTS.has(item)) ? [...new Set(value.viewports)] : null;
  if (!viewports) { gaps.push(gap('web.viewports', 'web.viewports must contain desktop and/or mobile.')); return null; }
  const visualBaseline = validateVisual(value.visualBaseline, gaps);
  const performance = validateBudget(value.performance, 'navigationMs', 'web.performance.navigationMs', gaps);
  return { baseUrl, viewports, visualBaseline, performance };
}

function validateApi(value, gaps) {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) { gaps.push(gap('api', 'api must be an object.')); return null; }
  const baseUrl = localUrl(value.baseUrl);
  if (!baseUrl) { gaps.push(gap('api.baseUrl', 'api.baseUrl must be an explicit local or .test HTTP URL.')); return null; }
  const checks = Array.isArray(value.checks) ? value.checks : null;
  if (!checks || !checks.every((check) => /^[a-z0-9-]+$/i.test(check?.id ?? '') && ['GET', 'HEAD'].includes(check?.method) && /^\/(?!\/)(?!.*\.\.)(?!.*[#?])[^\s]*$/.test(check?.path ?? ''))) { gaps.push(gap('api.checks', 'api.checks must contain id plus safe GET or HEAD relative paths.')); return null; }
  return { baseUrl, checks: checks.map(({ id, method, path: checkPath }) => ({ id, method, path: checkPath })), performance: validateBudget(value.performance, 'responseMs', 'api.performance.responseMs', gaps) };
}

function validateVisual(value, gaps) {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || value.enabled !== true || !finite(value.thresholdPercent) || value.thresholdPercent < 0 || value.thresholdPercent > 100) { gaps.push(gap('web.visualBaseline', 'web.visualBaseline requires enabled: true and thresholdPercent from 0 to 100.')); return null; }
  return { enabled: true, thresholdPercent: Number(value.thresholdPercent) };
}

function validateBudget(value, key, field, gaps) {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || !finite(value[key]) || value[key] < 0) { gaps.push(gap(field, `${field} must be a non-negative finite number.`)); return null; }
  return { [key]: Number(value[key]) };
}

function localUrl(value) {
  try {
    const url = new URL(String(value));
    const host = url.hostname.toLowerCase();
    return ['http:', 'https:'].includes(url.protocol) && (host === 'localhost' || host === '::1' || /^127\./.test(host) || host.endsWith('.test')) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function finite(value) { return Number.isFinite(Number(value)); }
function gap(field, message) { return { code: 'FM_XRAY_CONFIG_INVALID', field, message, nextAction: `Correct ${field} in the project-local ForgeMind Xray configuration and rerun Xray.` }; }
