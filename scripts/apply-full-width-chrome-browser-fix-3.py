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


spec_path = 'tests/browser/shell-floating-safe-zone.spec.ts'
spec = read(spec_path)
spec = replace_once(
    spec,
    "  await page.setViewportSize({ width: 1440, height: 900 });",
    "  await page.setViewportSize({ width: 1684, height: 931 });",
    'market safe-zone uses established desktop chart layout',
)
spec = replace_once(
    spec,
    '''  const chart = page.locator('.market-history-chart.full');
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
  const box = await chart.boundingBox();''',
    '''  const chart = page.locator('.market-history-chart.full');
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();''',
    'market safe-zone scrolls chart into view',
)
write(spec_path, spec)

verify_path = 'scripts/verify-game-shell-layout.mjs'
verify = read(verify_path)
verify = replace_once(
    verify,
    '''  "read('axisLeft')", "read('priceTop')",
  'game ECharts tooltip remains inside the lower workspace and never covers shell chrome',''',
    '''  "read('axisLeft')", "read('priceTop')", 'scrollIntoViewIfNeeded',
  'game ECharts tooltip remains inside the lower workspace and never covers shell chrome',''',
    'market visible hover verifier',
)
write(verify_path, verify)

print('Aligned the market floating safe-zone test with the established visible desktop hover scenario.')
