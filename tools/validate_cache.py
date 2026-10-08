"""检查市场引用与原始插件快照；不运行插件代码。"""
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
ALLOW = {'MIT', 'Apache-2.0', 'GPL-3.0-only', 'Apache-2.0 AND CC-BY-4.0'}

def validate():
    catalog = json.loads((ROOT / 'catalog.json').read_text())
    market = json.loads((ROOT / '.agents/plugins/marketplace.json').read_text())
    expected = {v['name']: v for v in catalog['plugins']}
    entries = {v['name']: v for v in market['plugins']}
    assert not market['name'].startswith('openai-'), '市场名称不能使用保留前缀'
    assert set(expected) == set(entries), '清单与快照记录不一致'
    assert len(entries) == len(market['plugins']), '市场中有重复插件'
    file_count = 0
    byte_count = 0
    for name, entry in entries.items():
        snapshot = expected[name]
        assert snapshot['declaredLicense'] in ALLOW, '许可未进入允许集合: ' + name
        assert entry['source'] == {'source': 'local', 'path': './plugins/' + name}, '来源路径不正确: ' + name
        directory = ROOT / 'plugins' / name
        manifest = json.loads((directory / '.codex-plugin/plugin.json').read_text())
        assert manifest['name'] == name, '插件名称不一致: ' + name
        assert manifest['version'] == snapshot['version'], '版本不一致: ' + name
        assert manifest['license'] == snapshot['declaredLicense'], '许可声明不一致: ' + name
        actual_paths = set()
        for path in directory.rglob('*'):
            assert not path.is_symlink(), '发现未审查的符号链接: ' + str(path.relative_to(ROOT))
            if not path.is_file():
                continue
            relative = str(path.relative_to(directory))
            assert path.name not in {'auth.json', 'config.toml', '.env'}, '发现凭据文件名: ' + relative
            data = path.read_bytes()
            assert b'-----BEGIN PRIVATE KEY-----' not in data, '发现私钥标记: ' + relative
            assert hashlib.sha256(data).hexdigest() == snapshot['fileSha256'].get(relative), '文件哈希不一致: ' + name + '/' + relative
            actual_paths.add(relative)
            file_count += 1
            byte_count += len(data)
        assert actual_paths == set(snapshot['fileSha256']), '快照文件缺失: ' + name
        for field in ['skills', 'apps', 'mcpServers']:
            value = manifest.get(field)
            if isinstance(value, str) and value.startswith('./'):
                assert (directory / value).exists(), '组件引用不存在: ' + name + '/' + value
    for name in ['MIT', 'Apache-2.0', 'GPL-3.0-only', 'CC-BY-4.0']:
        assert (ROOT / 'LICENSES' / (name + '.txt')).is_file(), '许可正文缺失: ' + name
    return {'plugins': len(entries), 'files': file_count, 'bytes': byte_count, 'integrity': 'passed'}

if __name__ == '__main__':
    try:
        print(json.dumps(validate(), ensure_ascii=False))
    except (AssertionError, OSError, ValueError, KeyError) as error:
        print('验证失败: ' + str(error), file=sys.stderr)
        sys.exit(1)
