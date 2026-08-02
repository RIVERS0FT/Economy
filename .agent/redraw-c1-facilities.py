from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIRECTORY = ROOT / "src/assets/facility-icons"
BASELINE_PATH = ROOT / "scripts/facility-artwork-baseline.json"
UI_DESIGN_PATH = ROOT / "docs/UI_DESIGN_SYSTEM.md"
VERIFIER_PATH = ROOT / "scripts/verify-facility-artwork.mjs"
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


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}: {old!r}; found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


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


def update_design() -> None:
    replace_once(
        UI_DESIGN_PATH,
        "- 明亮自然的日间环境光，具有清晰高光、柔和阴影、蓝天白云与通透空气感；色彩鲜明但不过度饱和；",
        "- 明亮自然的日间环境光，具有清晰高光、柔和阴影、蓝天白云与通透空气感；色彩鲜明但不过度饱和，不得使用夸张 HDR、荧光草地或过强青蓝天空抢夺主体；",
    )
    replace_once(
        UI_DESIGN_PATH,
        "- 主体建筑或主要设施居中或略居中并保持完整清晰，前景、中景、背景层次分明；道路、地形或生产流线应引导视线到主体；",
        "\n".join([
            "- 主体建筑或主要设施居中或略居中并保持完整清晰，通常应占画面宽度约 `60%–80%`、高度约 `50%–70%`，缩小到真实卡片尺寸后仍必须成为第一视觉元素；",
            "- 核心主体必须落在中央约 `80%` 安全区域内，以适应正方形源图到 `4:5` 竖卡的居中裁切；天空通常控制在画面高度约 `20%–30%`，大面积空地、田野、水面或堆场不得压低主体识别度；",
            "- 道路不是必选元素，不得为了统一构图强制加入道路。可根据产业语义使用作物行、果树排列、围栏、坡向、管线、传送带、轨道、池体边界或建筑组团形成视觉引导，也允许直接依靠主体尺度、光影和前后层次建立焦点；",
            "- 确需表现道路、装卸场或服务步道时，其面积、亮度和透视强度必须低于主体，不得从底边以超广角大面积铺满画面；交通空间只承担产业识别或轻量引导，不得成为画面面积最大或对比最强的元素；",
        ]),
    )
    c1_rule = (
        "当前 C1 复杂度工厂 `farm`、`orchard`、`ranch` 与 `fishery` 已按“主体优先、道路可选、低饱和度”的基线重新取景与重绘："
        "农场突出谷仓和粮仓建筑群，果园突出果树与作业建筑，畜牧场突出主畜舍、牧场和牲畜，渔场突出养殖池、服务步道与处理设施。"
        "四张图都必须在实际 `4:5` 居中裁切后保持主体完整，且不得恢复“底部宽阔道路—远处小建筑—高饱和蓝天”的统一模板。"
        "当前批准源图的 SHA-256 记录在 `scripts/facility-artwork-baseline.json`，由 `scripts/verify-facility-artwork.mjs` 校验；"
        "替换任一 C1 图片时必须同时更新本节视觉规则、机器基线和审核结果，不得只覆盖 PNG。"
    )
    replace_once(
        UI_DESIGN_PATH,
        "\n运行时不得直接加载 1024px 源图。",
        f"\n{c1_rule}\n\n运行时不得直接加载 1024px 源图。",
    )
    replace_once(
        UI_DESIGN_PATH,
        "`scripts/verify-facility-artwork.mjs` 必须校验目录一一对应、源图、缩略图、映射、生成入口、批准使用上下文、低流量回退和未知 ID 降级。",
        "`scripts/verify-facility-artwork.mjs` 必须校验目录一一对应、源图、缩略图、映射、生成入口、批准使用上下文、低流量回退、未知 ID 降级，以及 C1 目录与批准源图 SHA-256 基线一致。",
    )


