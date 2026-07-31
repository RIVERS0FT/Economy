from __future__ import annotations

import re
from pathlib import Path

ROOT = Path.cwd()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content if content.endswith('\n') else content + '\n', encoding='utf-8')


def replace_exact(path: str, old: str, new: str, *, all_occurrences: bool = False, required: bool = True) -> None:
    source = read(path)
    if old not in source:
        if required:
            raise RuntimeError(f'{path}: missing exact source fragment:\n{old[:300]}')
        return
    source = source.replace(old, new) if all_occurrences else source.replace(old, new, 1)
    write(path, source)


def replace_regex(path: str, pattern: str, replacement: str) -> None:
    source = read(path)
    next_source, matched = re.subn(pattern, replacement, source, count=1, flags=re.S)
    if matched != 1:
        raise RuntimeError(f'{path}: regex matched {matched}, expected 1: {pattern[:240]}')
    write(path, next_source)


def require_absent(path: str, fragments: list[str]) -> None:
    source = read(path)
    for fragment in fragments:
        if fragment in source:
            raise RuntimeError(f'{path}: obsolete rule remains: {fragment}')


def require_present(path: str, fragments: list[str]) -> None:
    source = read(path)
    for fragment in fragments:
        if fragment not in source:
            raise RuntimeError(f'{path}: expected rule missing: {fragment}')


replace_exact('src/components/ui/LiquidGlassSurface.tsx', 'const GLOBAL_OVER_LIGHT = true;', 'const GLOBAL_OVER_LIGHT = false;')
replace_exact('src/styles/mobile-status-layout.css', '    border-radius: 999px;', '    border-radius: var(--radius-card-mobile);')
write('src/styles/liquid-glass-surfaces.css', read('.agent/new-liquid-glass-surfaces.css'))
write('scripts/verify-desktop-primary-surfaces.mjs', read('.agent/new-verify-desktop-primary-surfaces.mjs'))

