from pathlib import Path


def replace(path, old, new):
    file = Path(path)
    text = file.read_text()
    assert text.count(old) == 1, f'{path}: {text.count(old)} matches for {old[:80]!r}'
    file.write_text(text.replace(old, new))


replace('src/utils/provinceLogistics.ts', 'export function formatTransportDuration(ms: number) {', '''export function formatTransportRate(value: number) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 6, useGrouping: false });
}

export function formatTransportDuration(ms: number) {''')
replace('src/components/shell/StrategicWorkspace.tsx', 'import { isTransportRouteClosed, transportRouteSetupCost, transportRouteStopIds }', 'import { formatTransportRate, isTransportRouteClosed, transportRouteSetupCost, transportRouteStopIds }')
replace('src/components/shell/StrategicWorkspace.tsx', 'definition.transportFeePerKm.toFixed(2)', 'formatTransportRate(definition.transportFeePerKm)')
replace('src/components/shell/StrategicWorkspace.tsx', 'definition.fuelPerKm.toFixed(2)', 'formatTransportRate(definition.fuelPerKm)')
replace('tests/dt/transport-planning.test.ts', "import { transportMaintenanceCandidates, estimateTransportRoute }", "import { formatTransportRate } from '../../src/utils/provinceLogistics.ts';\nimport { transportMaintenanceCandidates, estimateTransportRoute }")
p = Path('tests/dt/transport-planning.test.ts')
p.write_text(p.read_text() + '''

test('per-kilometer rate labels preserve meaningful fractional precision', () => {
  assert.equal(formatTransportRate(0.015), '0.015');
  assert.equal(formatTransportRate(0.005), '0.005');
  assert.equal(formatTransportRate(0.02), '0.02');
  assert.equal(formatTransportRate(0.000001), '0.000001');
  assert.equal(formatTransportRate(1), '1');
});
''')
p = Path('tests/browser/transport-balance.spec.ts')
p.write_text(p.read_text() + '''

test('transport mode choices display actual fractional road fee and fuel rates', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^运输/ }).click();
  await page.locator('.transport-page-footer').getByRole('button', { name: '增加路线', exact: true }).click();
  await page.locator('.transport-map-picking-bar').getByRole('combobox', { name: '运输方式' }).click();
  await expect(page.getByRole('option', { name: /公路运输/ })).toContainText('运输费 0.015/公里 · 燃料 0.005/公里');
});
''')
print('Preserved six-digit internal fractional rate display without changing currency formatting.')
