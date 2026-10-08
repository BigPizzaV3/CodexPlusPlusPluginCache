const $ = id => document.getElementById(id);
const recipes = JSON.parse($('recipe-data').textContent);
const query = $('query'), category = $('category'), mode = $('mode'), dialog = $('detail');
let locale, language;
const host = $('host');
let activeRecipe;
try { host.value = localStorage.getItem('vibe-coding-host') === 'claude' ? 'claude' : 'codex'; } catch {}
const invocation = skill => host.value === 'claude' ? '/vibe-coding:' + skill : '$' + skill;
const searchIndex = JSON.parse($('search-data').textContent);

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function fold(text) {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

function render() {
  const terms = fold(query.value).trim().split(/\s+/).filter(Boolean);
  const list = recipes.filter(r => (!category.value || r.skill === category.value)
    && (!mode.value || r.mode === mode.value)
    && terms.every(term => searchIndex[r.id].primary.includes(term) || searchIndex[r.id].body.includes(term)))
    .map(r => ({row: r, score: terms.reduce((n, term) => n + (searchIndex[r.id].primary.includes(term) ? 3 : 1), 0)}))
    .sort((a, b) => b.score - a.score).map(item => item.row);
  $('count').textContent = formatMessage(locale.ui.count, {count: list.length, total: recipes.length});
  $('empty').hidden = list.length !== 0;
  const fragment = document.createDocumentFragment();
  for (const [i, r] of list.entries()) {
    const button = node('button', 'row');
    button.type = 'button';
    button.setAttribute('aria-label', locale.titles[r.id] + ' · ' + locale.categories[r.skill]);
    button.append(node('span', 'num', String(i + 1).padStart(2, '0')));
    const name = node('span', 'name');
    name.append(node('span', 'title', locale.titles[r.id]), node('span', 'skill', invocation(r.skill)));
    button.append(name, node('span', 'category', locale.categories[r.skill]),
      node('span', 'badge ' + r.mode, locale.modes[r.mode]), node('span', 'arrow', '↗'));
    button.addEventListener('click', () => openRecipe(r.id));
    fragment.append(button);
  }
  $('rows').replaceChildren(fragment);
}

function openRecipe(id) {
  const r = recipes.find(row => row.id === id);
  if (!r) return;
  activeRecipe = r.id;
  $('detail-title').textContent = locale.titles[r.id];
  $('detail-meta').textContent = locale.categories[r.skill] + ' · ' + invocation(r.skill);
  $('detail-summary').textContent = locale.summaries[r.skill];
  $('detail-badge').className = 'badge ' + r.mode;
  $('detail-badge').textContent = locale.modes[r.mode];
  $('prompt').value = formatMessage(locale.ui[host.value === 'claude' ? 'promptClaude' : 'prompt'], {skill: r.skill, title: locale.titles[r.id], id: r.id});
  $('body').textContent = r.body;
  $('source').textContent = formatMessage(locale.ui.recipeId, {id: r.id});
  $('copy-status').textContent = '';
  dialog.querySelector('details').open = false;
  const url = new URL(location.href);
  url.searchParams.set('lang', language);
  url.hash = r.id;
  updateCatalogUrl(url);
  if (!dialog.open) dialog.showModal();
}

function closeDetail() {
  dialog.close();
  const url = new URL(location.href);
  url.hash = '';
  updateCatalogUrl(url);
}

function openHash() {
  try {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) openRecipe(id);
    else if (dialog.open) dialog.close();
  } catch {}
}

createLanguageManager((selected, code) => {
  locale = selected;
  language = code;
  document.title = locale.ui.pageTitle;
  document.querySelector('meta[name="description"]').content = locale.ui.description;
  const selectedCategory = category.value, selectedMode = mode.value;
  const categories = [...new Set(recipes.map(r => r.skill))]
    .sort((a, b) => locale.categories[a].localeCompare(locale.categories[b], language));
  category.replaceChildren(new Option(locale.ui.allCategories, ''),
    ...categories.map(skill => new Option(locale.categories[skill], skill)));
  mode.replaceChildren(new Option(locale.ui.allActions, ''),
    ...Object.entries(locale.modes).map(([id, label]) => new Option(label, id)));
  category.value = selectedCategory;
  mode.value = selectedMode;
  render();
  openHash();
});

$('close').addEventListener('click', closeDetail);
dialog.addEventListener('cancel', event => { event.preventDefault(); closeDetail(); });
for (const el of [query, category, mode]) {
  el.addEventListener(el === query ? 'input' : 'change', render);
}
$('reset').addEventListener('click', () => {
  query.value = ''; category.value = ''; mode.value = ''; render(); query.focus();
});
for (const button of document.querySelectorAll('[data-skill]')) {
  button.addEventListener('click', () => {
    query.value = ''; mode.value = ''; category.value = button.dataset.skill; render();
  });
}
$('copy').addEventListener('click', async () => {
  const text = $('prompt').value;
  let copied = false;
  try { await navigator.clipboard.writeText(text); copied = true; } catch {}
  if (!copied) {
    $('prompt').focus(); $('prompt').select();
    try { copied = document.execCommand('copy'); } catch {}
  }
  $('copy-status').textContent = locale.ui[copied ? 'copied' : 'copyFallback'];
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !dialog.open && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault(); query.focus();
  }
});
window.addEventListener('hashchange', openHash);

host.addEventListener('change', () => {
  try { localStorage.setItem('vibe-coding-host', host.value); } catch {}
  render();
  if (activeRecipe) openRecipe(activeRecipe);
});
