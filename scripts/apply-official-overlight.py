from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_required(text: str, old: str, new: str, label: str, count: int = 1) -> str:
    if old not in text:
        raise SystemExit(f'missing replacement target: {label}')
    return text.replace(old, new, count)


def regex_required(text: str, pattern: str, replacement: str, label: str, count: int = 1) -> str:
    updated, matches = re.subn(pattern, replacement, text, count=count, flags=re.S)
    if matches != count:
        raise SystemExit(f'expected {count} regex match for {label}, found {matches}')
    return updated


# Runtime adapter: official overLight is the requested dark tint.
surface_path = 'src/components/ui/LiquidGlassSurface.tsx'
surface = read(surface_path)
surface = replace_required(
    surface,
    "const STATIC_MOUSE_OFFSET = { x: 0, y: 0 };\n",
    "const STATIC_MOUSE_OFFSET = { x: 0, y: 0 };\nconst GLOBAL_OVER_LIGHT = true;\n",
    'global over-light constant',
)
surface = replace_required(
    surface,
    '      mode={preset.mode}\n      mouseContainer={null}\n',
    '      mode={preset.mode}\n      overLight={GLOBAL_OVER_LIGHT}\n      mouseContainer={null}\n',
    'overLight prop',
)
surface = replace_required(
    surface,
    '      data-liquid-glass-elasticity={preset.elasticity}\n      data-liquid-glass-tint="dark"\n',
    "      data-liquid-glass-elasticity={preset.elasticity}\n      data-liquid-glass-over-light={GLOBAL_OVER_LIGHT ? 'true' : 'false'}\n      data-liquid-glass-displacement-scale={preset.displacementScale}\n      data-liquid-glass-blur-amount={preset.blurAmount}\n      data-liquid-glass-saturation={preset.saturation}\n      data-liquid-glass-aberration-intensity={preset.aberrationIntensity}\n",
    'runtime parameter data attributes',
)
write(surface_path, surface)

# CSS: remove the custom tint implementation, retain support tint, expose official over-light layers.
styles_path = 'src/styles/liquid-glass-surfaces.css'
styles = read(styles_path)
styles = styles.replace(
    ' * chromatic aberration in CSS. Status bars suppress upstream decoration;\n * authentication cards retain the official edge highlights. */',
    ' * chromatic aberration in CSS. Status bars suppress upstream border highlights;\n * all surfaces retain the official over-light tint layers. */',
)
styles = replace_required(
    styles,
    '  --liquid-glass-tint-dark: rgba(3, 12, 8, 0.42);\n  --liquid-glass-contrast: var(--liquid-glass-tint-dark);',
    '  --liquid-glass-contrast: rgba(194, 231, 214, 0.06);',
    'restore low-density support tint',
)
styles = styles.replace('-webkit-backdrop-filter: blur(0px) saturate(120%);', '-webkit-backdrop-filter: blur(12px) saturate(120%);')
old_hidden = '''.liquid-glass-surface--desktopStatusBar > div:not(.liquid-glass-surface__effect),
.liquid-glass-surface--mobileStatusBar > div:not(.liquid-glass-surface__effect),
.liquid-glass-surface--mobileNavigation > div:not(.liquid-glass-surface__effect) {
  display: none !important;
}
'''
new_overlight = '''.liquid-glass-surface[data-liquid-glass-over-light="true"] > div:not(.liquid-glass-surface__effect) {
  display: block !important;
  visibility: visible !important;
  pointer-events: none !important;
  background: #000 !important;
}

.liquid-glass-surface[data-liquid-glass-over-light="true"] > div:not(.liquid-glass-surface__effect):first-of-type {
  opacity: 0.2 !important;
}

.liquid-glass-surface[data-liquid-glass-over-light="true"] > div:not(.liquid-glass-surface__effect):nth-of-type(2) {
  opacity: 1 !important;
  mix-blend-mode: overlay !important;
}
'''
styles = replace_required(styles, old_hidden, new_overlight, 'official over-light visibility')
old_auth_hidden = '''.liquid-glass-surface--desktopAuthCard > div:not(.liquid-glass-surface__effect),
.liquid-glass-surface--mobileAuthCard > div:not(.liquid-glass-surface__effect) {
  display: none !important;
  opacity: 0 !important;
}
'''
new_auth_geometry = '''.login-card > .liquid-glass-surface--desktopAuthCard[data-liquid-glass-over-light="true"] > div:not(.liquid-glass-surface__effect),
.login-card > .liquid-glass-surface--mobileAuthCard[data-liquid-glass-over-light="true"] > div:not(.liquid-glass-surface__effect) {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  border-radius: inherit !important;
  transform: none !important;
  transition: none !important;
}
'''
styles = replace_required(styles, old_auth_hidden, new_auth_geometry, 'auth over-light host geometry')
write(styles_path, styles)

