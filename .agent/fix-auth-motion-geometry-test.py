from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


browser = 'tests/browser/auth-three-layer.spec.ts'
replace_once(
    browser,
    '''      surfaceHeight: surface.getBoundingClientRect().height,
      effectHeight: effect.getBoundingClientRect().height,
      glassHeight: glassElement.getBoundingClientRect().height,
      filterHeight: filterSvg.getBoundingClientRect().height,''',
    '''      surfaceHeight: surface.clientHeight,
      effectHeight: effect.offsetHeight,
      glassHeight: glassElement.offsetHeight,
      filterHeight: filterSvg.clientHeight,''',
)
replace_once(
    browser,
    '      contentHeight: content.getBoundingClientRect().height,',
    '      contentHeight: content.scrollHeight,',
)
replace_once(
    browser,
    '''      visibleDirectDecorationSpanCount: directDecorationSpans.filter(isVisible).length,
      directDecorationTransforms: directDecorationSpans.map((element) => getComputedStyle(element).transform),''',
    '''      visibleDirectDecorationSpanCount: directDecorationSpans.filter(isVisible).length,
      directDecorationHeights: directDecorationSpans.map((element) => element.offsetHeight),
      directDecorationTransforms: directDecorationSpans.map((element) => getComputedStyle(element).transform),''',
)
replace_once(
    browser,
    '''      filterAligned: Math.abs(glass.surfaceHeight - glass.filterHeight) <= 1,
      visibleDirectDecorationSpanCount: glass.visibleDirectDecorationSpanCount,''',
    '''      filterAligned: Math.abs(glass.surfaceHeight - glass.filterHeight) <= 1,
      highlightsAligned: glass.directDecorationHeights.length === 2
        && glass.directDecorationHeights.every((height) => Math.abs(glass.surfaceHeight - height) <= 1),
      visibleDirectDecorationSpanCount: glass.visibleDirectDecorationSpanCount,''',
)
replace_once(
    browser,
    '''    filterAligned: true,
    visibleDirectDecorationSpanCount: 2,''',
    '''    filterAligned: true,
    highlightsAligned: true,
    visibleDirectDecorationSpanCount: 2,''',
)

design = 'docs/LIQUID_GLASS_CHROME_DESIGN.md'
replace_once(
    design,
    '17. Chromium 中把指针从认证卡片一侧移动到另一侧后，第三方 `.glass` 或直属高光的变换必须发生变化；登录→注册→登录和 `721px`／`720px` 双向切换后，宿主、效果层、`.glass`、SVG 滤镜与高光几何仍保持同步。',
    '17. Chromium 中把指针从认证卡片一侧移动到另一侧后，第三方 `.glass` 或直属高光的视觉 `transform` 必须发生变化；登录→注册→登录和 `721px`／`720px` 双向切换后，宿主、效果层、`.glass`、SVG 滤镜与高光的未变换布局尺寸（`clientHeight`／`offsetHeight`）仍保持同步，视觉包围盒允许随官方弹性变换而改变。',
)
