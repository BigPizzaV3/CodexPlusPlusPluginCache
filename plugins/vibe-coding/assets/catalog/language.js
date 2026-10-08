function createLanguageManager(onChange) {
  const locales = JSON.parse(document.getElementById('locale-data').textContent);
  const picker = document.getElementById('language');
  const storageKey = 'vibe-coding-language';
  const normalize = value => value === 'zh' ? 'zh-CN' : value;
  const valid = value => Object.prototype.hasOwnProperty.call(locales, value);
  let saved;
  try { saved = localStorage.getItem(storageKey); } catch {}
  const requested = normalize(new URL(location.href).searchParams.get('lang'));
  let language = valid(requested) ? requested : valid(saved) ? saved : 'en';

  function apply() {
    const locale = locales[language];
    document.documentElement.lang = language;
    picker.value = language;
    for (const el of document.querySelectorAll('[data-i18n]')) {
      el.textContent = locale.ui[el.dataset.i18n];
    }
    for (const el of document.querySelectorAll('[data-i18n-aria]')) {
      el.setAttribute('aria-label', locale.ui[el.dataset.i18nAria]);
    }
    for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
      el.placeholder = locale.ui[el.dataset.i18nPlaceholder];
    }
    for (const link of document.querySelectorAll('[data-local-link]')) {
      const url = new URL(link.href);
      url.searchParams.set('lang', language);
      link.href = url.href;
    }
    onChange(locale, language, locales);
  }

  picker.addEventListener('change', () => {
    if (!valid(picker.value)) return;
    language = picker.value;
    try { localStorage.setItem(storageKey, language); } catch {}
    const url = new URL(location.href);
    url.searchParams.set('lang', language);
    updateCatalogUrl(url);
    apply();
  });
  apply();
}

function formatMessage(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

function updateCatalogUrl(url) {
  try { history.replaceState(null, '', url); } catch {}
}