# Authentication browser contract.
auth_test_path = 'tests/browser/auth-three-layer.spec.ts'
auth_test = read(auth_test_path)
auth_test = replace_required(
    auth_test,
    '    const directAuxiliaryDivs = Array.from(surface.children)\n      .filter((element): element is HTMLElement => (\n        element instanceof HTMLElement\n        && element.tagName === \'DIV\'\n        && !element.classList.contains(\'liquid-glass-surface__effect\')\n      ));\n',
    '    const directAuxiliaryDivs = Array.from(surface.children)\n      .filter((element): element is HTMLElement => (\n        element instanceof HTMLElement\n        && element.tagName === \'DIV\'\n        && !element.classList.contains(\'liquid-glass-surface__effect\')\n      ));\n    const directAuxiliaryStyles = directAuxiliaryDivs.map((element) => getComputedStyle(element));\n    const directAuxiliaryRects = directAuxiliaryDivs.map((element) => element.getBoundingClientRect());\n',
    'auth auxiliary geometry capture',
)
auth_test = replace_required(
    auth_test,
    '      surfaceElasticity: surface.dataset.liquidGlassElasticity,\n',
    '      surfaceElasticity: surface.dataset.liquidGlassElasticity,\n      surfaceOverLight: surface.dataset.liquidGlassOverLight,\n      configuredDisplacementScale: surface.dataset.liquidGlassDisplacementScale,\n      configuredBlurAmount: surface.dataset.liquidGlassBlurAmount,\n      configuredSaturation: surface.dataset.liquidGlassSaturation,\n      configuredAberrationIntensity: surface.dataset.liquidGlassAberrationIntensity,\n',
    'auth runtime parameter reads',
)
auth_test = replace_required(
    auth_test,
    '      directAuxiliaryDivCount: directAuxiliaryDivs.length,\n      visibleDirectAuxiliaryDivCount: directAuxiliaryDivs.filter(isVisible).length,\n',
    '      directAuxiliaryDivCount: directAuxiliaryDivs.length,\n      visibleDirectAuxiliaryDivCount: directAuxiliaryDivs.filter(isVisible).length,\n      directAuxiliaryBottoms: directAuxiliaryRects.map((rect) => rect.bottom),\n      directAuxiliaryTransitionProperties: directAuxiliaryStyles.map((style) => style.transitionProperty),\n',
    'auth auxiliary result fields',
)
auth_test = auth_test.replace('visibleDirectAuxiliaryDivCount: 0,', 'visibleDirectAuxiliaryDivCount: 2,')
auth_test = replace_required(
    auth_test,
    "  expect(glass.directDecorationTransitionProperties).toEqual(['none', 'none']);\n",
    "  expect(glass.directDecorationTransitionProperties).toEqual(['none', 'none']);\n  expect(glass.directAuxiliaryBottoms).toHaveLength(2);\n  expect(glass.directAuxiliaryBottoms.every((bottom) => Math.abs(glass.surfaceBottom - bottom) <= 1)).toBe(true);\n  expect(glass.directAuxiliaryTransitionProperties).toEqual(['none', 'none']);\n",
    'auth next-frame over-light geometry',
)
auth_test = auth_test.replace("toHaveAttribute('data-liquid-glass-tint', 'dark')", "toHaveAttribute('data-liquid-glass-over-light', 'true')")
auth_test = auth_test.replace("toContain('blur(0px)')", "toContain('blur(12px)')")
auth_test = auth_test.replace('expect(Math.abs(glass.displacementScales[0])).toBe(120);', 'expect(Math.abs(glass.displacementScales[0])).toBe(60);')
auth_test = auth_test.replace('expect(Math.abs(loginGlass.displacementScales[0])).toBe(120);', 'expect(Math.abs(loginGlass.displacementScales[0])).toBe(60);')
auth_test = auth_test.replace('expect(glass.directAuxiliaryDivCount).toBeGreaterThanOrEqual(2);', 'expect(glass.directAuxiliaryDivCount).toBe(2);\n      expect(glass.visibleDirectAuxiliaryDivCount).toBe(2);')
auth_test = auth_test.replace('expect(loginGlass.directAuxiliaryDivCount).toBeGreaterThanOrEqual(2);', 'expect(loginGlass.directAuxiliaryDivCount).toBe(2);\n      expect(loginGlass.visibleDirectAuxiliaryDivCount).toBe(2);')
auth_test = replace_required(
    auth_test,
    "      expect(glass.surfaceElasticity).toBe('0');\n",
    "      expect(glass.surfaceElasticity).toBe('0');\n      expect(glass.surfaceOverLight).toBe('true');\n      expect(glass.configuredDisplacementScale).toBe('120');\n      expect(glass.configuredBlurAmount).toBe('0');\n      expect(glass.configuredSaturation).toBe('120');\n      expect(glass.configuredAberrationIntensity).toBe('2');\n",
    'desktop configured parameter assertions',
)
auth_test = replace_required(
    auth_test,
    "      expect(loginGlass.surfaceElasticity).toBe('0');\n",
    "      expect(loginGlass.surfaceElasticity).toBe('0');\n      expect(loginGlass.surfaceOverLight).toBe('true');\n      expect(loginGlass.configuredDisplacementScale).toBe('120');\n      expect(loginGlass.configuredBlurAmount).toBe('0');\n      expect(loginGlass.configuredSaturation).toBe('120');\n      expect(loginGlass.configuredAberrationIntensity).toBe('2');\n",
    'mobile configured parameter assertions',
)
write(auth_test_path, auth_test)