replace_exact('docs/LIQUID_GLASS_CHROME_DESIGN.md', '> 更新时间：2026-07-29', '> 更新时间：2026-07-31')
for old, new in [
    ('- 桌面状态栏与管理员桌面玻璃工作栏必须使用独立的 `DESKTOP_STATUS_GLASS`；移动状态栏与移动底栏共同使用 `MOBILE_CHROME_GLASS`；桌面和移动认证卡片分别使用 `DESKTOP_AUTH_CARD_GLASS` 与 `MOBILE_AUTH_CARD_GLASS`。四个预设继续保留独立圆角常量；认证卡片通过 `AuthCardSurface` 使用独立的受控对照参数。', '- 桌面状态栏与管理员桌面玻璃工作栏继续使用 `DESKTOP_STATUS_GLASS`，移动状态栏与移动底栏继续使用 `MOBILE_CHROME_GLASS`，桌面和移动认证卡片继续使用 `DESKTOP_AUTH_CARD_GLASS` 与 `MOBILE_AUTH_CARD_GLASS`。四个预设只保留平台与用途命名，光学参数、透明宿主、官方双层高光、默认阴影和 `overLight=false` 材质必须完全一致；桌面圆角统一为 `24px`，移动圆角统一为 `40px`。'),
    ('- 支持背景滤镜时，桌面／移动状态栏和移动底栏继续把低密度透明染色放在 `.liquid-glass-surface` 宿主并统一使用 `--liquid-glass-contrast`；认证卡片宿主必须保持透明，由 `overLight=false` 的折射、高光与 `.glass` 默认阴影表达材质。不得创建 `.liquid-glass-surface__material-fill` 或认证专用支持环境染色变量。', '- 支持背景滤镜时，桌面／移动状态栏、管理员工作栏、移动底栏和认证卡片的 `.liquid-glass-surface` 宿主都必须保持透明，统一由 `overLight=false` 的折射、两个官方直属边缘高光和 `.glass` 默认阴影表达材质。不得创建低密度宿主染色、`.liquid-glass-surface__material-fill` 或用途专用支持环境染色变量。'),
    ('- `src/styles/liquid-glass-surfaces.css` 只负责尺寸、层级、内容布局、圆角裁切、状态栏与导航低密度透明染色、认证透明宿主与回退底色、状态栏单层结构描边、认证卡片无项目结构描边、第三方装饰层显隐和与各预设完全一致的 WebKit 属性别名；不得用 CSS 创建第二套模糊、折射或色差材质。', '- `src/styles/liquid-glass-surfaces.css` 只负责尺寸、层级、内容布局、圆角裁切、全部表面的透明宿主与统一回退底色、官方双层高光几何、透明辅助层、无项目结构描边和与各预设完全一致的 WebKit 属性别名；不得用 CSS 创建第二套模糊、折射、色差、染色或外框材质。'),
    ('- 桌面与移动状态栏继续使用 `overLight=true` 并隐藏 `liquid-glass-react` 的直属边框／高光；状态栏与导航允许用 `1.5px` 排除式 mask 将两个黑色辅助层限制为周边补偿环。认证卡片使用 `overLight=false`，两个辅助节点保留几何但不得产生可见黑色绘制，两个直属边缘高光 `span` 和第三方 `.glass` 默认外部阴影继续保留。状态栏只保留宿主的一条最上层连续结构描边；认证卡片不得绘制项目宿主阴影、结构描边或额外 `::after` 白色外框。移动底栏允许保留第一层低强度 screen 高光。', '- 桌面状态栏、管理员工作栏、移动状态栏、移动底栏和认证卡片统一使用 `overLight=false`。两个辅助节点必须保留完整宿主几何但保持透明，两个直属边缘高光 `span` 必须全部可见并保持静态方向，第三方 `.glass` 默认外部阴影必须保留。所有表面都不得绘制项目宿主阴影、结构描边、额外 `::after` 白色外框、排除式 mask 或用途专用高光强度。'),
    ('| `liquid-glass-surfaces.css` | 所有玻璃宿主、第三方 DOM 尺寸、内容自适应层、开放背景采样链、平台圆角、统一宿主染色、认证回退、状态栏单层结构描边、认证官方双层高光显隐、认证高光宿主几何绑定、零尺寸过渡、认证卡片无项目结构描边和移动底栏唯一垂直留白 |', '| `liquid-glass-surfaces.css` | 所有玻璃宿主、第三方 DOM 尺寸、内容自适应层、开放背景采样链、平台圆角、统一透明宿主与回退、全部表面的官方双层高光及宿主几何绑定、透明辅助层、零尺寸过渡、无项目结构描边和移动底栏唯一垂直留白 |'),
    ('| `verify-desktop-primary-surfaces.mjs` | 桌面一级卡片与独立桌面状态栏圆角、单结构边框和零第三方装饰层检查 |', '| `verify-desktop-primary-surfaces.mjs` | 桌面一级卡片、玩家状态栏与管理员工作栏的 24px 圆角、透明宿主、官方双层高光、默认阴影和无项目结构描边检查 |'),
    ('- 支持环境中的桌面状态栏、管理员桌面工作栏、移动状态栏和底栏显示 `overLight=true` 的两个黑色辅助层；认证卡片使用 `overLight=false`，辅助节点不得产生可见黑色绘制。`--liquid-glass-contrast: rgba(194, 231, 214, 0.06)` 只为状态栏与导航提供低密度支持染色。认证宿主保持透明，第三方 `.glass__warp` 继续采样页面内容和根级氛围背景；认证输入框自身继续保持不透明深色控件以保护表单可读性。', '- 支持环境中的桌面状态栏、管理员桌面工作栏、移动状态栏、移动底栏和认证卡片全部使用 `overLight=false`；两个辅助节点保持完整几何但不得产生可见黑色绘制。所有宿主保持透明，第三方 `.glass__warp` 继续采样页面内容和根级氛围背景；认证输入框自身继续保持不透明深色控件以保护表单可读性。'),
    ('- 状态栏只保留一条低强度 `1px` 最上层连续结构描边；认证卡片不得绘制项目结构描边，`.liquid-glass-surface--desktopAuthCard::after` 与 `.liquid-glass-surface--mobileAuthCard::after` 必须使用 `content: none`；移动底栏继续使用宿主边框。', '- 所有五种表面都不得绘制项目结构描边或宿主边框；`desktopStatusBar`、`mobileStatusBar`、`mobileNavigation`、`desktopAuthCard` 与 `mobileAuthCard` 的 `::after` 必须统一使用 `content: none`。'),
    ('- 认证卡片的两个直属边缘高光 `span` 必须可见、直接绑定认证宿主 `100%` 几何并取消第三方尺寸过渡；两个 `overLight=false` 辅助 `div` 必须保持完整宿主几何但不可见。认证宿主的背景与 `box-shadow` 必须为透明／`none`；第三方 `.glass` 必须保留官方默认阴影，不得由项目 CSS 覆盖。', '- 所有表面的两个直属边缘高光 `span` 必须可见、直接绑定所属宿主 `100%` 几何并取消第三方尺寸过渡；两个 `overLight=false` 辅助 `div` 必须保持完整宿主几何但不可见。宿主背景与 `box-shadow` 必须为透明／`none`；第三方 `.glass` 必须保留官方默认阴影，不得由项目 CSS 覆盖。'),
    ('- 移动底栏的两个直属 `span` 中只允许第一层 `opacity: 0.22` 的 screen 高光可见。', '- 移动底栏不得再使用单层低强度高光例外；两个直属 `span` 必须与认证卡片和状态栏一样全部可见。'),
    ('- 顶部状态栏的结构描边必须位于玻璃效果和状态内容之上，使用 `z-index: 2`、`pointer-events: none` 的 `::after` 内描边；\n- 页面滚动到卡片后方时，状态栏圆角描边必须保持连续。', '- 顶部状态栏不得创建 `::after` 结构描边；圆角边缘只由官方双层高光与 `.glass` 默认阴影表达。\n- 页面滚动到卡片后方时，状态栏官方高光和阴影必须保持连续且不得闪烁。'),
    ('9. 状态栏与导航传入 `70 / 0 / 140 / 2`、弹性 `0` 与 `overLight=true`，浏览器计算为 `blur(12px) saturate(140%)`、首个位移 scale 为 `35`；认证卡片采用 `70 / 0 / 140 / 2 / 0 / overLight=false`，浏览器计算为 `blur(4px) saturate(140%)`、首个位移 scale 为 `70`，辅助黑色层不可见。', '9. 状态栏、管理员工作栏、移动底栏和认证卡片统一传入 `70 / 0 / 140 / 2`、弹性 `0` 与 `overLight=false`，浏览器统一计算为 `blur(4px) saturate(140%)`、首个位移 scale 为 `70`；两个辅助黑色层不可见，两个官方直属高光可见，第三方 `.glass` 默认阴影存在。'),
    ('桌面、移动和认证预设的 WebKit 兼容别名必须分别匹配上游参数，不得使用一个通用数值覆盖不同平台。', '桌面、移动和认证预设的 WebKit 兼容别名必须统一匹配共享上游参数；只有圆角和固定／内容高度模型允许因平台与用途不同。'),
]:
    replace_exact('docs/LIQUID_GLASS_CHROME_DESIGN.md', old, new)
