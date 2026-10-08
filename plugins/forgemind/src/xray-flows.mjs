export function planCriticalFlows({ files = [], config = {}, testUrl }) {
  const baseUrl = config.web?.baseUrl ?? testUrl;
  if (!safeUrl(baseUrl)) return { flows: [], gaps: [] };
  const byRoute = new Map();
  for (const sourcePath of files.map((file) => String(file).replaceAll('\\', '/')).sort()) {
    const route = routeFromFile(sourcePath);
    if (!route) continue;
    byRoute.set(route, [...(byRoute.get(route) ?? []), sourcePath]);
  }
  const viewports = config.web?.viewports ?? ['desktop'];
  const flows = [...byRoute.entries()].slice(0, 20).map(([route, sourcePaths]) => ({ id: `flow-${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}`, route, purpose: `Load ${route}`, sourcePaths, safe: true, viewports }));
  return { flows, gaps: [] };
}

function routeFromFile(file) {
  let match = file.match(/(?:^|\/)app(?:\/(.*))?\/page\.(?:[cm]?[jt]sx?)$/i);
  if (match) return route(match[1] ?? '');
  match = file.match(/(?:^|\/)pages(?:\/(.*))?\.(?:[cm]?[jt]sx?)$/i);
  if (match && !match[1]?.startsWith('api/')) return route(match[1] ?? '');
  return null;
}

function route(value) { return `/${String(value).replace(/\/page$/, '').replace(/\/(index)?$/, '').replace(/\[.*?\]/g, '').replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '') || '/'; }
function safeUrl(value) { try { const url = new URL(value); const host = url.hostname; return ['http:', 'https:'].includes(url.protocol) && (host === 'localhost' || host === '::1' || /^127\./.test(host) || host.endsWith('.test')); } catch { return false; } }
