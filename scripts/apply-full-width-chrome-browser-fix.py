from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8').replace('\r\n', '\n')


def write(path: str, content: str) -> None:
    normalized = '\n'.join(line.rstrip() for line in content.replace('\r\n', '\n').split('\n')).rstrip() + '\n'
    Path(path).write_text(normalized, encoding='utf-8')


def replace_once(content: str, old: str, new: str, label: str) -> str:
    if content.count(old) != 1:
        raise SystemExit(f'{label}: expected one anchor, found {content.count(old)}')
    return content.replace(old, new, 1)


# Desktop chrome must be a real grid-row box rather than inheriting display:contents.
layout_path = 'src/styles/game-shell-layout.css'
layout = read(layout_path)
layout = replace_once(
    layout,
    '''  .signed-in-shell__chrome {
    position: relative;
    grid-column: 1;
    grid-row: 1;
    width: 100%;''',
    '''  .signed-in-shell__chrome {
    position: relative;
    grid-column: 1;
    grid-row: 1;
    width: 100%;
    display: block;
    box-sizing: border-box;''',
    'desktop chrome real box',
)
layout = replace_once(
    layout,
    '''  .signed-in-shell .page-scroll-area > .ui-scrollbar--vertical {
    right: 0;
  }''',
    '''  .signed-in-shell .page-scroll-area > .ui-scrollbar--vertical {
    top: var(--desktop-shell-body-top);
    right: 0;
    bottom: 0;
  }''',
    'desktop page scrollbar lower-row range',
)
write(layout_path, layout)

# The mobile chrome is now a shell sibling, so it must carry the old workspace gutter itself.
viewport_path = 'src/styles/viewport.css'
viewport = read(viewport_path)
viewport = replace_once(
    viewport,
    '''  .signed-in-shell__chrome {
    position: relative;
    order: 2;
    overflow: visible;
    pointer-events: none;
  }''',
    '''  .signed-in-shell__chrome {
    position: relative;
    order: 2;
    width: auto;
    margin-inline-start: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));
    margin-inline-end: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));
    overflow: visible;
    pointer-events: none;
  }''',
    'mobile chrome shared gutter',
)
write(viewport_path, viewport)

# The persistent-background test follows the new shell body/chrome sibling order.
game_three_path = 'tests/browser/game-three-layer.spec.ts'
game_three = read(game_three_path)
game_three = replace_once(
    game_three,
    '''      const workspace = document.querySelector<HTMLElement>('.workspace');
      const pageOverlay = document.querySelector<HTMLElement>('.mobile-page-overlay');
      const chromeOverlay = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
      if (!workspace || !pageOverlay || !chromeOverlay) throw new Error('mobile game overlay fixture is incomplete');
      const children = [...workspace.children];
      return {
        pageIndex: children.indexOf(pageOverlay),
        chromeIndex: children.indexOf(chromeOverlay),''',
    '''      const shell = document.querySelector<HTMLElement>('.game-shell');
      const body = document.querySelector<HTMLElement>('.signed-in-shell__body');
      const workspace = document.querySelector<HTMLElement>('.workspace');
      const pageOverlay = document.querySelector<HTMLElement>('.mobile-page-overlay');
      const chromeOverlay = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
      if (!shell || !body || !workspace || !pageOverlay || !chromeOverlay) throw new Error('mobile game overlay fixture is incomplete');
      const shellChildren = [...shell.children];
      const workspaceChildren = [...workspace.children];
      return {
        bodyIndex: shellChildren.indexOf(body),
        chromeIndex: shellChildren.indexOf(chromeOverlay),
        pageIndex: workspaceChildren.indexOf(pageOverlay),''',
    'mobile game shell sibling order geometry',
)
game_three = replace_once(
    game_three,
    '''    expect(layout.pageIndex).toBe(0);
    expect(layout.chromeIndex).toBe(1);''',
    '''    expect(layout.bodyIndex).toBe(0);
    expect(layout.chromeIndex).toBe(1);
    expect(layout.pageIndex).toBe(0);''',
    'mobile game shell sibling order assertions',
)
write(game_three_path, game_three)

# The safe-zone market test must use the dedicated market runtime harness.
safe_spec_path = 'tests/browser/shell-floating-safe-zone.spec.ts'
safe_spec = read(safe_spec_path)
safe_spec = replace_once(
    safe_spec,
    "  await page.goto('runtime-test.html?view=market&scenario=activity');",
    "  await page.goto('market-runtime-test.html?scenario=active');",
    'market safe-zone harness URL',
)
safe_spec = replace_once(
    safe_spec,
    '''  const chart = page.locator('.market-history-chart');
  await expect(chart.locator('[data-echarts-ready="true"]')).toBeVisible();''',
    '''  const chart = page.locator('.market-history-chart.full');
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');''',
    'market safe-zone ready selector',
)
write(safe_spec_path, safe_spec)

