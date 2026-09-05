#!/usr/bin/env python3
from pathlib import Path


def replace_exact(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one replacement target, found {count}")
    file.write_text(text.replace(old, new), encoding="utf-8")


replace_exact(
    "docs/UI_DESIGN_SYSTEM.md",
    '- 中文州全名继续复用通用可访问性与颜色令牌，但字体是战略地图专用思源宋体例外：地图 viewport 固定使用 `"Source Han Serif SC", "思源宋体", "Noto Serif CJK SC", "Noto Serif SC", "Songti SC", STSong, SimSun, serif`，地图州名固定使用思源宋体 SemiBold（600）；不得恢复 Playfair Display／Georgia、全局 Inter 无衬线继承，也不得依赖远程字体加载。该字体栈必须直接落在参与州名布局测量的地图 viewport 上，使 Canvas `measureText` 与真实 SVG glyph 继承同一计算字体与 600 字重；具体 SVG glyph 布局、相机同步和输入穿透规则由 `STRATEGIC_MAP_RENDERING_DESIGN.md` 定义。',
    '- 中文州全名继续复用通用可访问性与颜色令牌，但字体是战略地图专用思源宋体例外：地图 viewport 固定先使用自托管 `"Economy Map Serif"`，它由 Adobe Source Han Serif CN SemiBold 2.003R 通过 `scripts/generate-map-font-subset.py` 只保留 `shared/provinces.json` 当前 48 州 `name` 字段的去重中文字符生成，固定 600 字重并由 Vite 打包为本地 WOFF2；字体主名称必须保持 `Economy Map Serif` 以遵守上游 OFL 保留名称约束，许可证随 `public/licenses/source-han-serif-OFL-1.1.txt` 发布。子集资源不得超过 64 KiB，不得把完整 CJK 字体打入网页包，也不得在运行时从第三方加载字体；自托管资源不可用时才依次回退到 `"Source Han Serif SC", "思源宋体", "Noto Serif CJK SC", "Noto Serif SC", "Songti SC", STSong, SimSun, serif`。该字体栈必须直接落在参与州名布局测量的地图 viewport 上，使 Canvas `measureText` 与真实 SVG glyph 继承同一计算字体与 600 字重；州名发生增删改时必须重新生成子集并同步 manifest，具体 SVG glyph 布局、相机同步和输入穿透规则由 `STRATEGIC_MAP_RENDERING_DESIGN.md` 定义。',
)
replace_exact(
    "docs/UI_DESIGN_SYSTEM.md",
    '- 把地图州名恢复为英文州缩写、ECharts 默认标签、固定屏幕字号、州外／引线标签、全局 Inter／Playfair Display／Georgia 或其他非思源宋体优先栈，改用非 600 字重，或让中文州全名标签不再完整落在州面内部、不随地图缩放和平移同步重算；',
    '- 把地图州名恢复为英文州缩写、ECharts 默认标签、固定屏幕字号、州外／引线标签，移除本地 `Economy Map Serif` 子集、改回仅依赖系统字体、打包完整 CJK 字体、从第三方运行时加载字体、恢复全局 Inter／Playfair Display／Georgia、改用非 600 字重，或让中文州全名标签不再完整落在州面内部、不随地图缩放和平移同步重算；',
)

replace_exact(
    "tests/browser/province-map.spec.ts",
    """  const viewportFontFamily = await canvas.evaluate((node) => getComputedStyle(node).fontFamily);
  const labelFont = await map.locator('.province-map-label').first().evaluate((node) => ({
    family: getComputedStyle(node).fontFamily,
    weight: getComputedStyle(node).fontWeight,
  }));
  expect(viewportFontFamily).toContain('Source Han Serif SC');
  expect(viewportFontFamily).not.toContain('Playfair Display');
  expect(viewportFontFamily.toLowerCase()).toContain('serif');
  expect(labelFont.family).toBe(viewportFontFamily);
  expect(labelFont.weight).toBe('600');""",
    """  const bundledMapFont = await page.evaluate(async () => {
    await document.fonts.load('600 24px "Economy Map Serif"', '加利福尼亚得克萨斯华盛顿佛罗里达纽约');
    const face = [...document.fonts].find((candidate) => candidate.family === 'Economy Map Serif' && candidate.weight === '600');
    return face ? { family: face.family, weight: face.weight, status: face.status } : null;
  });
  expect(bundledMapFont).toEqual({ family: 'Economy Map Serif', weight: '600', status: 'loaded' });

  const viewportFontFamily = await canvas.evaluate((node) => getComputedStyle(node).fontFamily);
  const labelFont = await map.locator('.province-map-label').first().evaluate((node) => ({
    family: getComputedStyle(node).fontFamily,
    weight: getComputedStyle(node).fontWeight,
  }));
  expect(viewportFontFamily.split(',')[0]).toContain('Economy Map Serif');
  expect(viewportFontFamily).toContain('Source Han Serif SC');
  expect(viewportFontFamily).not.toContain('Playfair Display');
  expect(viewportFontFamily.toLowerCase()).toContain('serif');
  expect(labelFont.family).toBe(viewportFontFamily);
  expect(labelFont.weight).toBe('600');""",
)

verifier = Path("scripts/verify-province-map-focus.mjs")
text = verifier.read_text(encoding="utf-8")
replace_pairs = [
    (
        "import { readFileSync } from 'node:fs';",
        "import { createHash } from 'node:crypto';\nimport { readFileSync, statSync } from 'node:fs';",
    ),
    (
        "const mapBrowserSource = read('tests/browser/province-map.spec.ts');",
        "const mapBrowserSource = read('tests/browser/province-map.spec.ts');\nconst mapFontGeneratorSource = read('scripts/generate-map-font-subset.py');\nconst mapFontLicenseSource = read('public/licenses/source-han-serif-OFL-1.1.txt');\nconst mapFontManifest = JSON.parse(read('src/assets/fonts/economy-map-serif-600.manifest.json'));\nconst provinces = JSON.parse(read('shared/provinces.json'));\nconst expectedMapFontCharacters = [...new Set(provinces.map((province) => province.name).join(''))].sort().join('');\nconst mapFontPath = resolve(root, 'src/assets/fonts/economy-map-serif-600.woff2');\nconst mapFontBytes = readFileSync(mapFontPath);\nconst mapFontSha256 = createHash('sha256').update(mapFontBytes).digest('hex');",
    ),
    (
        """requireText(
  styleSource,
  'font-family: \"Source Han Serif SC\", \"思源宋体\", \"Noto Serif CJK SC\", \"Noto Serif SC\", \"Songti SC\", STSong, SimSun, serif;',
  'province map labels must use the Source Han Serif SC-first serif stack',
);""",
        """requireText(
  styleSource,
  '@font-face {',
  'province map must declare the self-hosted map font face',
);
requireText(
  styleSource,
  'url(\"../assets/fonts/economy-map-serif-600.woff2\") format(\"woff2\")',
  'province map must bundle the generated WOFF2 subset through Vite',
);
requireText(
  styleSource,
  'font-family: \"Economy Map Serif\", \"Source Han Serif SC\", \"思源宋体\", \"Noto Serif CJK SC\", \"Noto Serif SC\", \"Songti SC\", STSong, SimSun, serif;',
  'province map labels must prefer the bundled Economy Map Serif subset',
);""",
    ),
    (
        """requireText(
  uiDesignSource,
  '思源宋体 SemiBold（600）',
  'authoritative UI design must record Source Han Serif SemiBold as the strategic map label font',
);""",
        """requireText(
  uiDesignSource,
  '自托管 `\"Economy Map Serif\"`',
  'authoritative UI design must record the bundled strategic map font subset',
);""",
    ),
    (
        """requireText(
  mapBrowserSource,
  \"expect(viewportFontFamily).toContain('Source Han Serif SC');\",
  'province map browser regression must assert the Source Han Serif SC-first font stack',
);""",
        """requireText(
  mapBrowserSource,
  \"expect(bundledMapFont).toEqual({ family: 'Economy Map Serif', weight: '600', status: 'loaded' });\",
  'province map browser regression must assert the bundled font is actually loaded',
);
requireText(
  mapBrowserSource,
  \"expect(viewportFontFamily.split(',')[0]).toContain('Economy Map Serif');\",
  'province map browser regression must assert the bundled font is first in the map stack',
);""",
    ),
]
for old, new in replace_pairs:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"scripts/verify-province-map-focus.mjs: expected one target, found {count}: {old[:80]}")
    text = text.replace(old, new)