# Shared shell browser contract.
layout_test_path = 'tests/browser/liquid-glass-layout.spec.ts'
layout_test = read(layout_test_path)
layout_test = layout_test.replace("toHaveAttribute('data-liquid-glass-tint', 'dark')", "toHaveAttribute('data-liquid-glass-over-light', 'true')")
layout_test = layout_test.replace("expect(layout.surfaceBackgroundColor).toBe('rgba(3, 12, 8, 0.42)');", "expect(layout.surfaceBackgroundColor).toBe('rgba(194, 231, 214, 0.06)');")
layout_test = layout_test.replace("expect(geometry.statusBackground).toBe('rgba(3, 12, 8, 0.42)');", "expect(geometry.statusBackground).toBe('rgba(194, 231, 214, 0.06)');")
layout_test = layout_test.replace("toContain('blur(0px)')", "toContain('blur(12px)')")
layout_test = layout_test.replace('expect(layout.visibleAuxiliaryDivCount).toBe(0);', 'expect(layout.visibleAuxiliaryDivCount).toBe(2);')
layout_test = replace_required(
    layout_test,
    '      const visibleDirectSpanCount = (surface: HTMLElement) => Array.from(surface.children)\n        .filter((element): element is HTMLElement => element instanceof HTMLElement && element.tagName === \'SPAN\')\n        .filter((element) => {\n          const style = getComputedStyle(element);\n          return style.display !== \'none\' && style.visibility !== \'hidden\' && Number.parseFloat(style.opacity) > 0;\n        }).length;\n',
    '      const visibleDirectSpanCount = (surface: HTMLElement) => Array.from(surface.children)\n        .filter((element): element is HTMLElement => element instanceof HTMLElement && element.tagName === \'SPAN\')\n        .filter((element) => {\n          const style = getComputedStyle(element);\n          return style.display !== \'none\' && style.visibility !== \'hidden\' && Number.parseFloat(style.opacity) > 0;\n        }).length;\n      const visibleDirectAuxiliaryDivCount = (surface: HTMLElement) => Array.from(surface.children)\n        .filter((element): element is HTMLElement => (\n          element instanceof HTMLElement\n          && element.tagName === \'DIV\'\n          && !element.classList.contains(\'liquid-glass-surface__effect\')\n        ))\n        .filter((element) => {\n          const style = getComputedStyle(element);\n          return style.display !== \'none\' && style.visibility !== \'hidden\' && Number.parseFloat(style.opacity) > 0;\n        }).length;\n',
    'mobile auxiliary count helper',
)
layout_test = replace_required(
    layout_test,
    '        navigationVisibleDecorationSpanCount: visibleDirectSpanCount(navigationSurfaceElement),\n',
    '        navigationVisibleDecorationSpanCount: visibleDirectSpanCount(navigationSurfaceElement),\n        statusVisibleAuxiliaryDivCount: visibleDirectAuxiliaryDivCount(statusSurfaceElement),\n        navigationVisibleAuxiliaryDivCount: visibleDirectAuxiliaryDivCount(navigationSurfaceElement),\n',
    'mobile auxiliary return fields',
)
layout_test = replace_required(
    layout_test,
    '    expect(geometry.navigationVisibleDecorationSpanCount).toBe(1);\n',
    '    expect(geometry.navigationVisibleDecorationSpanCount).toBe(1);\n    expect(geometry.statusVisibleAuxiliaryDivCount).toBe(2);\n    expect(geometry.navigationVisibleAuxiliaryDivCount).toBe(2);\n',
    'mobile over-light visibility assertions',
)
write(layout_test_path, layout_test)