replace_exact('docs/LIQUID_GLASS_CHROME_DESIGN.md', '`blur(12px) saturate(140%)`', '`blur(4px) saturate(140%)`', all_occurrences=True, required=False)
replace_exact('docs/LIQUID_GLASS_CHROME_DESIGN.md', '`overLight=true`', '`overLight=false`', all_occurrences=True, required=False)
replace_exact('docs/LIQUID_GLASS_CHROME_DESIGN.md', '所有四个参数预设都必须固定 `elasticity: 0`', '所有四个用途预设都必须固定 `elasticity: 0`', required=False)

replace_exact('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', '> 更新时间：2026-07-29', '> 更新时间：2026-07-31')
for old, new in [
    ('认证卡片采用与受控对照页一致的认证专用对照参数：`displacementScale=70`、`blurAmount=0`、`saturation=140`、`aberrationIntensity=2`、`mode="standard"`、`overLight=false`、`elasticity=0`。官方实现计算为 `blur(4px) saturate(140%)`，首个位移 scale 保持 `70`，`.glass` 使用 `0 12px 40px rgba(0, 0, 0, 0.25)` 默认阴影。第三方默认 `cornerRadius=999` 和默认内边距不适用于大表单，必须继续由项目几何规则覆盖：桌面／移动分别保持 `24px`／`40px` 圆角，真实内容保持 `32px`／`20px` 留白，第三方 `padding` 固定为 `0`。状态栏和移动底栏继续使用 `70 / 0 / 140 / 2 / overLight=true` Chrome 参数，不得因认证卡片同步而改变。', '认证卡片、玩家状态栏、管理员工作栏和移动底栏统一采用受控对照参数：`displacementScale=70`、`blurAmount=0`、`saturation=140`、`aberrationIntensity=2`、`mode="standard"`、`overLight=false`、`elasticity=0`。官方实现统一计算为 `blur(4px) saturate(140%)`，首个位移 scale 保持 `70`，`.glass` 使用 `0 12px 40px rgba(0, 0, 0, 0.25)` 默认阴影。第三方默认 `cornerRadius=999` 和默认内边距不适用于项目外壳，必须继续由项目几何规则覆盖：桌面统一保持 `24px`，移动统一保持 `40px`；认证真实内容保持 `32px`／`20px` 留白，第三方 `padding` 固定为 `0`。'),
    ('认证卡片的外层宽度、桌面／移动对齐、圆角和内容留白继续由 `src/styles/auth.css` 负责；液态玻璃参数、回退底色、状态栏单层结构描边、认证卡片无项目结构描边、上游装饰显隐和阴影只归 `src/styles/liquid-glass-surfaces.css`。认证卡片使用 `overLight=false`，状态栏、管理员工作栏和移动底栏继续使用 `overLight=true`。支持 `backdrop-filter` 时认证宿主背景必须透明，且不得绘制项目宿主阴影，悬浮阴影完全使用第三方 `.glass` 在 `overLight=false` 下生成的官方默认值；`--liquid-glass-contrast: rgba(194, 231, 214, 0.06)` 只供状态栏与导航的低密度支持染色使用。不得再创建 `--liquid-glass-tint-dark`、`.liquid-glass-surface__material-fill` 或认证专用支持环境染色变量。不支持 `backdrop-filter` 时认证宿主改用 `--liquid-glass-auth-fallback`。不得在 `auth.css` 手写另一套 `backdrop-filter`、玻璃渐变、材质描边或 `.login-card.panel` 映射。输入框继续使用不透明深色控件与自动填充覆盖，确保密码、验证码、错误和提示文字保持稳定对比度。', '认证卡片的外层宽度、桌面／移动对齐、圆角和内容留白继续由 `src/styles/auth.css` 负责；全部液态玻璃参数、共享回退底色、无项目结构描边、官方双层高光、透明辅助层和第三方默认阴影只归 `src/styles/liquid-glass-surfaces.css`。认证卡片、玩家状态栏、管理员工作栏和移动底栏统一使用 `overLight=false`。支持 `backdrop-filter` 时所有宿主背景必须透明且不得绘制项目宿主阴影，悬浮阴影完全使用第三方 `.glass` 的官方默认值；不得创建低密度状态栏染色、`--liquid-glass-tint-dark`、`.liquid-glass-surface__material-fill` 或用途专用支持环境染色变量。不支持 `backdrop-filter` 时五种表面统一使用 `--liquid-glass-auth-fallback`。不得在 `auth.css` 手写另一套 `backdrop-filter`、玻璃渐变、材质描边或 `.login-card.panel` 映射。输入框继续使用不透明深色控件与自动填充覆盖，确保密码、验证码、错误和提示文字保持稳定对比度。'),
    ('认证卡片不得绘制项目 `::after` 结构描边或额外大圆角白色外框；`liquid-glass-react` Fragment 直属输出的两个边缘高光 `span` 必须可见，并保持固定静态方向，成为认证卡片唯一亮边来源。两个边缘高光 `span` 必须直接使用宿主的 `100%` 宽高、`inset: 0` 与未变换坐标；`overLight=false` 对应的两个辅助 `div` 也必须采用同一宿主几何，但不得产生可见黑色绘制，其 `padding` 必须为 `0` 且 `mask-image` 必须为 `none`。认证宿主背景与宿主阴影必须透明／关闭，第三方 `.glass` 的官方 `0 12px 40px rgba(0, 0, 0, 0.25)` 阴影不得被项目 CSS 覆盖。', '认证卡片、玩家状态栏、管理员工作栏和移动底栏都不得绘制项目 `::after` 结构描边、宿主边框或额外大圆角白色外框；`liquid-glass-react` Fragment 直属输出的两个边缘高光 `span` 必须全部可见，并保持固定静态方向，成为所有玻璃表面的唯一亮边来源。两个边缘高光 `span` 必须直接使用所属宿主的 `100%` 宽高、`inset: 0` 与未变换坐标；`overLight=false` 对应的两个辅助 `div` 也必须采用同一宿主几何，但不得产生可见黑色绘制，其 `padding` 必须为 `0` 且 `mask-image` 必须为 `none`。所有宿主背景与宿主阴影必须透明／关闭，第三方 `.glass` 的官方 `0 12px 40px rgba(0, 0, 0, 0.25)` 阴影不得被项目 CSS 覆盖。'),
]:
    replace_exact('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', old, new)
