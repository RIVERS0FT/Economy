from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_required(text: str, old: str, new: str, label: str, count: int = 1) -> str:
    actual = text.count(old)
    if actual < count:
        raise SystemExit(f'missing replacement target for {label}: expected at least {count}, found {actual}')
    return text.replace(old, new, count)


# 1. Keep the upstream black compensation colors, but mask both layers to a perimeter ring.
css_path = 'src/styles/liquid-glass-surfaces.css'
css = read(css_path)
old_css = '''.liquid-glass-surface[data-liquid-glass-over-light="true"] > div:not(.liquid-glass-surface__effect) {
  display: block !important;
  visibility: visible !important;
  pointer-events: none !important;
  background: #000 !important;
}'''
new_css = '''.liquid-glass-surface[data-liquid-glass-over-light="true"] > div:not(.liquid-glass-surface__effect) {
  display: block !important;
  visibility: visible !important;
  pointer-events: none !important;
  box-sizing: border-box !important;
  padding: 1.5px !important;
  background: #000 !important;
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
}'''
css = replace_required(css, old_css, new_css, 'global over-light perimeter mask')
write(css_path, css)


# 2. Browser regression: the two visible official layers must be masked rings, not full-card fills.
auth_test_path = 'tests/browser/auth-three-layer.spec.ts'
auth_test = read(auth_test_path)
auth_test = replace_required(
    auth_test,
    '''      directAuxiliaryBottoms: directAuxiliaryRects.map((rect) => rect.bottom),
      directAuxiliaryTransitionProperties: directAuxiliaryStyles.map((style) => style.transitionProperty),''',
    '''      directAuxiliaryBottoms: directAuxiliaryRects.map((rect) => rect.bottom),
      directAuxiliaryTransitionProperties: directAuxiliaryStyles.map((style) => style.transitionProperty),
      directAuxiliaryPaddings: directAuxiliaryStyles.map((style) => style.paddingTop),
      directAuxiliaryMaskImages: directAuxiliaryStyles.map((style) => (
        style.getPropertyValue('-webkit-mask-image') || style.getPropertyValue('mask-image')
      )),
      directAuxiliaryMaskComposites: directAuxiliaryStyles.map((style) => (
        style.getPropertyValue('-webkit-mask-composite') || style.getPropertyValue('mask-composite')
      )),''',
    'auth auxiliary mask readings',
)
auth_test = replace_required(
    auth_test,
    '''      expect(glass.directAuxiliaryDivCount).toBe(2);
      expect(glass.visibleDirectAuxiliaryDivCount).toBe(2);''',
    '''      expect(glass.directAuxiliaryDivCount).toBe(2);
      expect(glass.visibleDirectAuxiliaryDivCount).toBe(2);
      expect(glass.directAuxiliaryPaddings).toEqual(['1.5px', '1.5px']);
      expect(glass.directAuxiliaryMaskImages.every((value) => value !== 'none' && value.length > 0)).toBe(true);
      expect(glass.directAuxiliaryMaskComposites.every((value) => /xor|exclude/.test(value))).toBe(true);''',
    'desktop auth perimeter assertions',
)
auth_test = replace_required(
    auth_test,
    '''      expect(loginGlass.directAuxiliaryDivCount).toBe(2);
      expect(loginGlass.visibleDirectAuxiliaryDivCount).toBe(2);''',
    '''      expect(loginGlass.directAuxiliaryDivCount).toBe(2);
      expect(loginGlass.visibleDirectAuxiliaryDivCount).toBe(2);
      expect(loginGlass.directAuxiliaryPaddings).toEqual(['1.5px', '1.5px']);
      expect(loginGlass.directAuxiliaryMaskImages.every((value) => value !== 'none' && value.length > 0)).toBe(true);
      expect(loginGlass.directAuxiliaryMaskComposites.every((value) => /xor|exclude/.test(value))).toBe(true);''',
    'mobile auth perimeter assertions',
)
write(auth_test_path, auth_test)


