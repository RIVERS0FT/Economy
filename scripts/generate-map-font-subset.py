#!/usr/bin/env python3
"""Generate the self-hosted strategic-map font subset from current province names.

Requires exactly:
  python -m pip install 'fonttools[woff]==4.59.2' brotli==1.1.0

The source font is pinned to Adobe Source Han Serif 2.003R. This script is a
maintenance tool only; production and CI never fetch the font at runtime.
Re-run it only when province names, the pinned source, or generator versions change.
"""

from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import urllib.request
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

FONTTOOLS_VERSION = "4.59.2"
BROTLI_VERSION = "1.1.0"
SOURCE_VERSION = "2.003R"
SOURCE_PATH = "SubsetOTF/CN/SourceHanSerifCN-SemiBold.otf"
SOURCE_URL = (
    "https://raw.githubusercontent.com/adobe-fonts/source-han-serif/"
    f"{SOURCE_VERSION}/{SOURCE_PATH}"
)
SOURCE_GIT_BLOB_SHA = "44d7f0c522ee7e9c6cb373a5ef7e851f30b558a1"
FAMILY = "Economy Map Serif"
WEIGHT = 600

ROOT = Path(__file__).resolve().parents[1]
PROVINCES_PATH = ROOT / "shared" / "provinces.json"
OUTPUT_DIR = ROOT / "src" / "assets" / "fonts"
OUTPUT_PATH = OUTPUT_DIR / "economy-map-serif-600.woff2"
MANIFEST_PATH = OUTPUT_DIR / "economy-map-serif-600.manifest.json"


def require_version(distribution: str, expected: str) -> None:
    try:
        actual = version(distribution)
    except PackageNotFoundError as error:
        raise SystemExit(
            f"Missing {distribution}. Install exact tooling with: "
            "python -m pip install 'fonttools[woff]==4.59.2' brotli==1.1.0"
        ) from error
    if actual != expected:
        raise SystemExit(f"{distribution} must be {expected}; found {actual}")


def git_blob_sha(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()


def province_characters() -> str:
    provinces = json.loads(PROVINCES_PATH.read_text(encoding="utf-8"))
    return "".join(sorted(set("".join(item["name"] for item in provinces))))


def normalize_subset_font(path: Path) -> None:
    from fontTools.ttLib import TTFont

    font = TTFont(path, recalcTimestamp=False)
    font["OS/2"].usWeightClass = WEIGHT
    font["head"].modified = font["head"].created
    names = {
        1: FAMILY,
        2: "SemiBold",
        3: "Economy Map Serif SemiBold 2.003R subset",
        4: "Economy Map Serif SemiBold",
        6: "EconomyMapSerif-SemiBold",
        16: FAMILY,
        17: "SemiBold",
    }
    table = font["name"]
    for name_id, value in names.items():
        table.removeNames(nameID=name_id)
        table.setName(value, name_id, 3, 1, 0x409)
        table.setName(value, name_id, 1, 0, 0)
    font.flavor = "woff2"
    font.save(path, reorderTables=True)


def main() -> int:
    require_version("fonttools", FONTTOOLS_VERSION)
    require_version("brotli", BROTLI_VERSION)

    from fontTools import subset

    characters = province_characters()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="economy-map-font-") as temporary_directory:
        temp = Path(temporary_directory)
        source_path = temp / "source-han-serif-cn-semibold.otf"
        text_path = temp / "characters.txt"
        subset_path = temp / OUTPUT_PATH.name

        with urllib.request.urlopen(SOURCE_URL, timeout=60) as response:
            source_data = response.read()
        if git_blob_sha(source_data) != SOURCE_GIT_BLOB_SHA:
            raise SystemExit("Pinned Source Han Serif file does not match the expected Git blob SHA")
        source_path.write_bytes(source_data)
        text_path.write_text(characters, encoding="utf-8")

        subset.main(
            [
                str(source_path),
                f"--text-file={text_path}",
                f"--output-file={subset_path}",
                "--flavor=woff2",
                "--layout-features=",
                "--no-layout-closure",
                "--notdef-glyph",
                "--notdef-outline",
                "--recommended-glyphs",
                "--name-IDs=*",
                "--name-languages=*",
            ]
        )
        normalize_subset_font(subset_path)
        OUTPUT_PATH.write_bytes(subset_path.read_bytes())

    output_data = OUTPUT_PATH.read_bytes()
    manifest = {
        "family": FAMILY,
        "weight": WEIGHT,
        "sourceProject": "Adobe Source Han Serif",
        "sourceVersion": SOURCE_VERSION,
        "sourcePath": SOURCE_PATH,
        "sourceGitBlobSha": SOURCE_GIT_BLOB_SHA,
        "generator": {"fonttools": FONTTOOLS_VERSION, "brotli": BROTLI_VERSION},
        "characters": characters,
        "characterCount": len(characters),
        "sizeBytes": len(output_data),
        "sha256": hashlib.sha256(output_data).hexdigest(),
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"generated {OUTPUT_PATH.relative_to(ROOT)}: {len(output_data)} bytes, {len(characters)} chars")
    print(f"sha256={manifest['sha256']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