# Design documents: overLight, not a custom tint variable, is authoritative.
liquid_design_path = 'docs/LIQUID_GLASS_CHROME_DESIGN.md'
liquid_design = read(liquid_design_path)
liquid_design = liquid_design.replace('桌面与移动状态栏必须隐藏 `liquid-glass-react` 的直属边框／高光和 over-light 辅助层；认证卡片必须保留官方两个直属边缘高光 `span`，只隐藏 over-light 辅助 `div`，并清除第三方 `.glass` 外部阴影。', '桌面与移动状态栏必须隐藏 `liquid-glass-react` 的直属边框／高光，但所有五种 variant 必须保留并显示 `overLight=true` 产生的两个官方黑色辅助层；认证卡片同时保留官方两个直属边缘高光 `span`，并清除第三方 `.glass` 外部阴影。')
section = '''## 3. 全局液态玻璃参数与平台几何

禁止 `shader` 模式。桌面状态栏、管理员桌面工作栏、移动状态栏、移动底栏、桌面认证卡片和移动认证卡片全局统一传入以下官方参数：

- `mode="standard"`；
- `displacementScale: 120`；
- `blurAmount: 0`；
- `saturation: 120`；
- `aberrationIntensity: 2`；
- `elasticity: 0`；
- `overLight: true`；
- `mouseContainer={null}`；
- 固定 `globalMousePos` 与 `mouseOffset`。

`overLight=true` 就是本项目所称的 “Tint liquid glass dark”，不得再用项目自定义深色背景变量替代。`liquid-glass-react@1.1.1` 的官方实现会在 `overLight=true` 时显示两个直属黑色辅助 `div`，将基础 backdrop blur 设为 `12px`，并把传入的 `displacementScale` 乘以 `0.5` 后交给 SVG 滤镜。因此配置权威仍是 `120 / 0 / 120 / 2`，浏览器计算值必须是 `blur(12px) saturate(120%)`，首个 `feDisplacementMap` 的绝对 scale 必须是 `60`。这些是官方 `overLight` 语义，不得通过把配置改成 `240` 或负 blur 抵消。

所有平台参数必须保持完全一致。四个预设继续保留独立圆角常量：`DESKTOP_STATUS_GLASS` 与 `DESKTOP_AUTH_CARD_GLASS` 使用 `24px`，`MOBILE_CHROME_GLASS` 与 `MOBILE_AUTH_CARD_GLASS` 使用 `40px`。移动状态栏与移动底栏继续共享 `MOBILE_CHROME_GLASS`，桌面与移动认证卡片仍保持独立 variant 和内容高度规则。每个宿主必须暴露 `data-liquid-glass-over-light="true"` 以及配置参数 data attribute，供浏览器区分“传入配置值”和“官方 overLight 处理后的计算值”。

所有四个参数预设都必须固定 `elasticity: 0`，并继续使用静态鼠标输入。桌面状态栏、管理员工作栏、移动状态栏、移动底栏和认证卡片均不得开启鼠标、触控板、触笔或触摸跟踪。

认证卡片继续使用 `layout="content"`。官方两个高光 `span`、两个 over-light 辅助 `div`、认证效果层与 `.glass` 的可见几何都必须直接绑定认证宿主 `100%` 尺寸并取消几何过渡；登录→注册→登录时，它们的底部必须在首个绘制帧内同步。上游 resize 通知只负责随后补齐 SVG 滤镜内部坐标。
'''
liquid_design = regex_required(liquid_design, r'## 3\. 全局液态玻璃参数与平台几何\n.*?(?=\n## 4\. 平台能力边界)', section.rstrip(), 'replace global glass design section')
liquid_design = liquid_design.replace('所有状态栏、管理员工作栏、移动底栏和认证卡片的 `-webkit-backdrop-filter` 必须严格统一为 `blur(0px) saturate(120%)`', '所有状态栏、管理员工作栏、移动底栏和认证卡片的 `-webkit-backdrop-filter` 必须严格匹配官方 `overLight=true` 计算值 `blur(12px) saturate(120%)`')
liquid_design = liquid_design.replace('支持环境中的桌面状态栏、管理员桌面工作栏、移动状态栏、底栏和认证卡片统一使用 dark tint `rgba(3, 12, 8, 0.42)`，并通过 `--liquid-glass-tint-dark` → `--liquid-glass-contrast` 单向引用', '支持环境中的桌面状态栏、管理员桌面工作栏、移动状态栏、底栏和认证卡片统一显示官方 `overLight=true` 的两个黑色辅助层；`--liquid-glass-contrast: rgba(194, 231, 214, 0.06)` 只提供低密度支持染色，不是 dark tint 实现')
liquid_design = liquid_design.replace('所有液态玻璃变体统一使用 `blur(0px) saturate(120%)`、位移尺度 `120`、色差 `2`、弹性 `0` 和 dark tint `rgba(3, 12, 8, 0.42)`。', '所有液态玻璃变体统一传入 `120 / 0 / 120 / 2`、弹性 `0` 与 `overLight=true`；浏览器必须计算为 `blur(12px) saturate(120%)`，首个位移 scale 绝对值为 `60`，两个官方 over-light 辅助层可见。')
write(liquid_design_path, liquid_design)