layout_test_path = 'tests/browser/liquid-glass-layout.spec.ts'
layout_test = read(layout_test_path)
layout_test = replace_required(
    layout_test,
    '''      const directAuxiliaryDivs = Array.from(surface.children)
        .filter((element) => element.tagName === 'DIV' && !element.classList.contains('liquid-glass-surface__effect')) as HTMLElement[];''',
    '''      const directAuxiliaryDivs = Array.from(surface.children)
        .filter((element) => element.tagName === 'DIV' && !element.classList.contains('liquid-glass-surface__effect')) as HTMLElement[];
      const directAuxiliaryStyles = directAuxiliaryDivs.map((element) => getComputedStyle(element));''',
    'desktop status auxiliary styles',
)
layout_test = replace_required(
    layout_test,
    '''        directAuxiliaryDivCount: directAuxiliaryDivs.length,
        visibleAuxiliaryDivCount: directAuxiliaryDivs.filter(isVisible).length,''',
    '''        directAuxiliaryDivCount: directAuxiliaryDivs.length,
        visibleAuxiliaryDivCount: directAuxiliaryDivs.filter(isVisible).length,
        auxiliaryPaddings: directAuxiliaryStyles.map((style) => style.paddingTop),
        auxiliaryMaskImages: directAuxiliaryStyles.map((style) => (
          style.getPropertyValue('-webkit-mask-image') || style.getPropertyValue('mask-image')
        )),
        auxiliaryMaskComposites: directAuxiliaryStyles.map((style) => (
          style.getPropertyValue('-webkit-mask-composite') || style.getPropertyValue('mask-composite')
        )),''',
    'desktop status auxiliary mask return',
)
layout_test = replace_required(
    layout_test,
    '''    expect(layout.directAuxiliaryDivCount).toBeGreaterThanOrEqual(1);
    expect(layout.visibleAuxiliaryDivCount).toBe(2);''',
    '''    expect(layout.directAuxiliaryDivCount).toBe(2);
    expect(layout.visibleAuxiliaryDivCount).toBe(2);
    expect(layout.auxiliaryPaddings).toEqual(['1.5px', '1.5px']);
    expect(layout.auxiliaryMaskImages.every((value) => value !== 'none' && value.length > 0)).toBe(true);
    expect(layout.auxiliaryMaskComposites.every((value) => /xor|exclude/.test(value))).toBe(true);''',
    'desktop status perimeter assertions',
)
write(layout_test_path, layout_test)


# 3. Durable design rules.
liquid_design_path = 'docs/LIQUID_GLASS_CHROME_DESIGN.md'
liquid_design = read(liquid_design_path)
liquid_design = replace_required(
    liquid_design,
    '- 桌面与移动状态栏必须隐藏 `liquid-glass-react` 的直属边框／高光，但所有五种 variant 必须保留并显示 `overLight=true` 产生的两个官方黑色辅助层；认证卡片必须保留官方两个直属边缘高光 `span`，并清除第三方 `.glass` 外部阴影。',
    '- 桌面与移动状态栏必须隐藏 `liquid-glass-react` 的直属边框／高光，但所有五种 variant 必须保留并显示 `overLight=true` 产生的两个官方黑色辅助层。两个辅助层是周围亮度补偿，不是玻璃背景：项目只允许用 `1.5px` 排除式 mask 将其限制为周边补偿环，禁止以未遮罩的整面黑色覆盖卡片中心；认证卡片必须保留官方两个直属边缘高光 `span`，并清除第三方 `.glass` 外部阴影。',
    'liquid design material rule',
)
liquid_design = replace_required(
    liquid_design,
    '`overLight=true` 就是本项目所称的 “Tint liquid glass dark”，不得再用项目自定义深色背景变量替代。`liquid-glass-react@1.1.1` 的官方实现会在 `overLight=true` 时显示两个直属黑色辅助 `div`，将基础 backdrop blur 设为 `12px`，并把传入的 `displacementScale` 乘以 `0.5` 后交给 SVG 滤镜。因此配置权威仍是 `120 / 0 / 120 / 2`，浏览器计算值必须是 `blur(12px) saturate(120%)`，首个 `feDisplacementMap` 的绝对 scale 必须是 `60`。这些是官方 `overLight` 语义，不得通过把配置改成 `240` 或负 blur 抵消。',
    '`overLight=true` 就是本项目所称的 “Tint liquid glass dark”，不得再用项目自定义深色背景变量替代。`liquid-glass-react@1.1.1` 的官方实现会在玻璃容器之前输出两个直属黑色辅助 `div`，用于周围明亮环境补偿；它们不得成为玻璃中心背景。项目必须保留官方黑色、`opacity` 与 `mix-blend-mode` 语义，但必须使用 `padding: 1.5px`、双层线性渐变 mask 与 `xor`／`exclude` 复合，仅留下周边补偿环。官方同时将基础 backdrop blur 设为 `12px`，并把传入的 `displacementScale` 乘以 `0.5` 后交给 SVG 滤镜。因此配置权威仍是 `120 / 0 / 120 / 2`，浏览器计算值必须是 `blur(12px) saturate(120%)`，首个 `feDisplacementMap` 的绝对 scale 必须是 `60`。',
    'liquid over-light semantics',
)
liquid_design = replace_required(
    liquid_design,
    '可见高光几何直接绑定认证宿主：官方两个高光 `span`、两个 over-light 辅助 `div`、认证效果层与 `.glass` 都必须使用认证宿主 `100%` 尺寸并取消几何过渡；登录→注册→登录时，它们的底部必须在首个绘制帧内同步。',
    '可见高光几何直接绑定认证宿主：官方两个高光 `span`、两个 over-light 辅助 `div`、认证效果层与 `.glass` 都必须使用认证宿主 `100%` 尺寸并取消几何过渡；两个 over-light 辅助层虽然尺寸与宿主同步，但中心必须被排除式 mask 完全挖空，只保留 `1.5px` 周边补偿环。登录→注册→登录时，它们的底部必须在首个绘制帧内同步。',
    'liquid auth geometry rule',
)
write(liquid_design_path, liquid_design)


