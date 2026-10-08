"""Shared, self-contained catalog renderer for the plugin ZIP and public website."""
from pathlib import Path
import html
import json
import re
from search_index import build_index

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = {'en': 'English', 'es': 'Español', 'ru': 'Русский', 'zh-CN': '简体中文'}


def load_locales(root=ROOT):
    source = root/'assets/catalog/locales'
    return {code: json.loads((source/f'{code}.json').read_text(encoding='utf-8')) for code in LANGUAGES}


def validate_locales(locales, rows):
    expected = {
        'categories': {row['skill'] for row in rows},
        'summaries': {row['skill'] for row in rows},
        'titles': {row['id'] for row in rows},
        'modes': {row['mode'] for row in rows},
        'policy': {'privacy', 'terms'},
        'ui': set(locales['en']['ui']),
    }
    for language in LANGUAGES:
        data = locales[language]
        for section, keys in expected.items():
            if set(data[section]) != keys:
                raise ValueError(f'{language}: missing or unexpected {section} translations')
            for key, value in data[section].items():
                if not isinstance(value, str) or not value.strip():
                    raise ValueError(f'{language}: empty {section}.{key}')
                placeholders = set(re.findall(r'\{\w+\}', value))
                base = set(re.findall(r'\{\w+\}', locales['en'][section][key]))
                if placeholders != base:
                    raise ValueError(f'{language}: mismatched placeholders in {section}.{key}')


def script_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')


def policy_html(markdown):
    """Render the small policy subset; escape all source markup and allow HTTPS links."""
    markdown = markdown.replace('(LICENSE)', '(https://github.com/arty-kk/vibe-coding/blob/main/LICENSE)')
    paragraphs = []
    for raw in markdown.strip().split('\n\n'):
        heading = raw.startswith('# ')
        text = html.escape(raw[2:] if heading else raw)
        text = re.sub(r'\[([^\]]+)\]\((https://[^)]+)\)', r'<a href="\2">\1</a>', text)
        tag = 'h1' if heading else 'p'
        paragraphs.append(f'<{tag}>{text}</{tag}>')
    return '\n'.join(paragraphs)


def render_template(template, replacements, ui):
    translate = lambda text: re.sub(r'\{\{(\w+)\}\}', lambda match: html.escape(ui[match[1]]), text)
    replacements = dict(replacements)
    if '__LANGUAGE_PICKER__' in replacements:
        replacements['__LANGUAGE_PICKER__'] = translate(replacements['__LANGUAGE_PICKER__'])
    return re.sub(r'__[A-Z_]+__', lambda match: replacements[match[0]], translate(template))


def common_resources(root=ROOT):
    source = root/'assets/catalog'
    picker = '<label class="language-label"><span data-i18n="language">{{language}}</span><select id="language">'
    picker += ''.join(f'<option value="{code}" lang="{code}">{label}</option>' for code, label in LANGUAGES.items())
    picker += '</select></label>'
    return {
        '__STYLE__': (source/'style.css').read_text(encoding='utf-8'),
        '__LANGUAGE_PICKER__': picker,
        '__LANGUAGE_JS__': (source/'language.js').read_text(encoding='utf-8'),
    }


def render_catalog(rows, root=ROOT, offline=True):
    root = root.resolve()
    source = root/'assets/catalog'
    manifest = json.loads((root/'plugin.json').read_text(encoding='utf-8'))
    locales = load_locales(root)
    validate_locales(locales, rows)
    skill_count = len(list((root/'skills').glob('*/SKILL.md')))
    for locale in locales.values():
        locale['ui']['description'] = locale['ui']['description'].format(skills=skill_count, recipes=len(rows))
    expanded = []
    for row in rows:
        path = (root/row['path']).resolve()
        if not path.is_relative_to(root):
            raise ValueError(f'Escaping recipe path: {row["path"]}')
        expanded.append({**row, 'body': path.read_text(encoding='utf-8')})
    replacements = common_resources(root) | {
        '__ICON_URL__': 'assets/icon.png' if offline else 'icon.png',
        '__VERSION__': html.escape(manifest['version']),
        '__SKILLS__': str(skill_count),
        '__COUNT__': str(len(rows)),
        '__DOMAINS__': str(len({row['group'] for row in rows})),
        '__RECIPE_DATA__': script_json(expanded),
        '__SEARCH_DATA__': script_json(build_index(rows, locales, root)),
        '__LOCALE_DATA__': script_json({code: {k: v for k, v in data.items() if k != 'policy'} for code, data in locales.items()}),
        '__CATALOG_JS__': (source/'catalog.js').read_text(encoding='utf-8'),
    }
    template = (source/'catalog.html').read_text(encoding='utf-8')
    if offline:
        for name in ('privacy', 'terms'):
            template = template.replace(f'href="{name}.html"', f'href="https://arty-kk.github.io/vibe-coding/{name}.html"')
    return render_template(template, replacements, locales['en']['ui'])
