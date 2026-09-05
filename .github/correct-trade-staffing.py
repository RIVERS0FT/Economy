from pathlib import Path

p = Path('src/api/idempotentGameWriteFetch.ts')
s = p.read_text()
if 'function isManualCommodityWrite(' not in s:
    s = s.replace('function facilityToggleIntent(', '''function isManualCommodityWrite(input: RequestInfo | URL, body: string) {
  if (parsedRequestUrl(input).pathname !== `${GAME_API_PATH_PREFIX}/orders`) return false;
  try {
    const value = JSON.parse(body);
    return value?.assetKind === 'commodity' && !value.execution && (value.side === 'buy' || value.side === 'sell');
  } catch { return false; }
}

function facilityToggleIntent(''')
    s = s.replace('    const existing = inFlightWrites.get(fingerprint);', '    const deduplicate = isManualCommodityWrite(input, init.body);\n    const existing = deduplicate ? inFlightWrites.get(fingerprint) : undefined;')
    s = s.replace('    inFlightWrites.set(fingerprint, operation);', '    if (deduplicate) inFlightWrites.set(fingerprint, operation);')
p.write_text(s)

p = Path('src/pages/MarketPage.tsx')
s = p.read_text()
s = s.replace('            provinceId={model.selectedProvinceId}\n                key={`${assetId}:${orderSide}`}', '                provinceId={model.selectedProvinceId}\n                key={`${model.game.userId}:${model.game.saveEpoch ?? 0}:${model.selectedProvinceId}:${assetId}:${orderSide}`}')
s = s.replace('  const total = officialPrice * effectiveQuantity;', '  const total = (pendingTrade.current?.price ?? officialPrice) * effectiveQuantity;')
s = s.replace("aria-invalid={Boolean(quantityReason)}", "aria-invalid={!controlsLocked && Boolean(quantityReason)}")
s = s.replace("aria-describedby={quantityReason ? 'market-trade-quantity-error' : undefined}", "aria-describedby={!controlsLocked && quantityReason ? 'market-trade-quantity-error' : undefined}")
s = s.replace("{quantityReason ? <small id=\"market-trade-quantity-error\"", "{!controlsLocked && quantityReason ? <small id=\"market-trade-quantity-error\"")
p.write_text(s)

p = Path('scripts/verify-market-page-layout.mjs')
s = p.read_text().replace("placeAssetOrder('commodity', assetId, orderSide, parsedQuantity, officialPrice)", "placeAssetOrder('commodity', assetId, snapshot.side, snapshot.quantity, snapshot.price)")
s = s.replace("{orderSide === 'buy' ? `立即买入${assetName}` : `立即卖出${assetName}`}", "orderSide === 'buy' ? `立即买入${assetName}` : `立即卖出${assetName}`")
p.write_text(s)
p = Path('scripts/verify-authoritative-countdowns.mjs')
s = p.read_text().replace("requireText('src/api/game.ts', 'DEFAULT_WRITE_TIMEOUT_MS = 12_000');", "requireText('src/api/idempotentGameWriteFetch.ts', 'WRITE_ATTEMPT_TIMEOUT_MS = 12_000');")
# Some verifiers group token assertions in arrays instead of individual calls.
s = s.replace("'DEFAULT_WRITE_TIMEOUT_MS = 12_000',", "'const timedSignal = isWrite ? null : createTimedSignal(init?.signal, DEFAULT_READ_TIMEOUT_MS);',")
p.write_text(s)
for p in Path('scripts').glob('verify-*.mjs'):
    s = p.read_text()
    updated = s.replace('key={`${assetId}:${orderSide}`}', 'key={`${model.game.userId}:${model.game.saveEpoch ?? 0}:${model.selectedProvinceId}:${assetId}:${orderSide}`}')
    if updated != s: p.write_text(updated)

p = Path('docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md')
s = p.read_text().replace('相同逻辑操作在同一页面内同时发起时共享一个正在执行的确认任务', '相同手动商品逻辑操作在同一页面内同时发起时共享一个正在执行的确认任务')
s = s.replace('各调用方获得可独立读取的回执，不并发重发同一笔操作。', '各调用方获得可独立读取的回执，不并发重发同一笔操作。直接启停开关仍遵守其原串行意图队列，不能因商品请求合并而吞掉中间或后续开关意图。')
p.write_text(s)
p = Path('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md')
s = p.read_text()
if '交易编辑器按玩家、存档、地区、商品和方向隔离' not in s:
    s += '\n交易编辑器按玩家、存档、地区、商品和方向隔离，切换上下文不得把旧待确认参数提交到新地区或新商品。确认期间保持本次数量和价格预览，不用已变化的余额／库存显示新交易校验错误；成交金额仍以服务器回执为准。\n'
p.write_text(s)
