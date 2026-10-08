from __future__ import annotations

import sys
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from render_docx import _parse_density  # noqa: E402


class RenderMetricTests(unittest.TestCase):
    def test_bbox_parser_numbers_logical_pages_sequentially(self) -> None:
        xml = """<?xml version="1.0" encoding="UTF-8"?>
<doc xmlns="http://www.w3.org/1999/xhtml">
  <page width="612" height="792"><flow><block><line>
    <word xMin="72" yMin="100" xMax="120" yMax="112">First</word>
  </line></block></flow></page>
  <page width="612" height="792"><flow><block><line>
    <word xMin="72" yMin="200" xMax="130" yMax="214">Second</word>
  </line></block></flow></page>
</doc>"""
        with tempfile.TemporaryDirectory() as temporary:
            bbox = Path(temporary) / "bbox.xml"
            bbox.write_text(xml, encoding="utf-8")
            pages = _parse_density(bbox)
        self.assertEqual([page["page"] for page in pages], [1, 2])
        self.assertGreater(pages[0]["body_fill_ratio"], 0)
        self.assertGreater(pages[1]["body_fill_ratio"], pages[0]["body_fill_ratio"])

    def test_missing_docx_fails_cleanly_and_writes_a_report(self) -> None:
        renderer = SCRIPT_ROOT / "render_docx.py"
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            process = subprocess.run(
                [
                    sys.executable,
                    str(renderer),
                    str(root / "missing.docx"),
                    "--output-dir",
                    str(root / "render"),
                    "--expected-pages",
                    "2",
                ],
                capture_output=True,
                text=True,
            )
            report = (root / "render" / "missing_Render_Validation.json").read_text(encoding="utf-8")
        self.assertEqual(process.returncode, 2)
        self.assertIn("Source DOCX is missing", report)
        self.assertNotIn("Traceback", process.stderr)
        self.assertEqual(json.loads(report)["source_docx"], "missing.docx")


if __name__ == "__main__":
    unittest.main()
