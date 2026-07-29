from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_required(text: str, old: str, new: str, label: str, count: int = -1) -> str:
    if old not in text:
        raise SystemExit(f'missing replacement target: {label}')
    return text.replace(old, new, count)


def regex_required(text: str, pattern: str, replacement: str, label: str, count: int = 1) -> str:
    updated, matches = re.subn(pattern, replacement, text, count=count, flags=re.S)
    if matches != count:
        raise SystemExit(f'expected {count} regex match for {label}, found {matches}')
    return updated


surface_path = 'src/components/ui/LiquidGlassSurface.tsx'
surface = read(surface_path)
old_presets = """const DESKTOP_STATUS_GLASS = {
  displacementScale: 20,
  blurAmount: 0.0625,
  saturation: 120,
  aberrationIntensity: 0.15,
  elasticity: 0,
  cornerRadius: 24,
  mode: 'standard',
} as const;

const MOBILE_CHROME_GLASS = {
  displacementScale: 32,
  blurAmount: 0.1,
  saturation: 125,
  aberrationIntensity: 0.3,
  elasticity: 0,
  cornerRadius: 40,
  mode: 'standard',
} as const;

const DESKTOP_AUTH_CARD_GLASS = {
  displacementScale: 70,
  blurAmount: 0.0625,
  saturation: 140,
  aberrationIntensity: 2,
  elasticity: 0,
  cornerRadius: 24,
  mode: 'standard',
} as const;

const MOBILE_AUTH_CARD_GLASS = {
  displacementScale: 70,
  blurAmount: 0.0625,
  saturation: 140,
  aberrationIntensity: 2,
  elasticity: 0,
  cornerRadius: 40,
  mode: 'standard',
} as const;"""
new_presets = """const DESKTOP_STATUS_GLASS = {
  displacementScale: 120,
  blurAmount: 0,
  saturation: 120,
  aberrationIntensity: 2,
  elasticity: 0,
  cornerRadius: 24,
  mode: 'standard',
} as const;

const MOBILE_CHROME_GLASS = {
  displacementScale: 120,
  blurAmount: 0,
  saturation: 120,
  aberrationIntensity: 2,
  elasticity: 0,
  cornerRadius: 40,
  mode: 'standard',
} as const;

const DESKTOP_AUTH_CARD_GLASS = {
  displacementScale: 120,
  blurAmount: 0,
  saturation: 120,
  aberrationIntensity: 2,
  elasticity: 0,
  cornerRadius: 24,
  mode: 'standard',
} as const;

const MOBILE_AUTH_CARD_GLASS = {
  displacementScale: 120,
  blurAmount: 0,
  saturation: 120,
  aberrationIntensity: 2,
  elasticity: 0,
  cornerRadius: 40,
  mode: 'standard',
} as const;"""
surface = replace_required(surface, old_presets, new_presets, 'surface presets')
surface = replace_required(
    surface,
    '      data-liquid-glass-elasticity={preset.elasticity}\n',
    '      data-liquid-glass-elasticity={preset.elasticity}\n      data-liquid-glass-tint="dark"\n',
    'surface dark tint data attribute',
)
write(surface_path, surface)

css_path = 'src/styles/liquid-glass-surfaces.css'
css = read(css_path)
css = replace_required(
    css,
    '  --liquid-glass-contrast: rgba(194, 231, 214, 0.06);',
    '  --liquid-glass-tint-dark: rgba(3, 12, 8, 0.42);\n  --liquid-glass-contrast: var(--liquid-glass-tint-dark);',
    'global dark tint variable',
)
css = css.replace('-webkit-backdrop-filter: blur(6px) saturate(120%);', '-webkit-backdrop-filter: blur(0px) saturate(120%);')
css = css.replace('-webkit-backdrop-filter: blur(7.2px) saturate(125%);', '-webkit-backdrop-filter: blur(0px) saturate(120%);')
css = css.replace('-webkit-backdrop-filter: blur(6px) saturate(140%);', '-webkit-backdrop-filter: blur(0px) saturate(120%);')
write(css_path, css)

auth_test_path = 'tests/browser/auth-three-layer.spec.ts'
auth_test = read(auth_test_path)
auth_test = auth_test.replace('blur(6px)', 'blur(0px)')
auth_test = auth_test.replace(r'/saturate\((?:140%|1\.4)\)/', r'/saturate\((?:120%|1\.2)\)/')
auth_test = auth_test.replace('toBe(70)', 'toBe(120)')
auth_test = auth_test.replace(
    "await expect(surface).toHaveAttribute('data-liquid-glass-elasticity', '0');",
    "await expect(surface).toHaveAttribute('data-liquid-glass-elasticity', '0');\n      await expect(surface).toHaveAttribute('data-liquid-glass-tint', 'dark');",
)
auth_test = auth_test.replace(
    "await expect(surfaces).toHaveAttribute('data-liquid-glass-elasticity', '0');",
    "await expect(surfaces).toHaveAttribute('data-liquid-glass-elasticity', '0');\n      await expect(surfaces).toHaveAttribute('data-liquid-glass-tint', 'dark');",
)
write(auth_test_path, auth_test)