replace_exact('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', '认证专用对照参数', '统一悬浮玻璃对照参数', all_occurrences=True, required=False)
replace_exact('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', '状态栏单描边', '全部表面无项目结构描边', all_occurrences=True, required=False)
replace_exact('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', '状态栏单层结构描边', '全部表面无项目结构描边', all_occurrences=True, required=False)

BROWSER = 'tests/browser/liquid-glass-layout.spec.ts'
replace_exact(BROWSER, 'desktop status bar uses its dedicated single-shell glass preset and shell inset', 'desktop status bar uses the shared authentication-card material and shell inset')
replace_exact(BROWSER, 'mobile status and navigation share the mobile chrome preset while status remains single-shell', 'mobile status and navigation share the authentication-card material while status remains single-shell')
replace_exact(BROWSER, "toHaveAttribute('data-liquid-glass-over-light', 'true')", "toHaveAttribute('data-liquid-glass-over-light', 'false')", all_occurrences=True)
replace_exact(BROWSER, '        outlinePointerEvents: outlineStyle.pointerEvents,', '        outlinePointerEvents: outlineStyle.pointerEvents,\n        outlineContent: outlineStyle.content,')
replace_exact(BROWSER, "    expect(layout.outlineBorderWidth).toBe('1px');\n    expect(layout.outlineBorderStyle).toBe('solid');\n    expect(layout.outlineZIndex).toBe('2');\n    expect(layout.outlinePointerEvents).toBe('none');", "    expect(layout.outlineContent).toBe('none');")
replace_exact(BROWSER, "    expect(layout.surfaceBackgroundColor).toBe('rgba(194, 231, 214, 0.06)');", "    expect(layout.surfaceBackgroundColor).toBe('rgba(0, 0, 0, 0)');")
replace_exact(BROWSER, "    expect(layout.glassBoxShadow).toBe('none');", "    expect(layout.glassBoxShadow).toContain('0px 12px 40px');\n    expect(layout.glassBoxShadow).toContain('rgba(0, 0, 0, 0.25)');")
replace_exact(BROWSER, "    expect(layout.warpBackdropFilter).toContain('blur(12px)');", "    expect(layout.warpBackdropFilter).toContain('blur(4px)');")
replace_exact(BROWSER, '    expect(layout.visibleDecorationSpanCount).toBe(0);', '    expect(layout.visibleDecorationSpanCount).toBe(2);')
replace_exact(BROWSER, "    expect(layout.auxiliaryPaddings).toEqual(['1.5px', '1.5px']);", "    expect(layout.auxiliaryPaddings).toEqual(['0px', '0px']);")
replace_exact(BROWSER, "    expect(layout.auxiliaryMaskImages.every((value) => value !== 'none' && value.length > 0)).toBe(true);", "    expect(layout.auxiliaryMaskImages).toEqual(['none', 'none']);")
replace_exact(BROWSER, "    expect(layout.auxiliaryMaskComposites.every((value) => /xor|exclude/.test(value))).toBe(true);", "    expect(layout.auxiliaryMaskComposites.every((value) => !/xor|exclude/.test(value))).toBe(true);")
replace_exact(BROWSER, "      const statusGlassElement = document.querySelector<HTMLElement>(\n        '.asset-bar .liquid-glass-surface__effect > .glass',\n      );", "      const statusGlassElement = document.querySelector<HTMLElement>(\n        '.asset-bar .liquid-glass-surface__effect > .glass',\n      );\n      const navigationGlassElement = document.querySelector<HTMLElement>(\n        '.mobile-bottom-navigation .liquid-glass-surface__effect > .glass',\n      );")
replace_exact(BROWSER, '        || !statusGlassElement || !primaryPanelElement) {', '        || !statusGlassElement || !navigationGlassElement || !primaryPanelElement) {')
replace_exact(BROWSER, '        statusGlassBoxShadow: getComputedStyle(statusGlassElement).boxShadow,', '        statusGlassBoxShadow: getComputedStyle(statusGlassElement).boxShadow,\n        navigationGlassBoxShadow: getComputedStyle(navigationGlassElement).boxShadow,')
replace_exact(BROWSER, '        statusOutlinePointerEvents: statusOutlineStyle.pointerEvents,', '        statusOutlinePointerEvents: statusOutlineStyle.pointerEvents,\n        statusOutlineContent: statusOutlineStyle.content,')
replace_exact(BROWSER, "    expect(geometry.statusBackground).toBe('rgba(194, 231, 214, 0.06)');", "    expect(geometry.statusBackground).toBe('rgba(0, 0, 0, 0)');")
replace_exact(BROWSER, "    expect(geometry.statusBackdropFilter).toContain('blur(12px)');", "    expect(geometry.statusBackdropFilter).toContain('blur(4px)');")
replace_exact(BROWSER, '    expect(geometry.statusVisibleDecorationSpanCount).toBe(0);', '    expect(geometry.statusVisibleDecorationSpanCount).toBe(2);')
replace_exact(BROWSER, '    expect(geometry.navigationVisibleDecorationSpanCount).toBe(1);', '    expect(geometry.navigationVisibleDecorationSpanCount).toBe(2);')
replace_exact(BROWSER, "    expect(geometry.statusGlassBoxShadow).toBe('none');", "    expect(geometry.statusGlassBoxShadow).toContain('0px 12px 40px');\n    expect(geometry.statusGlassBoxShadow).toContain('rgba(0, 0, 0, 0.25)');\n    expect(geometry.navigationGlassBoxShadow).toContain('0px 12px 40px');\n    expect(geometry.navigationGlassBoxShadow).toContain('rgba(0, 0, 0, 0.25)');")
replace_exact(BROWSER, "    expect(geometry.statusOutlineBorderWidth).toBe('1px');\n    expect(geometry.statusOutlineZIndex).toBe('2');\n    expect(geometry.statusOutlinePointerEvents).toBe('none');", "    expect(geometry.statusOutlineContent).toBe('none');")

