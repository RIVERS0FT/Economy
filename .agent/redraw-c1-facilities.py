from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIRECTORY = ROOT / "src/assets/facility-icons"
BASELINE_PATH = ROOT / "scripts/facility-artwork-baseline.json"
TARGET_SIZE = 1024

C1_CONFIG = {
    "farm": {
        "crop": (0.07, 0.05, 0.93, 0.91),
        "saturation": 0.80,
        "contrast": 0.95,
        "brightness": 0.99,
        "vignette": 0.10,
    },
    "orchard": {
        "crop": (0.08, 0.06, 0.92, 0.90),
        "saturation": 0.78,
        "contrast": 0.95,
        "brightness": 0.99,
        "vignette": 0.09,
    },
    "ranch": {
        "crop": (0.07, 0.05, 0.93, 0.91),
        "saturation": 0.78,
        "contrast": 0.95,
        "brightness": 0.99,
        "vignette": 0.09,
    },
    "fishery": {
        "crop": (0.06, 0.04, 0.94, 0.92),
        "saturation": 0.76,
        "contrast": 0.95,
        "brightness": 1.00,
        "vignette": 0.08,
    },
}


def crop_subject(image: Image.Image, crop: tuple[float, float, float, float]) -> Image.Image:
    width, height = image.size
    left = round(width * crop[0])
    top = round(height * crop[1])
    right = round(width * crop[2])
    bottom = round(height * crop[3])
    if right <= left or bottom <= top:
        raise ValueError(f"Invalid crop: {crop}")
    return image.crop((left, top, right, bottom)).resize(
        (TARGET_SIZE, TARGET_SIZE),
        Image.Resampling.LANCZOS,
    )


def apply_vignette(image: Image.Image, strength: float) -> Image.Image:
    width, height = image.size
    mask = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(mask)
    margin_x = round(width * 0.08)
    margin_y = round(height * 0.06)
    draw.ellipse(
        (-margin_x, -margin_y, width + margin_x, height + margin_y),
        fill=255,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(radius=round(width * 0.16)))
    minimum = round(255 * (1 - strength))
    mask = mask.point(lambda value: minimum + round((255 - minimum) * value / 255))
    shadow = Image.new("RGB", image.size, (20, 27, 24))
    return Image.composite(image, shadow, mask)


def redraw(source_path: Path, config: dict[str, object]) -> Image.Image:
    with Image.open(source_path) as source:
        image = crop_subject(source.convert("RGB"), config["crop"])

    image = ImageEnhance.Color(image).enhance(float(config["saturation"]))
    image = ImageEnhance.Contrast(image).enhance(float(config["contrast"]))
    image = ImageEnhance.Brightness(image).enhance(float(config["brightness"]))

    # Restrain HDR-like micro-contrast without making the scene soft at 128 px.
    softened = image.filter(ImageFilter.GaussianBlur(radius=0.55))
    image = Image.blend(image, softened, 0.08)
    image = ImageEnhance.Sharpness(image).enhance(1.08)
    image = apply_vignette(image, float(config["vignette"]))
    return image.convert("RGBA")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    missing = [
        facility_id
        for facility_id in C1_CONFIG
        if not (SOURCE_DIRECTORY / f"{facility_id}.png").is_file()
    ]
    if missing:
        raise SystemExit(f"Missing C1 source artwork: {', '.join(missing)}")

    for facility_id, config in C1_CONFIG.items():
        source_path = SOURCE_DIRECTORY / f"{facility_id}.png"
        image = redraw(source_path, config)
        image.save(source_path, format="PNG", optimize=True, compress_level=9)

    baseline = {
        "version": 1,
        "style": "subject-first-road-optional-2026-08-02",
        "complexity": "C1",
        "facilityIds": list(C1_CONFIG),
        "sha256": {
            facility_id: sha256(SOURCE_DIRECTORY / f"{facility_id}.png")
            for facility_id in C1_CONFIG
        },
    }
    BASELINE_PATH.write_text(
        json.dumps(baseline, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    for facility_id in C1_CONFIG:
        with Image.open(SOURCE_DIRECTORY / f"{facility_id}.png") as image:
            if image.size != (TARGET_SIZE, TARGET_SIZE) or image.mode != "RGBA":
                raise SystemExit(
                    f"{facility_id}.png must be 1024x1024 RGBA, got {image.size} {image.mode}"
                )

    print(
        "Redrew C1 facility artwork: "
        + ", ".join(C1_CONFIG)
        + "; wrote SHA-256 baseline."
    )


if __name__ == "__main__":
    main()
