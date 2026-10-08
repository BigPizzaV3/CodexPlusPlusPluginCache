"""Parse safe YAML and validate the metadata contracts used by this package."""
import re
import yaml


class UniqueLoader(yaml.SafeLoader):
    pass


def unique_mapping(loader, node, deep=False):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if not isinstance(key, str) or key in result:
            raise yaml.constructor.ConstructorError(None, None, 'duplicate or non-string metadata key', key_node.start_mark)
        result[key] = loader.construct_object(value_node, deep=deep)
    return result


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)


def read_yaml(text, label):
    try:
        value = yaml.load(text, Loader=UniqueLoader)
    except yaml.YAMLError as exc:
        raise ValueError(f'{label}: invalid YAML: {exc}') from exc
    if not isinstance(value, dict):
        raise ValueError(f'{label}: expected a YAML mapping')
    return value


def skill_metadata(text, label, name):
    match = re.match(r'^---\n(.*?)\n---(?:\n|$)', text, re.S)
    if not match:
        raise ValueError(f'{label}: missing or invalid frontmatter')
    fields = read_yaml(match[1], label)
    extra = set(fields) - {'name', 'description', 'license', 'allowed-tools', 'metadata'}
    if extra:
        raise ValueError(f'{label}: unsupported fields: {", ".join(sorted(extra))}')
    if fields.get('name') != name or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', name) or len(name) > 64:
        raise ValueError(f'{label}: invalid skill name')
    desc = fields.get('description')
    if not isinstance(desc, str) or not desc.strip() or len(desc) > 1024 or '<' in desc or '>' in desc:
        raise ValueError(f'{label}: invalid description')
    if 'metadata' in fields and not isinstance(fields['metadata'], dict):
        raise ValueError(f'{label}: metadata must be a mapping')
    if 'license' in fields and not isinstance(fields['license'], str):
        raise ValueError(f'{label}: license must be a string')
    return fields


def ui_metadata(text, label):
    data = read_yaml(text, label)
    if set(data) - {'interface', 'dependencies', 'policy'}:
        raise ValueError(f'{label}: unsupported top-level fields')
    values = data.get('interface')
    if not isinstance(values, dict):
        raise ValueError(f'{label}: interface must be a mapping')
    allowed = {'display_name', 'short_description', 'default_prompt', 'icon_small', 'icon_large', 'brand_color'}
    if set(values) - allowed or not all(isinstance(v, str) and v.strip() for v in values.values()):
        raise ValueError(f'{label}: unsupported or invalid interface field')
    for key in ('display_name', 'short_description', 'default_prompt'):
        if key not in values:
            raise ValueError(f'{label}: missing interface.{key}')
    if 'policy' in data:
        policy = data['policy']
        if not isinstance(policy, dict) or set(policy) - {'allow_implicit_invocation'} or any(type(v) is not bool for v in policy.values()):
            raise ValueError(f'{label}: invalid invocation policy')
    if 'dependencies' in data and not isinstance(data['dependencies'], dict):
        raise ValueError(f'{label}: dependencies must be a mapping')
    return values


def catalog_errors(data):
    if not isinstance(data, dict):
        return ['catalog.json: expected an object']
    if data.get('version') != 1 or type(data.get('skills')) is not int or not isinstance(data.get('recipes'), list):
        return ['catalog.json: expected version 1, integer skills and recipes array']
    errors = []
    strings = {'id', 'title', 'skill', 'mode', 'path', 'category', 'summary', 'example', 'sha256'}
    for i, row in enumerate(data['recipes']):
        label = f'catalog.json: recipes[{i}]'
        if not isinstance(row, dict):
            errors.append(f'{label}: expected an object')
            continue
        for key in sorted(strings):
            if not isinstance(row.get(key), str) or not row[key].strip():
                errors.append(f'{label}: missing or invalid {key}')
        if type(row.get('group')) is not int:
            errors.append(f'{label}: missing or invalid group')
        if 'keywords' in row and (not isinstance(row['keywords'], list) or not all(isinstance(k, str) and k.strip() for k in row['keywords'])):
            errors.append(f'{label}: keywords must be nonempty strings')
    return errors