replace_exact('scripts/verify-auth-three-layer.mjs', 'const GLOBAL_OVER_LIGHT = true;', 'const GLOBAL_OVER_LIGHT = false;')
replace_regex('scripts/verify-auth-three-layer.mjs', r"for \(const text of \[\n  '--liquid-glass-contrast:[\s\S]*?\n\]\) requireText\('src/styles/liquid-glass-surfaces\.css', text\);", """for (const text of [
  '--liquid-glass-auth-fallback:',
  '.liquid-glass-surface[data-liquid-glass-layout="content"]',
  '.liquid-glass-surface[data-liquid-glass-layout="content"] .liquid-glass-surface__content {',
  'height: auto !important;',
  '.liquid-glass-surface__effect[data-liquid-glass-measuring="true"] {',
  'transform: translate(-50%, -50%) scale(1) !important;',
  'transition: none !important;',
  '.liquid-glass-surface--desktopStatusBar .glass__warp,',
  '.liquid-glass-surface--desktopAuthCard .glass__warp,',
  '-webkit-backdrop-filter: blur(4px) saturate(140%);',
  '.liquid-glass-surface--desktopStatusBar,',
  '.liquid-glass-surface--mobileNavigation,',
  '.liquid-glass-surface--desktopAuthCard,',
  'background: transparent;',
  'box-shadow: none;',
  '.liquid-glass-surface--desktopStatusBar::after,',
  '.liquid-glass-surface--mobileNavigation::after,',
  '.liquid-glass-surface--desktopAuthCard::after,',
  'content: none;',
  '.liquid-glass-surface--desktopStatusBar > span,',
  '.liquid-glass-surface--mobileNavigation > span,',
  '.liquid-glass-surface--desktopAuthCard > span,',
  'display: block !important;',
  'visibility: visible !important;',
  'position: absolute !important;',
  'inset: 0 !important;',
  'width: 100% !important;',
  'height: 100% !important;',
  'box-sizing: border-box !important;',
  'padding: 0 !important;',
  'background: transparent !important;',
  'transform: none !important;',
  '-webkit-mask: none !important;',
  'mask: none !important;',
  '-webkit-mask-composite: source-over !important;',
  'mask-composite: add !important;',
  'background: var(--liquid-glass-auth-fallback);',
]) requireText('src/styles/liquid-glass-surfaces.css', text);""")
replace_regex('scripts/verify-auth-three-layer.mjs', r"for \(const text of \[\n  '--liquid-glass-auth-contrast:'[\s\S]*?\n\]\) forbidText\('src/styles/liquid-glass-surfaces\.css', text\);", """for (const text of [
  '--liquid-glass-auth-contrast:',
  '--liquid-glass-auth-mobile-contrast:',
  '--liquid-glass-contrast:',
  '--liquid-glass-structure-border:',
  'liquid-glass-surface__material-fill',
  'padding: 1.5px !important;',
  'mask-composite: exclude;',
  '.liquid-glass-surface--mobileNavigation > span:first-of-type',
]) forbidText('src/styles/liquid-glass-surfaces.css', text);""")
replace_exact('scripts/verify-auth-three-layer.mjs', '认证专用对照参数', '统一悬浮玻璃对照参数', all_occurrences=True, required=False)

