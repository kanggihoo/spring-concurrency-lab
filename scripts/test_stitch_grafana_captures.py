import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPT = ROOT_DIR / "scripts" / "stitch-grafana-captures.py"


class StitchGrafanaCapturesTest(unittest.TestCase):
    def test_requires_phase_or_input_dir_to_avoid_phase_specific_default(self) -> None:
        result = subprocess.run(
            [sys.executable, str(SCRIPT)],
            cwd=ROOT_DIR,
            check=False,
            text=True,
            capture_output=True,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--phase or --input-dir", result.stderr)

    def test_stitches_metadata_captures_without_duplicate_overlap(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            input_dir = tmp_dir / "parts"
            input_dir.mkdir()

            Image.new("RGB", (4, 10), (200, 0, 0)).save(input_dir / "part-01-scroll0.png")
            Image.new("RGB", (4, 10), (0, 80, 200)).save(input_dir / "part-02-scroll6.png")

            metadata = {
                "initial": {"scrollHeight": 16},
                "captures": [
                    {
                        "actualOffset": 0,
                        "rect": {"height": 10},
                        "file": "part-01-scroll0.png",
                    },
                    {
                        "actualOffset": 6,
                        "rect": {"height": 10},
                        "file": "part-02-scroll6.png",
                    },
                ],
            }
            metadata_path = input_dir / "capture-meta.json"
            metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
            output_path = tmp_dir / "stitched.png"

            subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--input-dir",
                    str(input_dir),
                    "--metadata",
                    str(metadata_path),
                    "--output",
                    str(output_path),
                ],
                cwd=ROOT_DIR,
                check=True,
                text=True,
                capture_output=True,
            )

            stitched = Image.open(output_path).convert("RGB")
            self.assertEqual(stitched.size, (4, 16))
            self.assertEqual(stitched.getpixel((0, 0)), (200, 0, 0))
            self.assertEqual(stitched.getpixel((0, 9)), (200, 0, 0))
            self.assertEqual(stitched.getpixel((0, 10)), (0, 80, 200))
            self.assertEqual(stitched.getpixel((0, 15)), (0, 80, 200))


if __name__ == "__main__":
    unittest.main()