auth_design_path = 'docs/REGISTRATION_INVITE_FLOW_DESIGN.md'
auth_design = read(auth_design_path)
auth_design = auth_design.replace('认证卡片的光学参数继续使用 `liquid-glass-react@1.1.1` 全局光学基线：`displacementScale=120`、`blurAmount=0`、`saturation=120`、`aberrationIntensity=2`、`mode="standard"`；项目统一把所有玻璃预设的运动参数覆盖为 `elasticity=0`。', '认证卡片继续使用全局官方参数：`displacementScale=120`、`blurAmount=0`、`saturation=120`、`aberrationIntensity=2`、`mode="standard"`、`overLight=true`、`elasticity=0`。`overLight=true` 即 “Tint liquid glass dark”；官方实现会计算出 `blur(12px) saturate(120%)`，并把首个位移 scale 降为 `60`。')
auth_design = auth_design.replace('认证卡片、桌面／移动状态栏、管理员工作栏和移动底栏统一使用 `--liquid-glass-contrast`；dark tint 变量名固定为 `--liquid-glass-tint-dark`，其值固定为 `rgba(3, 12, 8, 0.42)`，并由前者单向引用；', '认证卡片、桌面／移动状态栏、管理员工作栏和移动底栏统一启用官方 `overLight=true`，两个直属黑色辅助层必须可见；`--liquid-glass-contrast: rgba(194, 231, 214, 0.06)` 只作为低密度支持染色，不得再创建 `--liquid-glass-tint-dark`；')
auth_design = auth_design.replace('两个边缘高光 `span` 必须直接使用宿主的 `100%` 宽高、`inset: 0` 与未变换坐标，认证效果层和 `.glass` 的可见几何同样必须直接填满宿主；不得保留第三方尺寸过渡，', '两个边缘高光 `span` 与 `overLight=true` 产生的两个黑色辅助 `div` 必须直接使用宿主的 `100%` 宽高、`inset: 0` 与未变换坐标，认证效果层和 `.glass` 的可见几何同样必须直接填满宿主；不得保留第三方尺寸过渡，')
auth_design = auth_design.replace('全局位移尺度 120、`blur(0px) saturate(120%)`、dark tint', '配置位移尺度 120、官方 over-light 计算值 `blur(12px) saturate(120%)`、首个位移 scale 60 与两个可见黑色辅助层')
write(auth_design_path, auth_design)