marker = "\nconsole.log('province map focus verification passed');\n"
integrity = """

if (mapFontManifest.family !== 'Economy Map Serif' || mapFontManifest.weight !== 600) {
  throw new Error('地图字体 manifest 必须保持 Economy Map Serif / 600');
}
if (mapFontManifest.characters !== expectedMapFontCharacters || mapFontManifest.characterCount !== expectedMapFontCharacters.length) {
  throw new Error('地图字体子集字符必须与 shared/provinces.json 当前州名字符完全一致');
}
if (mapFontManifest.sourceVersion !== '2.003R' || mapFontManifest.sourceGitBlobSha !== '44d7f0c522ee7e9c6cb373a5ef7e851f30b558a1') {
  throw new Error('地图字体必须保持固定 Source Han Serif 2.003R 来源');
}
if (mapFontManifest.generator?.fonttools !== '4.59.2' || mapFontManifest.generator?.brotli !== '1.1.0') {
  throw new Error('地图字体生成工具版本必须保持固定');
}
if (statSync(mapFontPath).size !== mapFontManifest.sizeBytes || mapFontManifest.sizeBytes > 64 * 1024) {
  throw new Error('地图 WOFF2 子集大小必须与 manifest 一致且不超过 64 KiB');
}
if (mapFontSha256 !== mapFontManifest.sha256) {
  throw new Error('地图 WOFF2 子集 SHA-256 与 manifest 不一致');
}
for (const expected of [
  'SOURCE_VERSION = \"2.003R\"',
  'SOURCE_GIT_BLOB_SHA = \"44d7f0c522ee7e9c6cb373a5ef7e851f30b558a1\"',
  'font[\"head\"].modified = font[\"head\"].created',
]) requireText(mapFontGeneratorSource, expected, `地图字体生成器缺少固定约束: ${expected}`);
requireText(mapFontLicenseSource, 'SIL OPEN FONT LICENSE Version 1.1', '地图字体必须随站点发布 OFL 1.1 许可证');
"""
if text.count(marker) != 1:
    raise SystemExit("verifier console marker missing")
verifier.write_text(text.replace(marker, integrity + marker), encoding="utf-8")
