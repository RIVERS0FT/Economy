from pathlib import Path


def patch(path, old, new):
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'{path}: expected block not found')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')

# Manual commodity instant trades return the persisted compact acknowledgement as soon as the write commits.
# State delivery remains the default for other actions and is generated only after the serial write queue is released.
patch(
    'server/src/app.js',
    '''    const actionDeliveryNow = Date.now();\n    Object.defineProperty(actionResponse, 'stateSnapshot', {\n      configurable: true,\n      enumerable: false,\n      value: store.getStateSnapshot(user, null, actionDeliveryNow),\n    });\n    const knownPartitions = readKnownPartitionRevisionsFromHeader(\n      request.headers['x-economy-state-revisions'],\n    );\n    sendJson(response, 200, createPartitionedActionDelivery(actionResponse, knownPartitions, actionDeliveryNow));\n''',
    '''    const compactManualCommodityOrder = route.action === 'placeOrder'\n      && payload.assetKind === 'commodity'\n      && !payload.execution;\n    if (compactManualCommodityOrder) {\n      sendJson(response, 200, actionResponse);\n      return;\n    }\n\n    const actionDeliveryNow = Date.now();\n    Object.defineProperty(actionResponse, 'stateSnapshot', {\n      configurable: true,\n      enumerable: false,\n      value: store.getStateSnapshot(user, null, actionDeliveryNow),\n    });\n    const knownPartitions = readKnownPartitionRevisionsFromHeader(\n      request.headers['x-economy-state-revisions'],\n    );\n    sendJson(response, 200, createPartitionedActionDelivery(actionResponse, knownPartitions, actionDeliveryNow));\n''',
)

# Update the state-delivery verifier to reflect the new queue boundary and the deliberate compact-ack exception.
capacity = Path('scripts/verify-state-delivery-capacity.mjs')
text = capacity.read_text(encoding='utf-8')
text = text.replace(
    "  'HTTP 传输层在事务提交后必须从当前 committed world 为当前玩家生成一次权威状态交付',",
    "  'HTTP 传输层在事务提交且权威写执行器释放串行写队列之后生成',\n  '手动商品即时买卖是延迟敏感例外',",
)
text = text.replace(
    "requireText('server/src/runtime-store.js', [\n  \"Object.defineProperty(response, 'stateSnapshot'\",\n  'value: this.getStateSnapshot(user, null, now)',\n]);\n",
    "forbidText('server/src/runtime-store.js', [\n  \"Object.defineProperty(response, 'stateSnapshot'\",\n  'value: this.getStateSnapshot(user, null, now)',\n]);\n",
)
app_anchor = "requireText('server/src/app.js', [\n  \"path === '/api/game/market-detail'\",\n  \"path === '/api/game/facility-build-quote'\",\n]);"
app_replacement = "requireText('server/src/app.js', [\n  \"path === '/api/game/market-detail'\",\n  \"path === '/api/game/facility-build-quote'\",\n  \"const compactManualCommodityOrder = route.action === 'placeOrder'\",\n  \"payload.assetKind === 'commodity'\",\n  \"sendJson(response, 200, actionResponse);\",\n  \"Object.defineProperty(actionResponse, 'stateSnapshot'\",\n  'value: store.getStateSnapshot(user, null, actionDeliveryNow)',\n  'createPartitionedActionDelivery(actionResponse, knownPartitions, actionDeliveryNow)',\n]);"
if app_anchor not in text:
    raise SystemExit('verify-state-delivery-capacity: app requirement block not found')
text = text.replace(app_anchor, app_replacement, 1)
capacity.write_text(text, encoding='utf-8')

# Market latency verifier locks that commodity manual trades do not wait for post-commit state projection.
latency = Path('scripts/verify-market-action-latency.mjs')
text = latency.read_text(encoding='utf-8')
needle = "for (const text of [\n  \"Object.defineProperty(actionResponse, 'stateSnapshot'\",\n  'value: store.getStateSnapshot(user, null, actionDeliveryNow)',\n  'createPartitionedActionDelivery(actionResponse, knownPartitions, actionDeliveryNow)',\n]) requireText(serverApp, text);"
replacement = "for (const text of [\n  \"const compactManualCommodityOrder = route.action === 'placeOrder'\",\n  \"payload.assetKind === 'commodity'\",\n  '!payload.execution',\n  'sendJson(response, 200, actionResponse);',\n  \"Object.defineProperty(actionResponse, 'stateSnapshot'\",\n  'value: store.getStateSnapshot(user, null, actionDeliveryNow)',\n  'createPartitionedActionDelivery(actionResponse, knownPartitions, actionDeliveryNow)',\n]) requireText(serverApp, text);"
if needle not in text:
    raise SystemExit('verify-market-action-latency: server app guard not found')
text = text.replace(needle, replacement, 1)
latency.write_text(text, encoding='utf-8')

# Design: default actions still carry post-commit state delivery, but the latency-sensitive commodity trade returns
# the persisted idempotent acknowledgement immediately and lets the existing non-blocking reconciliation fetch state.
server_design = Path('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md')
text = server_design.read_text(encoding='utf-8')
anchor = '客户端先把动作响应中的权威状态送入与 `GET state` 共用的缓存再结束 pending；正常成功路径不得为了取得同一动作结果再追加一次 `GET state`。'
replacement = anchor + ' 手动商品即时买卖是延迟敏感例外：事务与幂等确认提交成功后，HTTP 立即返回 `{ result, revision }` 精简确认，不等待提交后的全状态投影；客户端收到确认即结束交易 pending，再通过既有非阻塞 `GET state`／普通轮询恢复资金、库存与市场权威状态。该补拉失败不得把已经提交的成交改写为失败，也不得用新的幂等键重复成交。'
if anchor not in text:
    raise SystemExit('SERVER DESIGN action-delivery paragraph anchor not found')
text = text.replace(anchor, replacement, 1)
server_design.write_text(text, encoding='utf-8')

authoritative = Path('docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md')
text = authoritative.read_text(encoding='utf-8')
if '手动商品即时买卖收到服务器精简确认即结束交易 pending' not in text:
    text += '\n\n手动商品即时买卖收到服务器精简确认即结束交易 pending；提交后的资金、库存和市场状态通过非阻塞权威状态读取恢复。写请求 12 秒超时不应被提交后的全状态投影占用；同一逻辑交易在传输结果不确定时仍必须复用原 `Idempotency-Key`，避免重复成交。\n'
authoritative.write_text(text.rstrip('\n') + '\n', encoding='utf-8')

market_design = Path('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md')
text = market_design.read_text(encoding='utf-8')
if '手动即时商品交易的 HTTP 成功确认不得等待提交后的全状态投影' not in text:
    text += '\n\n手动即时商品交易的 HTTP 成功确认不得等待提交后的全状态投影：服务器事务和幂等结果落盘后立即返回精简确认，客户端结束提交状态并以非阻塞权威刷新恢复资金、库存和市场状态。刷新失败只表示状态同步待恢复，不能否定已提交成交，也不得生成新的幂等键重放同一交易。\n'
market_design.write_text(text.rstrip('\n') + '\n', encoding='utf-8')

for path in [
    'scripts/verify-state-delivery-capacity.mjs',
    'scripts/verify-market-action-latency.mjs',
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md',
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
]:
    file = Path(path)
    file.write_text(file.read_text(encoding='utf-8').rstrip('\n') + '\n', encoding='utf-8')

print('Compact commodity acknowledgement and verifier update applied.')