layout_test_path = 'tests/browser/liquid-glass-layout.spec.ts'
layout_test = read(layout_test_path)
layout_test = layout_test.replace("expect(layout.surfaceBackgroundColor).toBe('rgba(194, 231, 214, 0.06)');", "expect(layout.surfaceBackgroundColor).toBe('rgba(3, 12, 8, 0.42)');")
layout_test = layout_test.replace("expect(geometry.statusBackground).toBe('rgba(194, 231, 214, 0.06)');", "expect(geometry.statusBackground).toBe('rgba(3, 12, 8, 0.42)');")
layout_test = layout_test.replace("toContain('blur(6px)')", "toContain('blur(0px)')")
layout_test = layout_test.replace("toContain('blur(7.2px)')", "toContain('blur(0px)')")
layout_test = layout_test.replace(r'/saturate\((?:125%|1\.25)\)/', r'/saturate\((?:120%|1\.2)\)/')
layout_test = replace_required(
    layout_test,
    "    await expect(glassSurface).toHaveAttribute('data-liquid-glass-mode', 'standard');\n",
    "    await expect(glassSurface).toHaveAttribute('data-liquid-glass-mode', 'standard');\n    await expect(glassSurface).toHaveAttribute('data-liquid-glass-tint', 'dark');\n",
    'desktop tint browser assertion',
)
layout_test = replace_required(
    layout_test,
    "    await expect(statusSurface).toHaveAttribute('data-liquid-glass-mode', 'standard');\n",
    "    await expect(statusSurface).toHaveAttribute('data-liquid-glass-mode', 'standard');\n    await expect(statusSurface).toHaveAttribute('data-liquid-glass-tint', 'dark');\n",
    'mobile status tint browser assertion',
)
layout_test = replace_required(
    layout_test,
    "    await expect(navigationSurface).toHaveAttribute('data-liquid-glass-mode', 'standard');\n",
    "    await expect(navigationSurface).toHaveAttribute('data-liquid-glass-mode', 'standard');\n    await expect(navigationSurface).toHaveAttribute('data-liquid-glass-tint', 'dark');\n",
    'mobile navigation tint browser assertion',
)
write(layout_test_path, layout_test)

numeric_replacements = {
    'displacementScale: 20': 'displacementScale: 120',
    'displacementScale: 32': 'displacementScale: 120',
    'displacementScale: 70': 'displacementScale: 120',
    'blurAmount: 0.0625': 'blurAmount: 0',
    'blurAmount: 0.1': 'blurAmount: 0',
    'saturation: 125': 'saturation: 120',
    'saturation: 140': 'saturation: 120',
    'aberrationIntensity: 0.15': 'aberrationIntensity: 2',
    'aberrationIntensity: 0.3': 'aberrationIntensity: 2',
    '--liquid-glass-contrast: rgba(194, 231, 214, 0.06);': '--liquid-glass-tint-dark: rgba(3, 12, 8, 0.42);',
    '-webkit-backdrop-filter: blur(6px) saturate(120%);': '-webkit-backdrop-filter: blur(0px) saturate(120%);',
    '-webkit-backdrop-filter: blur(7.2px) saturate(125%);': '-webkit-backdrop-filter: blur(0px) saturate(120%);',
    '-webkit-backdrop-filter: blur(6px) saturate(140%);': '-webkit-backdrop-filter: blur(0px) saturate(120%);',
    '`blur(6px) saturate(120%)`': '`blur(0px) saturate(120%)`',
    '`blur(7.2px) saturate(125%)`': '`blur(0px) saturate(120%)`',
    '`displacementScale=70`': '`displacementScale=120`',
    'expect(Math.abs(glass.displacementScales[0])).toBe(70)': 'expect(Math.abs(glass.displacementScales[0])).toBe(120)',
    'toMatch(/saturate\\((?:140%|1\\.4)\\)/)': 'toMatch(/saturate\\((?:120%|1\\.2)\\)/)',
    '桌面与移动不得再次合并为同一个参数常量': '所有平台光学参数必须保持完全一致',
    '官方默认基线': '全局光学基线',
}

