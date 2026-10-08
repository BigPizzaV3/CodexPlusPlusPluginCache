"""Build the same ranked search index for the CLI and browser catalog."""
import re
import unicodedata


def fold(text):
    # Match JavaScript NFKD plus lowercase, including all Unicode mark categories.
    return ''.join(c for c in unicodedata.normalize('NFKD', text)
                   if not unicodedata.category(c).startswith('M')).lower()


def build_index(rows, locales, root):
    index = {}
    for row in rows:
        primary = [row['id'], row['title'], row['skill'], *row.get('keywords', [])]
        for locale in locales.values():
            primary.extend((locale['titles'][row['id']], locale['categories'][row['skill']],
                            locale['summaries'][row['skill']], locale['modes'][row['mode']]))
        path = (root/row['path']).resolve()
        if not path.is_relative_to(root.resolve()):
            raise ValueError(f'Escaping recipe path: {row["path"]}')
        body = path.read_text(encoding='utf-8')
        # Search visible instructions, not incidental URL/file path strings.
        body = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', body)
        index[row['id']] = {'primary': fold(' '.join(primary)), 'body': fold(body)}
    return index


def match_score(entry, query):
    terms = fold(query).split()
    if not all(term in entry['primary'] or term in entry['body'] for term in terms):
        return None
    return sum(3 if term in entry['primary'] else 1 for term in terms)