# Lock the fixed page scrollbar to the lower shell row in actual geometry.
shell_spec_path = 'tests/browser/game-shell-layout.spec.ts'
shell_spec = read(shell_spec_path)
shell_spec = replace_once(
    shell_spec,
    '''  pageScrollbar: { railRight: number; thumbRight: number };''',
    '''  pageScrollbar: { railTop: number; railRight: number; railBottom: number; thumbRight: number };''',
    'page scrollbar geometry type',
)
shell_spec = replace_once(
    shell_spec,
    '''      pageScrollbar: {
        railRight: pageScrollbarRailRect.right,
        thumbRight: pageScrollbarThumbRect.right,
      },''',
    '''      pageScrollbar: {
        railTop: pageScrollbarRailRect.top,
        railRight: pageScrollbarRailRect.right,
        railBottom: pageScrollbarRailRect.bottom,
        thumbRight: pageScrollbarThumbRect.right,
      },''',
    'page scrollbar geometry return',
)
shell_spec = replace_once(
    shell_spec,
    '''  expect(layout.pageScrollbar.railRight).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.pageScrollbar.thumbRight).toBeCloseTo(layout.viewportWidth, 0);''',
    '''  expect(layout.pageScrollbar.railTop).toBeCloseTo(layout.body.top, 0);
  expect(layout.pageScrollbar.railRight).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.pageScrollbar.railBottom).toBeCloseTo(layout.viewportHeight, 0);
  expect(layout.pageScrollbar.thumbRight).toBeCloseTo(layout.viewportWidth, 0);''',
    'page scrollbar lower-row assertions',
)
write(shell_spec_path, shell_spec)

# Extend the static architecture gate and authority text for these browser-discovered constraints.
verify_path = 'scripts/verify-game-shell-layout.mjs'
verify = read(verify_path)
verify = replace_once(
    verify,
    '''  '.signed-in-shell__chrome {',
  '.signed-in-shell__body {',''',
    '''  '.signed-in-shell__chrome {',
  'display: block;',
  '.signed-in-shell__body {',''',
    'desktop chrome display verifier',
)
verify = replace_once(
    verify,
    '''  'padding-top: 0;',
  'scroll-padding-top: 0;',
  '.workspace-floating-layer {',''',
    '''  'padding-top: 0;',
  'scroll-padding-top: 0;',
  'top: var(--desktop-shell-body-top);',
  '.workspace-floating-layer {',''',
    'desktop scrollbar lower-row verifier',
)
verify = replace_once(
    verify,
    '''  'grid-template-rows: minmax(0, 1fr);',
  'top: calc(', 'bottom: calc(', 'overflow: clip;',''',
    '''  'grid-template-rows: minmax(0, 1fr);',
  'margin-inline-start: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));',
  'margin-inline-end: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));',
  'top: calc(', 'bottom: calc(', 'overflow: clip;',''',
    'mobile chrome gutter verifier',
)
verify = replace_once(
    verify,
    '''  'expect(layout.floatingLayer.top).toBeCloseTo(layout.workspace.top, 0)',
]);''',
    '''  'expect(layout.floatingLayer.top).toBeCloseTo(layout.workspace.top, 0)',
  'expect(layout.pageScrollbar.railTop).toBeCloseTo(layout.body.top, 0)',
]);''',
    'scrollbar browser regression verifier',
)
verify = replace_once(
    verify,
    '''check('tests/browser/shell-floating-safe-zone.spec.ts', [
  'game ECharts tooltip remains inside the lower workspace and never covers shell chrome',''',
    '''check('tests/browser/game-three-layer.spec.ts', [
  'bodyIndex: shellChildren.indexOf(body)',
  'chromeIndex: shellChildren.indexOf(chromeOverlay)',
]);
check('tests/browser/shell-floating-safe-zone.spec.ts', [
  'market-runtime-test.html?scenario=active',
  'game ECharts tooltip remains inside the lower workspace and never covers shell chrome',''',
    'new shell order and market harness verifier',
)
write(verify_path, verify)

design_path = 'docs/LIQUID_GLASS_CHROME_DESIGN.md'
design = read(design_path)
design_anchor = '- 页面主滚动条只覆盖下方工作区的纵向范围，右边缘继续贴合视口；不得穿过顶部工作栏，也不得因显隐改变页面 `clientWidth`。'
design_replacement = design_anchor + '\n- `.signed-in-shell__chrome` 在桌面必须是有真实尺寸的块级网格行，禁止继承 `display:contents`；移动端 Chrome 作为根外壳兄弟层时必须自行承接与工作区相同的左右 gutter。'
if design_anchor not in design:
    raise SystemExit('Browser-discovered chrome geometry design anchor missing')
design = design.replace(design_anchor, design_replacement, 1)
write(design_path, design)

print('Applied browser-discovered desktop chrome, mobile gutter, shell order, market harness and scrollbar geometry fixes.')