for verifier_path in ['scripts/verify-auth-three-layer.mjs', 'scripts/verify-liquid-glass-chrome.mjs']:
    verifier = read(verifier_path)
    for old, new in numeric_replacements.items():
        verifier = verifier.replace(old, new)
    verifier = verifier.replace(
        "'data-liquid-glass-elasticity={preset.elasticity}',",
        "'data-liquid-glass-elasticity={preset.elasticity}',\n    'data-liquid-glass-tint=\"dark\"'," if 'files.surface' in verifier else "'data-liquid-glass-elasticity={preset.elasticity}',\n  'data-liquid-glass-tint=\"dark\"',",
    )
    verifier = verifier.replace(
        "'--liquid-glass-tint-dark: rgba(3, 12, 8, 0.42);',",
        "'--liquid-glass-tint-dark: rgba(3, 12, 8, 0.42);',\n    '--liquid-glass-contrast: var(--liquid-glass-tint-dark);'," if 'files.styles' in verifier else "'--liquid-glass-tint-dark: rgba(3, 12, 8, 0.42);',\n  '--liquid-glass-contrast: var(--liquid-glass-tint-dark);',",
    )
    verifier = verifier.replace(
        "'统一使用 `--liquid-glass-contrast`',",
        "'统一使用 `--liquid-glass-contrast`',\n    '`--liquid-glass-tint-dark`'," if 'files.design' in verifier else "'统一使用 `--liquid-glass-contrast`',\n  '`--liquid-glass-tint-dark`',",
    )
    verifier = verifier.replace(
        "\"toHaveAttribute('data-liquid-glass-elasticity', '0')\",",
        "\"toHaveAttribute('data-liquid-glass-elasticity', '0')\",\n    \"toHaveAttribute('data-liquid-glass-tint', 'dark')\"," if 'files.authBrowser' in verifier else "\"toHaveAttribute('data-liquid-glass-elasticity', '0')\",\n  \"toHaveAttribute('data-liquid-glass-tint', 'dark')\"," ,
    )
    count_anchor = "if ((read(files.surface).match(/elasticity:\\s*0,/g) ?? []).length !== 4) {" if 'files.surface' in verifier else "if ((read('src/components/ui/LiquidGlassSurface.tsx').match(/elasticity:\\s*0,/g) ?? []).length !== 4) {"
    source_expr = 'read(files.surface)' if 'files.surface' in verifier else "read('src/components/ui/LiquidGlassSurface.tsx')"
    checks = f"""if (({source_expr}.match(/displacementScale:\\s*120,/g) ?? []).length !== 4) {{
    failures.push('四个玻璃预设必须全部固定 displacementScale: 120');
  }}
  if (({source_expr}.match(/blurAmount:\\s*0,/g) ?? []).length !== 4) {{
    failures.push('四个玻璃预设必须全部固定 blurAmount: 0');
  }}
  if (({source_expr}.match(/saturation:\\s*120,/g) ?? []).length !== 4) {{
    failures.push('四个玻璃预设必须全部固定 saturation: 120');
  }}
  if (({source_expr}.match(/aberrationIntensity:\\s*2,/g) ?? []).length !== 4) {{
    failures.push('四个玻璃预设必须全部固定 aberrationIntensity: 2');
  }}
  """
    verifier = replace_required(verifier, count_anchor, checks + count_anchor, f'{verifier_path} global counts')
    write(verifier_path, verifier)