replace_exact('scripts/verify-liquid-glass-chrome.mjs', 'const GLOBAL_OVER_LIGHT = true;', 'const GLOBAL_OVER_LIGHT = false;')
replace_regex('scripts/verify-liquid-glass-chrome.mjs', r"  for \(const text of \[\n    '--liquid-glass-contrast:[\s\S]*?\n  \]\) requireText\(files\.styles, text\);", """  for (const text of [
    '--liquid-glass-auth-fallback:',
    '.liquid-glass-surface {',
    'overflow: hidden;',
    '.liquid-glass-surface[data-liquid-glass-layout="content"] {',
    '.liquid-glass-surface[data-liquid-glass-layout="content"] .liquid-glass-surface__content {',
    'height: auto !important;',
    '.liquid-glass-surface__effect[data-liquid-glass-measuring="true"] {',
    'transform: translate(-50%, -50%) scale(1) !important;',
    'transition: none !important;',
    'pointer-events: auto;',
    '.liquid-glass-surface--desktopStatusBar .glass__warp,',
    '.liquid-glass-surface--mobileStatusBar .glass__warp,',
    '.liquid-glass-surface--mobileNavigation .glass__warp,',
    '.liquid-glass-surface--desktopAuthCard .glass__warp,',
    '.liquid-glass-surface--mobileAuthCard .glass__warp {',
    '-webkit-backdrop-filter: blur(4px) saturate(140%);',
    '.liquid-glass-surface--desktopStatusBar,',
    '.liquid-glass-surface--mobileStatusBar,',
    '.liquid-glass-surface--mobileNavigation,',
    '.liquid-glass-surface--desktopAuthCard,',
    '.liquid-glass-surface--mobileAuthCard {',
    'background: transparent;',
    'box-shadow: none;',
    '.liquid-glass-surface--desktopStatusBar::after,',
    '.liquid-glass-surface--mobileNavigation::after,',
    '.liquid-glass-surface--desktopAuthCard::after,',
    'content: none;',
    '.liquid-glass-surface--desktopStatusBar > span,',
    '.liquid-glass-surface--mobileNavigation > span,',
    '.liquid-glass-surface--desktopAuthCard > span,',
    'display: block !important;',
    'visibility: visible !important;',
    'position: absolute !important;',
    'inset: 0 !important;',
    'width: 100% !important;',
    'height: 100% !important;',
    'padding: 0 !important;',
    'background: transparent !important;',
    '-webkit-mask: none !important;',
    'mask: none !important;',
    '-webkit-mask-composite: source-over !important;',
    'mask-composite: add !important;',
    'background: var(--liquid-glass-auth-fallback);',
    'border-radius: 24px !important;',
    'border-radius: 40px !important;',
    'grid-template-columns: repeat(5, minmax(0, 1fr));',
    '.mobile-bottom-navigation .liquid-glass-surface__content {',
    'padding: 8px 0;',
  ]) requireText(files.styles, text);""")