auth_design_path = 'docs/REGISTRATION_INVITE_FLOW_DESIGN.md'
auth_design = read(auth_design_path)
auth_design = replace_required(
    auth_design,
    '认证卡片、桌面／移动状态栏、管理员工作栏和移动底栏统一启用官方 `overLight=true`，两个直属黑色辅助层必须可见；所有表面继续统一使用 `--liquid-glass-contrast`，其值固定为 `rgba(194, 231, 214, 0.06)`，该变量只作为低密度支持染色，不得再创建 `--liquid-glass-tint-dark`；',
    '认证卡片、桌面／移动状态栏、管理员工作栏和移动底栏统一启用官方 `overLight=true`，两个直属黑色辅助层必须可见，但只允许作为 `1.5px` 周边补偿环：必须使用排除式 mask 挖空中心，禁止以整面黑色覆盖认证卡片背景；所有表面继续统一使用 `--liquid-glass-contrast`，其值固定为 `rgba(194, 231, 214, 0.06)`，该变量只作为低密度支持染色，不得再创建 `--liquid-glass-tint-dark`；',
    'auth over-light support rule',
)
auth_design = replace_required(
    auth_design,
    '两个边缘高光 `span` 必须直接使用宿主的 `100%` 宽高、`inset: 0` 与未变换坐标；`overLight=true` 产生的两个黑色辅助 `div` 也必须采用同一宿主几何，认证效果层和 `.glass` 的可见几何同样必须直接填满宿主；不得保留第三方尺寸过渡，',
    '两个边缘高光 `span` 必须直接使用宿主的 `100%` 宽高、`inset: 0` 与未变换坐标；`overLight=true` 产生的两个黑色辅助 `div` 也必须采用同一宿主几何，但必须通过 `padding: 1.5px` 与 `xor`／`exclude` 排除式 mask 挖空中心，只保留周边补偿环。认证效果层和 `.glass` 的可见几何同样必须直接填满宿主；不得保留第三方尺寸过渡，',
    'auth over-light geometry rule',
)
write(auth_design_path, auth_design)


