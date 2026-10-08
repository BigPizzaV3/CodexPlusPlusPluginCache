#!/usr/bin/env python3
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
template = ROOT / "skills" / "wizard" / "template.sh"
lines = template.read_text().splitlines()
marker = next(i for i, line in enumerate(lines) if "STAGES — author this section" in line)
library = "\n".join(lines[: marker - 1]) + "\n"

# Normal writes, input validation, and browser fallback.
with tempfile.TemporaryDirectory() as td:
    env_file = Path(td) / ".env"
    harness = Path(td) / "harness.sh"
    harness.write_text(
        library
        + """
ENV_FILE="$1"
write_env GOOD "alpha=beta"
if write_env BAD $'one\\nINJECTED=1'; then exit 41; fi
if write_env BADCR $'one\\rtwo'; then exit 42; fi
if write_env 'BAD-NAME' "value"; then exit 43; fi
PATH=/definitely-not-a-real-bin open_url "https://example.invalid"
"""
    )
    result = subprocess.run(["bash", str(harness), str(env_file)], text=True, capture_output=True)
    if result.returncode != 0:
        raise SystemExit(result.stdout + result.stderr)
    actual = env_file.read_text()
    assert actual == "GOOD=alpha=beta\n", actual
    combined = result.stdout + result.stderr
    assert "refusing multiline value for BAD" in combined
    assert "refusing multiline value for BADCR" in combined
    assert "invalid environment key: BAD-NAME" in combined
    assert "couldn't open a browser" in combined

# A real read error must never replace the original environment file.
with tempfile.TemporaryDirectory() as td:
    td_path = Path(td)
    env_file = td_path / ".env"
    env_file.write_text("KEEP=original\n")
    fakebin = td_path / "bin"
    fakebin.mkdir()
    fake_grep = fakebin / "grep"
    fake_grep.write_text("#!/usr/bin/env bash\nexit 2\n")
    fake_grep.chmod(0o755)
    harness = td_path / "grep-failure.sh"
    harness.write_text(
        library
        + f"""
ENV_FILE="$1"
PATH="{fakebin}:$PATH"
if write_env NEW "value"; then exit 44; fi
"""
    )
    result = subprocess.run(["bash", str(harness), str(env_file)], text=True, capture_output=True)
    assert result.returncode == 0, result.stdout + result.stderr
    assert env_file.read_text() == "KEEP=original\n"
    assert "leaving it unchanged" in (result.stdout + result.stderr)

print("wizard template safety: PASS")