replace_regex('scripts/verify-liquid-glass-chrome.mjs', r"  for \(const text of \[\n    '--liquid-glass-auth-contrast:'[\s\S]*?\n  \]\) forbidText\(files\.styles, text\);", """  for (const text of [
    '--liquid-glass-auth-contrast:',
    '--liquid-glass-auth-mobile-contrast:',
    '--liquid-glass-contrast:',
    '--liquid-glass-structure-border:',
    'liquid-glass-surface__material-fill',
    '.liquid-glass-surface--statusBar',
    'border-radius: 999px !important;',
    '.workspace::before',
    'contain: paint;',
    'isolation: isolate;',
    'overflow: clip;',
    'padding: 1.5px !important;',
    'mask-composite: exclude;',
    '.liquid-glass-surface--mobileNavigation > span:first-of-type',
  ]) forbidText(files.styles, text);""")
replace_regex('scripts/verify-liquid-glass-chrome.mjs', r"  for \(const text of \[\n    '`liquid-glass-react@1\.1\.1` 是唯一液态玻璃渲染实现'[\s\S]*?\n  \]\) requireText\(files\.design, text\);", """  for (const text of [
    '`liquid-glass-react@1.1.1` 是唯一液态玻璃渲染实现',
    '`DESKTOP_STATUS_GLASS`',
    '`MOBILE_CHROME_GLASS`',
    '`DESKTOP_AUTH_CARD_GLASS`',
    '`MOBILE_AUTH_CARD_GLASS`',
    '`desktopStatusBar`',
    '`mobileStatusBar`',
    '`mobileNavigation`',
    '`desktopAuthCard`',
    '`mobileAuthCard`',
    '`layout="content"`',
    '单个 `ResizeObserver`',
    '认证卡片任一时刻只能存在一个',
    '中性测量态',
    '`scrollHeight`／`offsetHeight`',
    '真实认证内容与状态栏内容使用相同的 `.glass` 内部位置',
    '所有宿主保持透明',
    '不得创建低密度宿主染色',
    '`blur(4px) saturate(140%)`',
    '两个辅助节点必须保留完整宿主几何但保持透明',
    '两个直属边缘高光 `span` 必须全部可见',
    '第三方 `.glass` 默认外部阴影必须保留',
    '任一时刻只能渲染一个状态栏玻璃实例',
    '顶部状态栏不得包含 `ScrollArea`',
    '固定五列布局',
    '不得创建 `::after` 结构描边',
    '固定到视口安全边缘',
    'right: env(safe-area-inset-right, 0px)',
    '开放的背景采样链',
    '`contain: paint`',
    '`isolation: isolate`',
    '`overflow: clip`',
    '`-webkit-backdrop-filter`',
    '浏览器运行时 harness 必须加载真实的滚动条与外壳几何样式',
    '语义化 `<nav>` 是移动底栏唯一横向滚动视口',
    '不得重新引入 `ScrollArea`',
    '移动底栏垂直留白只允许由 `.liquid-glass-surface__content` 提供',
    '`SignedInShell`',
    '管理员桌面玻璃工作栏',
    '所有四个用途预设都必须固定 `elasticity: 0`',
    '`mouseContainer={null}`',
    '不得开启鼠标、触控板、触笔或触摸跟踪',
  ]) requireText(files.design, text);""")