# 4. Architecture contracts.
auth_verify_path = 'scripts/verify-auth-three-layer.mjs'
auth_verify = read(auth_verify_path)
auth_verify = replace_required(
    auth_verify,
    "  'background: #000 !important;',\n  'mix-blend-mode: overlay !important;',",
    "  'background: #000 !important;',\n  'padding: 1.5px !important;',\n  '-webkit-mask-composite: xor;',\n  'mask-composite: exclude;',\n  'mix-blend-mode: overlay !important;',",
    'auth CSS mask contract',
)
auth_verify = replace_required(
    auth_verify,
    "  'expect(glass.visibleDirectAuxiliaryDivCount).toBe(2)',",
    "  'expect(glass.visibleDirectAuxiliaryDivCount).toBe(2)',\n  \"expect(glass.directAuxiliaryPaddings).toEqual(['1.5px', '1.5px'])\",\n  'directAuxiliaryMaskImages.every',\n  'directAuxiliaryMaskComposites.every',",
    'auth browser mask contract',
)
auth_verify = replace_required(
    auth_verify,
    "  '可见高光几何直接绑定认证宿主',",
    "  '可见高光几何直接绑定认证宿主',\n  '中心必须被排除式 mask 完全挖空',",
    'auth liquid design mask contract',
)
write(auth_verify_path, auth_verify)


liquid_verify_path = 'scripts/verify-liquid-glass-chrome.mjs'
liquid_verify = read(liquid_verify_path)
liquid_verify = replace_required(
    liquid_verify,
    "    'visibility: visible !important;',\n    '.login-card > .liquid-glass-surface--desktopAuthCard[data-liquid-glass-over-light=\"true\"] > div:not(.liquid-glass-surface__effect),',",
    "    'visibility: visible !important;',\n    'padding: 1.5px !important;',\n    '-webkit-mask-composite: xor;',\n    'mask-composite: exclude;',\n    '.login-card > .liquid-glass-surface--desktopAuthCard[data-liquid-glass-over-light=\"true\"] > div:not(.liquid-glass-surface__effect),',",
    'liquid CSS perimeter contract',
)
liquid_verify = replace_required(
    liquid_verify,
    "    '所有平台光学参数必须保持完全一致',",
    "    '所有平台光学参数必须保持完全一致',\n    '禁止以未遮罩的整面黑色覆盖卡片中心',\n    '中心必须被排除式 mask 完全挖空',",
    'liquid design perimeter contract',
)
liquid_verify = replace_required(
    liquid_verify,
    "    'expect(glass.visibleDirectDecorationSpanCount).toBe(2)',",
    "    'expect(glass.visibleDirectDecorationSpanCount).toBe(2)',\n    'directAuxiliaryMaskImages.every',\n    'directAuxiliaryMaskComposites.every',",
    'liquid browser perimeter contract',
)
write(liquid_verify_path, liquid_verify)


desktop_verify_path = 'scripts/verify-desktop-primary-surfaces.mjs'
desktop_verify = read(desktop_verify_path)
desktop_verify = replace_required(
    desktop_verify,
    "    'display: none !important;',\n    '.asset-bar > .liquid-glass-surface--desktopStatusBar .liquid-glass-surface__effect > .glass,',",
    "    'display: none !important;',\n    'padding: 1.5px !important;',\n    '-webkit-mask-composite: xor;',\n    'mask-composite: exclude;',\n    '.asset-bar > .liquid-glass-surface--desktopStatusBar .liquid-glass-surface__effect > .glass,',",
    'desktop CSS perimeter contract',
)
desktop_verify = replace_required(
    desktop_verify,
    "    '认证卡片必须保留官方两个直属边缘高光 `span`',",
    "    '认证卡片必须保留官方两个直属边缘高光 `span`',\n    '禁止以未遮罩的整面黑色覆盖卡片中心',",
    'desktop design perimeter contract',
)
write(desktop_verify_path, desktop_verify)


# Final sanity checks.
for path in [css_path, auth_test_path, layout_test_path, liquid_design_path, auth_design_path,
             auth_verify_path, liquid_verify_path, desktop_verify_path]:
    if not Path(path).exists():
        raise SystemExit(f'missing updated file: {path}')

css = read(css_path)
for required in ['padding: 1.5px !important;', '-webkit-mask-composite: xor;', 'mask-composite: exclude;']:
    if required not in css:
        raise SystemExit(f'missing perimeter CSS: {required}')
