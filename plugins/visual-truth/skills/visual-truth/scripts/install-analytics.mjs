const DEFAULT_ENDPOINT =
  'https://visual-truth-editor.deriquehanche.chatgpt.site/api/install-analytics'

export async function reportAnonymousInstall({
  version,
  endpoint = process.env.VISUAL_TRUTH_ANALYTICS_ENDPOINT || DEFAULT_ENDPOINT,
  enabled = process.env.VISUAL_TRUTH_ANALYTICS !== '0',
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!enabled) return 'disabled'
  if (!isVersion(version) || typeof fetchImpl !== 'function') return 'skipped'

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'install', version }),
      signal: AbortSignal.timeout(1500),
    })
    return response.ok ? 'recorded' : 'failed'
  } catch {
    return 'failed'
  }
}

function isVersion(value) {
  return typeof value === 'string' && /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(value)
}