def update_verifier() -> None:
    replace_once(
        VERIFIER_PATH,
        "import { existsSync, readFileSync, readdirSync } from 'node:fs';",
        "import { createHash } from 'node:crypto';\nimport { existsSync, readFileSync, readdirSync } from 'node:fs';",
    )
    replace_once(
        VERIFIER_PATH,
        "const facilityIds = FACILITY_TYPE_CATALOG.map((facility) => facility.id);",
        "const facilityIds = FACILITY_TYPE_CATALOG.map((facility) => facility.id);\nconst c1FacilityIds = FACILITY_TYPE_CATALOG\n  .filter((facility) => facility.complexity === 'C1')\n  .map((facility) => facility.id);",
    )
    replace_once(
        VERIFIER_PATH,
        "  uiDesign: 'docs/UI_DESIGN_SYSTEM.md',",
        "  uiDesign: 'docs/UI_DESIGN_SYSTEM.md',\n  artworkBaseline: 'scripts/facility-artwork-baseline.json',",
    )
    replace_once(
        VERIFIER_PATH,
        "  const uiDesign = read(paths.uiDesign);\n  const designIndex = read(paths.designIndex);",
        "\n".join([
            "  const uiDesign = read(paths.uiDesign);",
            "  const artworkBaseline = JSON.parse(read(paths.artworkBaseline));",
            "  const baselineFacilityIds = Array.isArray(artworkBaseline.facilityIds)",
            "    ? artworkBaseline.facilityIds",
            "    : [];",
            "  const baselineHashes = artworkBaseline.sha256",
            "    && typeof artworkBaseline.sha256 === 'object'",
            "    ? artworkBaseline.sha256",
            "    : {};",
            "  if (artworkBaseline.version !== 1",
            "    || artworkBaseline.style !== 'subject-first-road-optional-2026-08-02'",
            "    || artworkBaseline.complexity !== 'C1') {",
            "    failures.push(`${paths.artworkBaseline} 不是当前 C1 主体优先／道路可选基线`);",
            "  }",
            "  const designIndex = read(paths.designIndex);",
        ]),
    )
    replace_once(
        VERIFIER_PATH,
        "  if (JSON.stringify(actualSources) !== JSON.stringify(expectedSources)) {\n    failures.push('工厂场景源图必须与服务器工厂目录一一对应，不得缺失或保留目录外 PNG');\n  }\n\n  for (const facilityId of facilityIds) {",
        "\n".join([
            "  if (JSON.stringify(actualSources) !== JSON.stringify(expectedSources)) {",
            "    failures.push('工厂场景源图必须与服务器工厂目录一一对应，不得缺失或保留目录外 PNG');",
            "  }",
            "  if (JSON.stringify(baselineFacilityIds) !== JSON.stringify(c1FacilityIds)) {",
            "    failures.push(",
            "      `${paths.artworkBaseline} 的 C1 工厂顺序必须等于服务器目录：${c1FacilityIds.join(', ')}`,",
            "    );",
            "  }",
            "",
            "  for (const facilityId of facilityIds) {",
        ]),
    )
    replace_once(
        VERIFIER_PATH,
        "    validatePng(thumbnailPath, 128, '工厂场景运行时缩略图');\n\n    if (!styles.includes(`[data-facility-icon='${facilityId}']`)) {",
        "\n".join([
            "    validatePng(thumbnailPath, 128, '工厂场景运行时缩略图');",
            "",
            "    if (c1FacilityIds.includes(facilityId)) {",
            "      const expectedHash = baselineHashes[facilityId];",
            "      if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) {",
            "        failures.push(`${paths.artworkBaseline} 缺少 ${facilityId} 的有效 SHA-256`);",
            "      } else {",
            "        const actualHash = createHash('sha256')",
            "          .update(readFileSync(resolve(root, sourcePath)))",
            "          .digest('hex');",
            "        if (actualHash !== expectedHash) {",
            "          failures.push(`${sourcePath} 已偏离批准的 C1 插画基线`);",
            "        }",
            "      }",
            "    }",
            "",
            "    if (!styles.includes(`[data-facility-icon='${facilityId}']`)) {",
        ]),
    )
    replace_once(
        VERIFIER_PATH,
        "      '主体建筑或主要设施居中或略居中',\n      '无文字、无人物、无水印、无品牌标志',",
        "\n".join([
            "      '主体建筑或主要设施居中或略居中',",
            "      '通常应占画面宽度约 `60%–80%`',",
            "      '核心主体必须落在中央约 `80%` 安全区域',",
            "      '天空通常控制在画面高度约 `20%–30%`',",
            "      '道路不是必选元素',",
            "      '不得为了统一构图强制加入道路',",
            "      '当前 C1 复杂度工厂 `farm`、`orchard`、`ranch` 与 `fishery`',",
            "      '`scripts/facility-artwork-baseline.json`',",
            "      '无文字、无人物、无水印、无品牌标志',",
        ]),
    )
    replace_once(
        VERIFIER_PATH,
        "  `工厂场景插画验证通过：${facilityIds.length} 种正式工厂与 1024×1024 RGBA 源图、128×128 运行时缩略图、ID 映射、上下可读性渐变和主视觉使用边界一致。`,",
        "  `工厂场景插画验证通过：${facilityIds.length} 种正式工厂与 1024×1024 RGBA 源图、128×128 运行时缩略图、ID 映射、上下可读性渐变、主视觉使用边界及 C1 SHA-256 基线一致。`,",
    )


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

    update_design()
    update_verifier()

    for facility_id in C1_CONFIG:
        with Image.open(SOURCE_DIRECTORY / f"{facility_id}.png") as image:
            if image.size != (TARGET_SIZE, TARGET_SIZE) or image.mode != "RGBA":
                raise SystemExit(
                    f"{facility_id}.png must be 1024x1024 RGBA, got {image.size} {image.mode}"
                )

    print(
        "Redrew C1 facility artwork and updated design/verifier: "
        + ", ".join(C1_CONFIG)
        + "; wrote SHA-256 baseline."
    )


if __name__ == "__main__":
    main()
