import argparse
import json
import re
from pathlib import Path

from PIL import Image


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_EVIDENCE_ROOT = ROOT_DIR / "docs" / "evidence"
SCROLL_RE = re.compile(r"scroll(\d+)", re.IGNORECASE)
BACKGROUND = (17, 18, 23)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Stitch Grafana viewport captures into one long dashboard PNG."
    )
    parser.add_argument(
        "--phase",
        default=None,
        help="Evidence phase directory under docs/evidence, for example 02-no-lock-baseline.",
    )
    parser.add_argument(
        "--evidence-root",
        type=Path,
        default=DEFAULT_EVIDENCE_ROOT,
        help="Evidence root directory. Defaults to docs/evidence.",
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=None,
        help="Directory containing part-*.png captures. Defaults to the phase grafana parts directory.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output PNG path. Defaults to the phase grafana stitched-dashboard.png.",
    )
    parser.add_argument(
        "--metadata",
        type=Path,
        default=None,
        help=(
            "capture-meta.json from scripts/capture-grafana-dashboard.js. "
            "Defaults to <input-dir>/capture-meta.json when it exists."
        ),
    )
    parser.add_argument("--header-height", type=int, default=None)
    parser.add_argument("--body-x", type=int, default=None)
    parser.add_argument("--body-y", type=int, default=None)
    parser.add_argument("--body-width", type=int, default=None)
    parser.add_argument("--body-height", type=int, default=None)
    parser.add_argument(
        "--scroll-height",
        type=int,
        default=None,
        help="Full scrollable body height. Defaults to max(scroll offset + body height).",
    )
    return parser.parse_args()


def default_input_dir(args: argparse.Namespace) -> Path:
    if args.phase is None:
        raise SystemExit("--phase or --input-dir is required")
    return args.evidence_root / args.phase / "grafana" / "parts"


def default_output(args: argparse.Namespace) -> Path:
    if args.phase is not None:
        return args.evidence_root / args.phase / "grafana" / "stitched-dashboard.png"
    if args.input_dir is not None:
        return args.input_dir.parent / "stitched-dashboard.png"
    raise SystemExit("--phase or --output is required")


def normalize_args(args: argparse.Namespace) -> argparse.Namespace:
    if args.input_dir is None:
        args.input_dir = default_input_dir(args)

    if args.output is None:
        args.output = default_output(args)

    if args.metadata is None:
        metadata = args.input_dir / "capture-meta.json"
        if metadata.exists():
            args.metadata = metadata

    return args


def scroll_offset(path: Path, fallback: int) -> int:
    match = SCROLL_RE.search(path.stem)
    if match:
        return int(match.group(1))
    return fallback


def load_captures(input_dir: Path, body_height: int) -> list[tuple[Path, int]]:
    files = sorted(input_dir.glob("*.png"))
    if not files:
        raise SystemExit(f"No PNG captures found in {input_dir}")

    captures = [
        (path, scroll_offset(path, index * body_height))
        for index, path in enumerate(files)
    ]
    return sorted(captures, key=lambda item: item[1])


def load_metadata(metadata_path: Path) -> dict:
    if not metadata_path.exists():
        raise SystemExit(f"Metadata file not found: {metadata_path}")

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if "captures" not in metadata or not isinstance(metadata["captures"], list):
        raise SystemExit(f"Invalid capture metadata: {metadata_path}")
    if "initial" not in metadata or "scrollHeight" not in metadata["initial"]:
        raise SystemExit(f"Missing initial.scrollHeight in metadata: {metadata_path}")
    return metadata


def paste_clipped_captures(args: argparse.Namespace) -> None:
    if args.metadata is None:
        raise SystemExit("--metadata is required for clipped capture stitching")

    metadata = load_metadata(args.metadata)
    captures = sorted(
        metadata["captures"],
        key=lambda capture: capture["actualOffset"],
    )
    if not captures:
        raise SystemExit("No captures found in metadata")

    first_capture = captures[0]
    first_image_path = args.input_dir / first_capture["file"]
    first_image = Image.open(first_image_path).convert("RGB")
    scale_y = first_image.height / first_capture["rect"]["height"]
    output_width = first_image.width
    output_height = round(metadata["initial"]["scrollHeight"] * scale_y)
    stitched = Image.new("RGB", (output_width, output_height), BACKGROUND)

    covered_until = 0
    for capture in captures:
        image_path = args.input_dir / capture["file"]
        image = Image.open(image_path).convert("RGB")
        offset = round(capture["actualOffset"] * scale_y)
        capture_end = min(offset + image.height, output_height)
        source_y = max(0, covered_until - offset)
        paste_y = offset + source_y
        visible_height = capture_end - paste_y
        covered_until = max(covered_until, capture_end)

        if visible_height <= 0:
            continue

        body = image.crop((0, source_y, output_width, source_y + visible_height))
        stitched.paste(body, (0, paste_y))

    save_image(stitched, args.output)


def required_manual_args(args: argparse.Namespace) -> None:
    required = {
        "--header-height": args.header_height,
        "--body-x": args.body_x,
        "--body-y": args.body_y,
        "--body-width": args.body_width,
        "--body-height": args.body_height,
    }
    missing = [name for name, value in required.items() if value is None]
    if missing:
        raise SystemExit(f"Missing required arguments: {', '.join(missing)}")


def paste_manual_captures(args: argparse.Namespace) -> None:
    required_manual_args(args)
    captures = load_captures(args.input_dir, args.body_height)

    first_image = Image.open(captures[0][0]).convert("RGB")
    scroll_height = args.scroll_height
    if scroll_height is None:
        scroll_height = max(offset + args.body_height for _, offset in captures)

    output_width = first_image.width
    output_height = args.header_height + scroll_height
    stitched = Image.new("RGB", (output_width, output_height), BACKGROUND)

    header = first_image.crop((0, 0, output_width, args.header_height))
    stitched.paste(header, (0, 0))

    for path, offset in captures:
        image = Image.open(path).convert("RGB")
        body = image.crop(
            (
                args.body_x,
                args.body_y,
                args.body_x + args.body_width,
                args.body_y + args.body_height,
            )
        )
        visible_height = min(args.body_height, scroll_height - offset)
        if visible_height <= 0:
            continue
        stitched.paste(
            body.crop((0, 0, args.body_width, visible_height)),
            (args.body_x, args.header_height + offset),
        )

    save_image(stitched, args.output)


def save_image(image: Image.Image, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)
    print(output)
    print(f"{image.width}x{image.height}")


def main() -> None:
    args = normalize_args(parse_args())
    if args.metadata is not None:
        paste_clipped_captures(args)
        return

    paste_manual_captures(args)


if __name__ == "__main__":
    main()