design_path = 'docs/LIQUID_GLASS_CHROME_DESIGN.md'
design = read(design_path)
design = design.replace('桌面与移动不得再次合并为同一个参数常量', '四个预设继续保留独立圆角常量，但所有平台光学参数必须保持完全一致')
global_section = """## 3. 全局液态玻璃参数与平台几何

禁止 `shader` 模式。桌面状态栏、管理员桌面工作栏、移动状态栏、移动底栏、桌面认证卡片和移动认证卡片全局统一使用以下光学与静态输入参数：

- `mode="standard"`；
- `displacementScale: 120`；
- `blurAmount: 0`，对应 `blur(0px)`；
- `saturation: 120`；
- `aberrationIntensity: 2`；
- `elasticity: 0`；
- `mouseContainer={null}`；
- 固定 `globalMousePos` 与 `mouseOffset`。

所有平台光学参数必须保持完全一致，不得为状态栏、移动 Chrome 或认证卡片恢复较弱位移、非零模糊、不同饱和度或不同色差。四个预设继续保留独立圆角常量：`DESKTOP_STATUS_GLASS` 与 `DESKTOP_AUTH_CARD_GLASS` 使用 `24px`，`MOBILE_CHROME_GLASS` 与 `MOBILE_AUTH_CARD_GLASS` 使用 `40px`。移动状态栏与移动底栏继续共享 `MOBILE_CHROME_GLASS`，桌面与移动认证卡片仍保持独立 variant 和内容高度规则。

全部五种 variant 必须启用 dark tint：`:root` 定义 `--liquid-glass-tint-dark: rgba(3, 12, 8, 0.42)`，`--liquid-glass-contrast` 只能指向该变量，所有 `.liquid-glass-surface` 宿主统一使用该半透明深色染色。`liquid-glass-react@1.1.1` 没有 tint 或 color-scheme prop，因此不得伪造第三方参数或引入第二套玻璃组件；dark tint 只能由统一宿主染色实现。每个宿主必须暴露 `data-liquid-glass-tint="dark"` 供浏览器回归验证。
"""
design = regex_required(design, r'## 3\. 平台分离参数预设\n.*?(?=\n## 4\. 平台能力边界)', global_section.rstrip(), 'global design section')
design = design.replace('桌面状态栏的 `-webkit-backdrop-filter` 必须严格为 `blur(6px) saturate(120%)`，移动状态栏与底栏必须严格为 `blur(7.2px) saturate(125%)`，桌面／移动认证卡片统一为官方默认 `blur(6px) saturate(140%)`', '所有状态栏、管理员工作栏、移动底栏和认证卡片的 `-webkit-backdrop-filter` 必须严格统一为 `blur(0px) saturate(120%)`')
design = design.replace('支持环境中的桌面状态栏、管理员桌面工作栏、移动状态栏、底栏和认证卡片统一使用宿主低密度透明染色 `rgba(194, 231, 214, 0.06)`，统一使用 `--liquid-glass-contrast`', '支持环境中的桌面状态栏、管理员桌面工作栏、移动状态栏、底栏和认证卡片统一使用 dark tint `rgba(3, 12, 8, 0.42)`，并通过 `--liquid-glass-tint-dark` → `--liquid-glass-contrast` 单向引用')
design = regex_required(design, r'9\. 桌面状态栏使用 .*?。', '9. 所有液态玻璃变体统一使用 `blur(0px) saturate(120%)`、位移尺度 `120`、色差 `2`、弹性 `0` 和 dark tint `rgba(3, 12, 8, 0.42)`。', 'acceptance optical rule')
write(design_path, design)

auth_design_path = 'docs/REGISTRATION_INVITE_FLOW_DESIGN.md'
auth_design = read(auth_design_path)
auth_design = auth_design.replace('官方默认基线', '全局光学基线')
auth_design = auth_design.replace('`displacementScale=70`', '`displacementScale=120`')
auth_design = auth_design.replace('`blurAmount=0.0625`', '`blurAmount=0`')
auth_design = auth_design.replace('`saturation=140`', '`saturation=120`')
auth_design = auth_design.replace('官方默认 `cornerRadius=999`', '第三方默认 `cornerRadius=999`')
auth_design = auth_design.replace('不得降低认证卡片的位移尺度、饱和度或色差，也不得重新把认证卡片的 `elasticity` 改为非零值。', '认证卡片必须与状态栏和移动底栏保持同一全局光学参数，不得恢复认证专用数值，也不得把 `elasticity` 改为非零值。')
auth_design = auth_design.replace('统一把低密度透明染色放在 `.liquid-glass-surface` 宿主，并统一使用 `--liquid-glass-contrast`', '统一在 `.liquid-glass-surface` 宿主启用 dark tint `--liquid-glass-tint-dark: rgba(3, 12, 8, 0.42)`，并由 `--liquid-glass-contrast` 单向引用')
auth_design = auth_design.replace('官方位移尺度 70、`blur(6px) saturate(140%)`', '全局位移尺度 120、`blur(0px) saturate(120%)`、dark tint')
write(auth_design_path, auth_design)

source = read(surface_path)
for pattern, expected in [
    (r'displacementScale:\s*120,', 4),
    (r'blurAmount:\s*0,', 4),
    (r'saturation:\s*120,', 4),
    (r'aberrationIntensity:\s*2,', 4),
    (r'elasticity:\s*0,', 4),
]:
    actual = len(re.findall(pattern, source))
    if actual != expected:
        raise SystemExit(f'{pattern} expected {expected}, found {actual}')
if 'data-liquid-glass-tint="dark"' not in source:
    raise SystemExit('missing dark tint data attribute')
css = read(css_path)
for required in [
    '--liquid-glass-tint-dark: rgba(3, 12, 8, 0.42);',
    '--liquid-glass-contrast: var(--liquid-glass-tint-dark);',
    '-webkit-backdrop-filter: blur(0px) saturate(120%);',
]:
    if required not in css:
        raise SystemExit(f'missing CSS rule: {required}')
for forbidden in ['blur(6px) saturate(120%)', 'blur(7.2px) saturate(125%)', 'blur(6px) saturate(140%)']:
    if forbidden in css:
        raise SystemExit(f'old CSS optical value remains: {forbidden}')