# Verifiers: replace custom tint contract with official overLight contract.
for verifier_path in ['scripts/verify-auth-three-layer.mjs', 'scripts/verify-liquid-glass-chrome.mjs', 'scripts/verify-desktop-primary-surfaces.mjs']:
    verifier = read(verifier_path)
    verifier = verifier.replace("'data-liquid-glass-tint=\"dark\"'", "'data-liquid-glass-over-light={GLOBAL_OVER_LIGHT ? \'true\' : \'false\'}'")
    verifier = verifier.replace("\"toHaveAttribute('data-liquid-glass-tint', 'dark')\"", "\"toHaveAttribute('data-liquid-glass-over-light', 'true')\"")
    verifier = verifier.replace("'--liquid-glass-tint-dark: rgba(3, 12, 8, 0.42);',", "'--liquid-glass-contrast: rgba(194, 231, 214, 0.06);',")
    verifier = verifier.replace("'--liquid-glass-contrast: var(--liquid-glass-tint-dark);',\n", '')
    verifier = verifier.replace("'`--liquid-glass-tint-dark`',\n", '')
    verifier = verifier.replace("'-webkit-backdrop-filter: blur(0px) saturate(120%);'", "'-webkit-backdrop-filter: blur(12px) saturate(120%);'")
    verifier = verifier.replace("'`blur(0px) saturate(120%)`'", "'`blur(12px) saturate(120%)`'")
    verifier = verifier.replace("\"expect(layout.surfaceBackgroundColor).toBe('rgba(3, 12, 8, 0.42)')\"", "\"expect(layout.surfaceBackgroundColor).toBe('rgba(194, 231, 214, 0.06)')\"")
    verifier = verifier.replace("\"expect(layout.warpBackdropFilter).toContain('blur(0px)')\"", "\"expect(layout.warpBackdropFilter).toContain('blur(12px)')\"")
    verifier = verifier.replace("'expect(Math.abs(glass.displacementScales[0])).toBe(120)'", "'expect(Math.abs(glass.displacementScales[0])).toBe(60)'")
    verifier = verifier.replace("'toMatch(/saturate\\\\((?:120%|1\\\\.2)\\\\)/)'", "'toMatch(/saturate\\\\((?:120%|1\\\\.2)\\\\)/)'")
    verifier = verifier.replace('dark tint', 'official over-light tint')
    verifier = verifier.replace('全局深色玻璃参数', '全局官方 over-light 玻璃参数')
    if verifier_path.endswith('verify-auth-three-layer.mjs'):
        verifier = verifier.replace(
            "  'mouseOffset={STATIC_MOUSE_OFFSET}',\n",
            "  'mouseOffset={STATIC_MOUSE_OFFSET}',\n  'const GLOBAL_OVER_LIGHT = true;',\n  'overLight={GLOBAL_OVER_LIGHT}',\n  \"data-liquid-glass-over-light={GLOBAL_OVER_LIGHT ? 'true' : 'false'}\",\n  'data-liquid-glass-displacement-scale={preset.displacementScale}',\n  'data-liquid-glass-blur-amount={preset.blurAmount}',\n  'data-liquid-glass-saturation={preset.saturation}',\n  'data-liquid-glass-aberration-intensity={preset.aberrationIntensity}',\n",
        )
        verifier = verifier.replace(
            "  'display: block !important;',\n",
            "  'display: block !important;',\n  '.liquid-glass-surface[data-liquid-glass-over-light=\"true\"] > div:not(.liquid-glass-surface__effect)',\n  'background: #000 !important;',\n  'mix-blend-mode: overlay !important;',\n",
            1,
        )
        verifier = verifier.replace("'`--liquid-glass-tint-dark`',", "'`overLight=true`',")
        verifier = verifier.replace("'expect(glass.visibleDirectDecorationSpanCount).toBe(2)',", "'expect(glass.visibleDirectDecorationSpanCount).toBe(2)',\n  'expect(glass.visibleDirectAuxiliaryDivCount).toBe(2)',")
    elif verifier_path.endswith('verify-liquid-glass-chrome.mjs'):
        verifier = verifier.replace(
            "    'mouseOffset={STATIC_MOUSE_OFFSET}',\n",
            "    'mouseOffset={STATIC_MOUSE_OFFSET}',\n    'const GLOBAL_OVER_LIGHT = true;',\n    'overLight={GLOBAL_OVER_LIGHT}',\n    \"data-liquid-glass-over-light={GLOBAL_OVER_LIGHT ? 'true' : 'false'}\",\n",
        )
        verifier = verifier.replace("    '`--liquid-glass-tint-dark`',\n", "    '`overLight=true`',\n")
    else:
        verifier = verifier.replace(
            "    'data-liquid-glass-tint=\"dark\"',\n",
            "    'const GLOBAL_OVER_LIGHT = true;',\n    'overLight={GLOBAL_OVER_LIGHT}',\n    \"data-liquid-glass-over-light={GLOBAL_OVER_LIGHT ? 'true' : 'false'}\",\n",
        )
    write(verifier_path, verifier)

