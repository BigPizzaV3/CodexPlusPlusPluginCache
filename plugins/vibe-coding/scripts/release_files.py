"""Explicit release inventory; never infer approval from files found on disk."""
import json
from pathlib import Path, PurePosixPath


def release_files(root):
    root = Path(root).resolve()
    errors = []
    try:
        inventory = json.loads((root/'package-files.json').read_text(encoding='utf-8'))
        if not isinstance(inventory, dict):
            raise ValueError('expected an object')
        names = inventory['files']
        if inventory.get('version') != 1 or not isinstance(names, list) or not all(isinstance(n, str) for n in names):
            raise ValueError('expected version 1 and a list of paths')
    except (OSError, ValueError, KeyError, TypeError) as exc:
        return [], [f'Invalid package-files.json: {exc}']
    if names != sorted(set(names)):
        errors.append('package-files.json paths must be unique and sorted')
    approved = set()
    for name in names:
        path = PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts or '\\' in name or str(path) != name:
            errors.append(f'Invalid release path: {name}')
            continue
        for part in path.parts:
            lower = part.lower()
            if ((lower.startswith('.env') and lower != '.env.example')
                    or lower in {'.ssh', '.aws', 'credentials.json', 'secrets.json', 'id_rsa', 'id_ed25519'}
                    or lower.endswith(('.pem', '.key', '.p12', '.pfx'))):
                errors.append(f'Sensitive file is not permitted in release: {name}')
        target = root/name
        if not target.resolve().is_relative_to(root) or target.is_symlink():
            errors.append(f'Escaping/symlink release path: {name}')
        elif not target.is_file():
            errors.append(f'Missing release file: {name}')
        approved.add(name)
    for path in root.rglob('*'):
        relative = path.relative_to(root)
        if any(part in {'.git', '__pycache__', '.DS_Store'} for part in relative.parts):
            continue
        if path.is_symlink():
            errors.append(f'Symlink in package: {relative.as_posix()}')
        elif path.is_file() and relative.as_posix() not in approved:
            errors.append(f'Unapproved release file: {relative.as_posix()}')
    if 'package-files.json' not in approved:
        errors.append('Release inventory must include package-files.json itself')
    return [root/name for name in names if name in approved], errors