replace_regex('scripts/verify-liquid-glass-chrome.mjs', r"  for \(const text of \[\n    '认证卡片必须使用 `src/components/auth/AuthCardSurface\.tsx`'[\s\S]*?\n  \]\) requireText\(files\.authDesign, text\);", """  for (const text of [
    '认证卡片必须使用 `src/components/auth/AuthCardSurface.tsx`',
    '位于第三方 `.glass` 内的 `.liquid-glass-surface__content`',
    '所有宿主背景必须透明',
    '统一悬浮玻璃对照参数',
    '第三方 `.glass` 的官方 `0 12px 40px rgba(0, 0, 0, 0.25)` 阴影不得被项目 CSS 覆盖',
    '`displacementScale=70`',
    '`elasticity=0`',
    '`mouseContainer={null}`',
    '不得开启鼠标、触控板、触笔或触摸跟踪',
    '两个边缘高光 `span` 必须全部可见',
    '都不得绘制项目 `::after` 结构描边',
    '不得在 `auth.css` 手写另一套 `backdrop-filter`',
    '注册内容较高时由文档视口纵向滚动',
  ]) requireText(files.authDesign, text);""")
replace_exact('scripts/verify-liquid-glass-chrome.mjs', 'desktop status bar uses its dedicated single-shell glass preset and shell inset', 'desktop status bar uses the shared authentication-card material and shell inset')
replace_exact('scripts/verify-liquid-glass-chrome.mjs', 'mobile status and navigation share the mobile chrome preset while status remains single-shell', 'mobile status and navigation share the authentication-card material while status remains single-shell')
replace_exact('scripts/verify-liquid-glass-chrome.mjs', '认证专用对照参数', '统一悬浮玻璃对照参数', all_occurrences=True, required=False)
replace_exact('scripts/verify-liquid-glass-chrome.mjs', '状态栏染色', '统一透明宿主', required=False)

require_absent('src/styles/liquid-glass-surfaces.css', ['--liquid-glass-contrast', '--liquid-glass-structure-border', 'padding: 1.5px !important;', 'mask-composite: exclude;', '.liquid-glass-surface--mobileNavigation > span:first-of-type', 'box-shadow: none !important;'])
require_present('src/styles/liquid-glass-surfaces.css', ['-webkit-backdrop-filter: blur(4px) saturate(140%);', '.liquid-glass-surface--desktopStatusBar::after,', '.liquid-glass-surface--mobileNavigation::after,', 'content: none;', '.liquid-glass-surface--desktopStatusBar > span,', '.liquid-glass-surface--mobileNavigation > span,', 'background: transparent !important;'])
require_absent('docs/LIQUID_GLASS_CHROME_DESIGN.md', ['overLight=true', 'blur(12px)', '--liquid-glass-contrast', '1.5px` 排除式 mask', '移动底栏允许保留第一层', '移动底栏继续使用宿主边框', '最上层连续结构描边'])
require_absent('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', ['overLight=true', '--liquid-glass-contrast', '状态栏单层结构描边'])
require_present('docs/LIQUID_GLASS_CHROME_DESIGN.md', ['桌面状态栏、管理员工作栏、移动状态栏、移动底栏和认证卡片统一使用 `overLight=false`', '两个直属边缘高光 `span` 必须全部可见', '第三方 `.glass` 默认外部阴影必须保留'])
require_present(BROWSER, ["toHaveAttribute('data-liquid-glass-over-light', 'false')", "expect(layout.outlineContent).toBe('none')", "expect(layout.glassBoxShadow).toContain('0px 12px 40px')", "expect(geometry.navigationGlassBoxShadow).toContain('0px 12px 40px')"])

print('Applied unified floating liquid-glass material to authentication, status, admin and mobile navigation surfaces.')
