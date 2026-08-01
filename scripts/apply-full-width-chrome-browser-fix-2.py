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


# The desktop scrollbar is absolutely positioned inside the already-lowered workspace.
# A second body-top offset would place it twice below the status bar.
layout_path = 'src/styles/game-shell-layout.css'
layout = read(layout_path)
layout = replace_once(
    layout,
    '''  .signed-in-shell .page-scroll-area > .ui-scrollbar--vertical {
    top: var(--desktop-shell-body-top);
    right: 0;
    bottom: 0;
  }''',
    '''  .signed-in-shell .page-scroll-area > .ui-scrollbar--vertical {
    top: 0;
    right: 0;
    bottom: 0;
  }''',
    'desktop scrollbar avoids double body offset',
)
write(layout_path, layout)

# The shell-level mobile chrome wrapper owns the 12px gutter. Its children use
# the wrapper content box directly and must not add the same gutter again.
viewport_path = 'src/styles/viewport.css'
viewport = read(viewport_path)
viewport = replace_once(
    viewport,
    '''  .asset-bar {
    position: absolute;
    z-index: auto;
    top: max(var(--mobile-chrome-block-inset), env(safe-area-inset-top));
    right: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));
    left: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));''',
    '''  .asset-bar {
    position: absolute;
    z-index: auto;
    top: max(var(--mobile-chrome-block-inset), env(safe-area-inset-top));
    right: 0;
    left: 0;''',
    'mobile status avoids double gutter',
)
viewport = replace_once(
    viewport,
    '''  .mobile-bottom-navigation {
    position: absolute;
    z-index: auto;
    right: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));
    bottom: max(var(--mobile-chrome-block-inset), env(safe-area-inset-bottom));
    left: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));''',
    '''  .mobile-bottom-navigation {
    position: absolute;
    z-index: auto;
    right: 0;
    bottom: max(var(--mobile-chrome-block-inset), env(safe-area-inset-bottom));
    left: 0;''',
    'mobile navigation avoids double gutter',
)
write(viewport_path, viewport)

# Use the market chart's published plot geometry rather than an arbitrary point
# that can land in the footer or time-label zone.
safe_spec_path = 'tests/browser/shell-floating-safe-zone.spec.ts'
safe_spec = read(safe_spec_path)
safe_spec = replace_once(
    safe_spec,
    '''  const box = await chart.boundingBox();
  if (!box) throw new Error('市场行情图几何缺失');
  await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.38);

  const tooltip = page.locator('.economy-chart-tooltip');''',
    '''  const box = await chart.boundingBox();
  if (!box) throw new Error('市场行情图几何缺失');
  const plot = await chart.evaluate((element) => {
    const wrapper = element as HTMLElement;
    const read = (name: string) => Number(wrapper.dataset[name]);
    return {
      left: read('axisLeft'),
      right: read('axisRight'),
      top: read('priceTop'),
      bottom: read('priceBottom'),
    };
  });
  const x = box.x + plot.left + (box.width - plot.left - plot.right) * 0.62;
  const y = box.y + (plot.top + plot.bottom) / 2;
  await page.mouse.move(x, y);

  const tooltip = page.locator('.economy-chart-tooltip');''',
    'market tooltip uses published plot geometry',
)
write(safe_spec_path, safe_spec)

verify_path = 'scripts/verify-game-shell-layout.mjs'
verify = read(verify_path)
verify = replace_once(
    verify,
    "  'top: var(--desktop-shell-body-top);',\n",
    "  '.page-scroll-area > .ui-scrollbar--vertical {',\n  'top: 0;',\n",
    'desktop scrollbar verifier avoids double offset',
)
verify = replace_once(
    verify,
    '''  'margin-inline-end: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));',
  'top: calc(', 'bottom: calc(', 'overflow: clip;',''',
    '''  'margin-inline-end: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));',
  'right: 0;', 'left: 0;',
  'top: calc(', 'bottom: calc(', 'overflow: clip;',''',
    'mobile chrome child gutter verifier',
)
verify = replace_once(
    verify,
    '''  'market-runtime-test.html?scenario=active',
  'game ECharts tooltip remains inside the lower workspace and never covers shell chrome',''',
    '''  'market-runtime-test.html?scenario=active',
  "read('axisLeft')", "read('priceTop')",
  'game ECharts tooltip remains inside the lower workspace and never covers shell chrome',''',
    'market plot geometry verifier',
)
write(verify_path, verify)

design_path = 'docs/LIQUID_GLASS_CHROME_DESIGN.md'
design = read(design_path)
design_anchor = '- `.signed-in-shell__chrome` 在桌面必须是有真实尺寸的块级网格行，禁止继承 `display:contents`；移动端 Chrome 作为根外壳兄弟层时必须自行承接与工作区相同的左右 gutter。'
design_replacement = design_anchor + '\n- 桌面页面滚动条的定位上下文已经是下方工作区，因此轨道使用工作区内 `top:0; bottom:0`，不得再次叠加 `--desktop-shell-body-top`。移动端左右 gutter 只能由 Chrome wrapper 承担一次，状态栏与底栏在 wrapper 内使用 `left:0; right:0`。'
if design_anchor not in design:
    raise SystemExit('Remaining browser geometry design anchor missing')
design = design.replace(design_anchor, design_replacement, 1)
write(design_path, design)

print('Fixed double desktop scrollbar offset, double mobile gutter and market tooltip hover geometry.')
