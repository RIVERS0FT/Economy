from pathlib import Path

# Review-only transport. Final source and tests remain; this file is removed before merge.
p = Path('server/test/commercial-auto-operation.test.js')
s = p.read_text()
a = s.index("test('offline commercial world advancement")
part = s[a:]
if 'zero-output recovery' not in part:
    part = part.replace("  assert.equal(group.status, 'error');", """  // Full decay can first enter a zero-output recovery cycle, without buying anything.
  assert.equal(group.status, 'running');
  assert.equal(group.pendingEffectiveCount, 0);
  assert.equal(group.pendingRevenue, 0);
  processCommercialWorld(world, group.cycleCompletesAt);
  assert.equal(group.status, 'error');
  assert.equal(group.statusReason, 'insufficient_input');
  assert.equal(player.credits, before);
  assert.equal(Number(market.todayBuyQuantity || 0), volume);""")
    p.write_text(s[:a] + part)
p = Path('server/test/commercial-facility-isolation.test.js')
s = p.read_text()
s = s.replace('  assert.equal(group.pendingProfit, type.profitPerCycle * 3);', '''  assert.equal(group.pendingEffectiveCount, 2);
  assert.equal(group.pendingStaffingRateBps, 8332);
  assert.equal(group.staffingBatchCarryBps, 4996);
  assert.equal(group.pendingProfit, type.profitPerCycle * 2);''')
s = s.replace("assert.equal(inventoryForProvince(player, 'clothing', provinceId).available, 1);", "assert.equal(inventoryForProvince(player, 'clothing', provinceId).available, 2);")
p.write_text(s)

p = Path('src/api/gameWriteConfirmation.ts')
s = p.read_text()
s = s.replace('  let lastFailure: unknown;', "  if (options.signal?.aborted) throw new DOMException('Game write was cancelled before sending', 'AbortError');\n  let lastFailure: unknown;") if 'cancelled before sending' not in s else s
p.write_text(s)
p = Path('tests/dt/game-write-confirmation.test.ts')
s = p.read_text()
if 'already aborted before send' not in s:
    s += '''
test('a request already aborted before send is not retried into a new economic action', async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  await assert.rejects(fetchConfirmedGameWrite(async () => { calls += 1; return response(); }, '/orders', init,
    { timeoutMs: 50, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 0);
});
'''
p.write_text(s)

p = Path('scripts/verify-market-action-latency.mjs')
s = p.read_text()
s = s.replace("  'const DEFAULT_WRITE_TIMEOUT_MS = 12_000;',", "  'const timedSignal = isWrite ? null : createTimedSignal(init?.signal, DEFAULT_READ_TIMEOUT_MS);',")
s = s.replace("  'const timeout = isSessionBootstrapWrite(input)',", "  'timeoutMs: isSessionBootstrapWrite(input) ? null : WRITE_ATTEMPT_TIMEOUT_MS,',\n  'inFlightWrites.get(fingerprint)',\n  'fetchConfirmedGameWrite(nativeFetch',")
for line in [
    "  'if (timeout !== null) globalThis.clearTimeout(timeout);',\n",
    "  'for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1)',\n",
    "  'attemptIndex === 0 ? init.signal : undefined',\n",
    "  'return response.status === 408 || response.status === 429 || response.status >= 500;',\n",
]: s = s.replace(line, '')
if "const completeWrite = 'src/api/gameWriteConfirmation.ts';" not in s:
    s = s.replace('if (failures.length > 0)', '''const completeWrite = 'src/api/gameWriteConfirmation.ts';
for (const token of [
  'await source.text()', 'JSON.parse(text)', 'Promise.race([read(), aborted])',
  'if (timeout !== null) globalThis.clearTimeout(timeout);',
  'for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1)',
  'attemptIndex === 0 ? options.signal : undefined',
  'return status === 408 || status === 429 || status >= 500;',
  'GameWriteUnconfirmedError',
]) requireText(completeWrite, token);
requireText(api, 'if (manualCommodity) { delete requestBody.price; delete requestBody.productionSettlement; }');
requireText(runtimeStore, 'barrier).then(() => this.authoritativeWriteExecutor.submit(options, callback))');
forbidText(runtimeStore, 'barrier).then(() => this.enqueueAuthoritativeWrite(options, callback))');

if (failures.length > 0)''')
p.write_text(s)

# Tests are served by the existing harness, never by a new production route.
p = Path('tests/browser/runtime-harness.tsx')
s = p.read_text()
if "import { TradeConfirmationHarness }" not in s:
    s = "import { TradeConfirmationHarness } from './TradeConfirmationHarness';\n" + s
    s = s.replace("'overview', 'map', 'commerce',", "'overview', 'map', 'commerce', 'trade-confirmation',")
    s = s.replace('const runtimeView =', '''function TradeConfirmationRuntime() {
  const [tab, setTab] = useState<TabId>('market');
  const base = useMemo(() => buildOverviewModel(tab, setTab), [tab]);
  return <TradeConfirmationHarness base={base} />;
}

const runtimeView =''')
    s = s.replace("const runtimeView = view === 'unified-buildings'", "const runtimeView = view === 'trade-confirmation' ? <TradeConfirmationRuntime /> : view === 'unified-buildings'")
p.write_text(s)
p = Path('runtime-test.html')
s = p.read_text().replace("'overview', 'map', 'commerce',", "'overview', 'map', 'commerce', 'trade-confirmation',")
p.write_text(s)
p = Path('tests/browser/trade-confirmation.spec.ts')
s = p.read_text()
s = s.replace("    const entry = page.getByRole('region', { name: '商品交易' });\n", '')
s = s.replace("    await expect(page.locator('.market-side-switch button')).toBeDisabled();", "    for (const control of await page.locator('.market-side-switch button').all()) await expect(control).toBeDisabled();")
p.write_text(s)