# Explicitly forbid the superseded custom tint mechanism in architecture checks.
for verifier_path in ['scripts/verify-auth-three-layer.mjs', 'scripts/verify-liquid-glass-chrome.mjs']:
    verifier = read(verifier_path)
    marker = "  'liquid-glass-surface__material-fill',\n" if verifier_path.endswith('verify-auth-three-layer.mjs') else "    'liquid-glass-surface__material-fill',\n"
    addition = marker + ("  '--liquid-glass-tint-dark',\n  'data-liquid-glass-tint',\n" if verifier_path.endswith('verify-auth-three-layer.mjs') else "    '--liquid-glass-tint-dark',\n    'data-liquid-glass-tint',\n")
    verifier = replace_required(verifier, marker, addition, f'{verifier_path} custom tint forbids')
    write(verifier_path, verifier)

# Sanity checks before the workflow runs repository verifiers.
source = read(surface_path)
for required in [
    'const GLOBAL_OVER_LIGHT = true;',
    'overLight={GLOBAL_OVER_LIGHT}',
    "data-liquid-glass-over-light={GLOBAL_OVER_LIGHT ? 'true' : 'false'}",
]:
    if required not in source:
        raise SystemExit(f'missing runtime over-light rule: {required}')
if 'data-liquid-glass-tint="dark"' in source:
    raise SystemExit('custom tint data attribute remains')
styles = read(styles_path)
for required in [
    '--liquid-glass-contrast: rgba(194, 231, 214, 0.06);',
    '-webkit-backdrop-filter: blur(12px) saturate(120%);',
    '.liquid-glass-surface[data-liquid-glass-over-light="true"] > div:not(.liquid-glass-surface__effect)',
    'mix-blend-mode: overlay !important;',
]:
    if required not in styles:
        raise SystemExit(f'missing official over-light CSS rule: {required}')
for forbidden in ['--liquid-glass-tint-dark', 'blur(0px) saturate(120%)']:
    if forbidden in styles:
        raise SystemExit(f'superseded custom tint rule remains: {forbidden}')
