const MINIMUM_FACADE_VERSION = 7;
export const HEYTRADERS_CANONICAL_ORIGIN = 'https://hey-traders.com';

const assertTab = (tab) => {
  if (!tab || typeof tab !== 'object' || !tab.capabilities) {
    throw new TypeError('A Browser Tab handle is required.');
  }
};

const encodePayload = (payload) => (
  Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
);

const readRuntimeValue = (response) => {
  if (response?.exceptionDetails) {
    const message = response.exceptionDetails.exception?.description
      || response.exceptionDetails.text
      || 'HeyTraders browser command failed.';
    throw new Error(message);
  }
  if (!response?.result || !Object.prototype.hasOwnProperty.call(response.result, 'value')) {
    throw new Error('HeyTraders browser command returned no serializable value.');
  }
  return response.result.value;
};

export const createHeyTradersCli = async (tab) => {
  assertTab(tab);
  const cdp = await tab.capabilities.get('cdp');

  const call = async (command, args = {}) => {
    if (typeof command !== 'string' || !command.trim()) {
      throw new TypeError('command must be a non-empty string.');
    }
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      throw new TypeError('args must be an object.');
    }

    const encodedPayload = encodePayload({ command, args });
    const response = await cdp.send('Runtime.evaluate', {
      expression: `(async () => {
        const allowedOrigins = [${JSON.stringify(HEYTRADERS_CANONICAL_ORIGIN)}];
        if (window.location.origin !== allowedOrigins[0]) {
          return {
            ok: false,
            domain: 'system',
            action: 'dispatch',
            error: 'heytraders-wrong-origin',
            origin: window.location.origin,
            allowedOrigins,
          };
        }
        const facade = window.__bridge;
        if (!facade) {
          return {
            ok: false,
            domain: 'system',
            action: 'dispatch',
            error: 'heytraders-bridge-unavailable',
            facadeVersion: null,
          };
        }
        if (!Number.isSafeInteger(facade.version) || facade.version < ${MINIMUM_FACADE_VERSION}) {
          return {
            ok: false,
            domain: 'system',
            action: 'dispatch',
            error: 'heytraders-bridge-upgrade-required',
            facadeVersion: Number.isFinite(facade.version) ? facade.version : null,
            minimumFacadeVersion: ${MINIMUM_FACADE_VERSION},
          };
        }
        if (typeof facade.request !== 'function') {
          return {
            ok: false,
            domain: 'system',
            action: 'dispatch',
            error: 'heytraders-bridge-unavailable',
            facadeVersion: facade.version ?? null,
          };
        }
        const encoded = atob('${encodedPayload}');
        const bytes = Uint8Array.from(encoded, character => character.charCodeAt(0));
        const request = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        return facade.request(request);
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    return readRuntimeValue(response);
  };

  return Object.freeze({ call });
};
