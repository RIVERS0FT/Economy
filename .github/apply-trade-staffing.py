from pathlib import Path
import re


def edit(path, before, after, count=1):
    p = Path(path)
    text = p.read_text()
    assert text.count(before) == count, (path, before[:100], text.count(before), count)
    p.write_text(text.replace(before, after))

# The client write coordinator owns the full receipt deadline and in-flight deduplication.
p = Path('src/api/idempotentGameWriteFetch.ts')
s = p.read_text()
s = "import { fetchConfirmedGameWrite, isConfirmedActionResult, isUnconfirmedWriteStatus } from './gameWriteConfirmation';\nimport { publishCommodityWriteProgress } from './commodityWriteProgress';\n" + s
s = s.replace('const directControlTails =', 'const inFlightWrites = new Map<string, Promise<Response>>();\nconst directControlTails =')
a = s.index('  while (pendingWrites.size > MAX_PENDING_WRITES) {')
b = s.index('  if (changed) persistPendingWrites();', a)
s = s[:a] + s[b:]
s = s.replace('  const reservation = { key: proposedKey, createdAt: now };', "  if (pendingWrites.size >= MAX_PENDING_WRITES) throw new Error('待确认操作较多，请先确认已有操作。');\n  const reservation = { key: proposedKey, createdAt: now };")
a = s.index('function shouldKeepReservation(')
b = s.index('function actionDeliveryPayload(', a)
s = s[:a] + '''function shouldKeepReservation(response: Response) {
  return isUnconfirmedWriteStatus(response.status);
}

''' + s[b:]
a = s.index('async function reconcileActionDelivery(')
b = s.index('  if (!actionDeliveryPayload(payload))', a)
s = s[:a] + '''function reconcileActionDelivery(response: Response, payload: unknown): ActionDeliveryReconciliation {
  if (!response.ok) return { commandOk: null, authorityApplied: false };
''' + s[b:]
a = s.index('async function fetchWriteAttempt(')
b = s.index('export function installIdempotentGameWriteFetch()', a)
s = s[:a] + s[b:]
s = s.replace('    const immediateIntent = facilityToggleIntent(input, init);\n', '')
a = s.index('    const reservation = reserveWriteKey(fingerprint, proposedKey);')
s = s[:a] + '''    const existing = inFlightWrites.get(fingerprint);
    if (existing) return (await existing).clone();
    hydratePendingWrites();
    const wasPending = pendingWrites.has(fingerprint);
    const reservation = reserveWriteKey(fingerprint, proposedKey);
    headers.set('Idempotency-Key', reservation.key);
    const immediateIntent = facilityToggleIntent(input, init);
    const isOrder = parsedRequestUrl(input).pathname === `${GAME_API_PATH_PREFIX}/orders`;
    const notify = (phase: Parameters<typeof publishCommodityWriteProgress>[1]) => {
      if (isOrder) publishCommodityWriteProgress(init.body as string, phase);
    };
    const operation = runSerializedDirectControl(immediateIntent?.queueKey ?? null, async () => {
      notify(wasPending ? 'confirming' : 'submitting');
      try {
        const { response, payload } = await fetchConfirmedGameWrite(nativeFetch, input, { ...init, headers }, {
          timeoutMs: isSessionBootstrapWrite(input) ? null : WRITE_ATTEMPT_TIMEOUT_MS,
          signal: init.signal,
          validateSuccess: isOrder ? isConfirmedActionResult : undefined,
          onConfirming: () => notify('confirming'),
        });
        const reconciliation = reconcileActionDelivery(response, payload);
        if (immediateIntent) {
          if (!response.ok || reconciliation.commandOk === false) {
            rejectFacilityEnabledIntent(immediateIntent.provinceId, immediateIntent.facilityTypeId, immediateIntent.sequence);
          } else {
            acknowledgeFacilityEnabledIntent(immediateIntent.provinceId, immediateIntent.facilityTypeId,
              immediateIntent.sequence, reconciliation.authorityApplied);
          }
        }
        if (!shouldKeepReservation(response)) {
          releaseWriteKey(fingerprint, reservation.key);
          notify('settled');
        } else notify('unconfirmed');
        return response;
      } catch (reason) {
        // Even an unexpected failure after send cannot prove the transaction was cancelled.
        notify('unconfirmed');
        if (immediateIntent) rejectFacilityEnabledIntent(immediateIntent.provinceId, immediateIntent.facilityTypeId, immediateIntent.sequence);
        throw reason;
      }
    });
    inFlightWrites.set(fingerprint, operation);
    try { return (await operation).clone(); }
    finally { if (inFlightWrites.get(fingerprint) === operation) inFlightWrites.delete(fingerprint); }
  };
}
'''
p.write_text(s)

p = Path('src/api/game.ts')
s = p.read_text()
s = "import { installIdempotentGameWriteFetch } from './idempotentGameWriteFetch';\nimport { GameWriteUnconfirmedError, isUnconfirmedWriteStatus, WRITE_RESULT_UNCONFIRMED, WRITE_RESULT_UNCONFIRMED_MESSAGE } from './gameWriteConfirmation';\n" + s
s = s.replace('const DEFAULT_WRITE_TIMEOUT_MS = 12_000;\n', '')
s = s.replace('export interface GameActionResult { ok: boolean; message: string; }', 'export interface GameActionResult { ok: boolean; message: string; code?: string; }')
a = s.index('  const timeoutMs = init?.method')
b = s.index('  try {\n    const response = await fetch', a)
s = s[:a] + '''  const isWrite = Boolean(init?.method && init.method !== 'GET' && init.method !== 'HEAD');
  if (isWrite) installIdempotentGameWriteFetch();
  const timedSignal = isWrite ? null : createTimedSignal(init?.signal, DEFAULT_READ_TIMEOUT_MS);
''' + s[b:]
s = s.replace('signal: timedSignal.signal,', 'signal: timedSignal?.signal ?? init?.signal,')
s = s.replace("      throw new GameApiError(response.status, message, code);", "      if (isWrite && isUnconfirmedWriteStatus(response.status)) {\n        throw new GameApiError(response.status, WRITE_RESULT_UNCONFIRMED_MESSAGE, WRITE_RESULT_UNCONFIRMED);\n      }\n      throw new GameApiError(response.status, message, code);")
s = s.replace('    if (timedSignal.didTimeout()', "    if (reason instanceof GameWriteUnconfirmedError) {\n      throw new GameApiError(408, reason.message, reason.code);\n    }\n    if (timedSignal?.didTimeout()")
s = s.replace('    timedSignal.cleanup();', '    timedSignal?.cleanup();')
s = s.replace('  const claim = pendingProductionSettlement;\n  const payload = claim ? { ...body, productionSettlement: claim } : body;', '''  const manualCommodity = path === '/orders' && body.assetKind === 'commodity' && !body.execution
    && (body.side === 'buy' || body.side === 'sell');
  const requestBody = { ...body };
  // Manual commodity prices are server-owned. Omit volatile preview fields so a
  // pending intent stays identical across polls, price rollover and page reload.
  if (manualCommodity) { delete requestBody.price; delete requestBody.productionSettlement; }
  const claim = manualCommodity ? null : pendingProductionSettlement;
  const payload = claim ? { ...requestBody, productionSettlement: claim } : requestBody;''')
p.write_text(s)

p = Path('src/app/gameViewModel.ts')
s = p.read_text()
a = s.index('  const placeAssetOrder = useCallback(')
b = s.index('  const derived =', a)
part = s[a:b].replace('return { ok: false, message: messageFromError(reason) };', "return { ok: false, message: messageFromError(reason), code: reason instanceof GameApiError ? reason.code : undefined };")
s = s[:a] + part + s[b:]
p.write_text(s)

# One due-world barrier is sufficient; rechecking recursively can starve user writes.
edit('server/src/runtime-store.js',
     "if (barrier) return measureRequestPhase('schedulerBarrierWaitMs', () => barrier).then(() => this.enqueueAuthoritativeWrite(options, callback));",
     "if (barrier) return measureRequestPhase('schedulerBarrierWaitMs', () => barrier).then(() => this.authoritativeWriteExecutor.submit(options, callback));")

p = Path('src/pages/MarketPage.tsx')
s = p.read_text().replace('useEffect, useMemo, useState', 'useEffect, useMemo, useRef, useState')
s = "import { subscribeCommodityWriteProgress } from '../api/commodityWriteProgress';\nimport { WRITE_RESULT_UNCONFIRMED } from '../api/gameWriteConfirmation';\n" + s
a = s.index('function MarketImmediateTradeEntry({')
b = s.index('export function MarketPage(', a)
part = s[a:b]
part = part.replace('  assetId,', '  provinceId,\n  assetId,', 1).replace('  assetId: string;', '  provinceId: string;\n  assetId: string;', 1)
part = part.replace('  const maxBuyByFunds =', '''  const [tradePhase, setTradePhase] = useState<'idle' | 'submitting' | 'confirming' | 'unconfirmed'>('idle');
  const [tradeFeedback, setTradeFeedback] = useState('');
  const tradePending = useRef(false);
  const pendingTrade = useRef<{ side: OrderSide; quantity: number; price: number } | null>(null);
  const controlsLocked = tradePhase !== 'idle';
  useEffect(() => subscribeCommodityWriteProgress((progress) => {
    if (!tradePending.current || progress.provinceId !== provinceId || progress.assetId !== assetId) return;
    if (progress.phase === 'confirming') setTradePhase('confirming');
  }), [provinceId, assetId]);
  const maxBuyByFunds =''')
a2 = part.index('  function submitTrade() {')
b2 = part.index('\n  return (', a2)
part = part[:a2] + '''  async function submitTrade() {
    if (tradePending.current) return;
    if (!pendingTrade.current && (quantityReason || parsedQuantity === null)) return;
    const snapshot = pendingTrade.current ?? { side: orderSide, quantity: parsedQuantity!, price: officialPrice };
    const confirming = pendingTrade.current !== null;
    pendingTrade.current = snapshot;
    tradePending.current = true;
    setTradePhase(confirming ? 'confirming' : 'submitting');
    setTradeFeedback('');
    try {
      const result = await placeAssetOrder('commodity', assetId, snapshot.side, snapshot.quantity, snapshot.price);
      setTradeFeedback(result.message);
      if (result.code === WRITE_RESULT_UNCONFIRMED) setTradePhase('unconfirmed');
      else { pendingTrade.current = null; setTradePhase('idle'); }
      void Promise.resolve(showResult(result)).catch(() => {});
    } catch {
      setTradePhase('unconfirmed');
      setTradeFeedback('交易结果尚未确认，请勿重复交易；请确认原交易结果。');
    } finally { tradePending.current = false; }
  }
''' + part[b2:]
part = part.replace("onClick={() => selectOrderSide('buy')}", "disabled={controlsLocked}\n          onClick={() => selectOrderSide('buy')}")
part = part.replace("onClick={() => selectOrderSide('sell')}", "disabled={controlsLocked}\n          onClick={() => selectOrderSide('sell')}")
part = part.replace('disabled={maxTradeQuantity < 1', 'disabled={controlsLocked || maxTradeQuantity < 1')
part = part.replace('disabled={Boolean(quantityReason)}', "disabled={tradePhase === 'submitting' || tradePhase === 'confirming' || (!pendingTrade.current && Boolean(quantityReason))}")
part = part.replace("{orderSide === 'buy' ? `立即买入${assetName}` : `立即卖出${assetName}`}", "{tradePhase === 'unconfirmed' ? '确认交易结果' : tradePhase === 'confirming' ? '正在确认交易结果…'\n          : tradePhase === 'submitting' ? (orderSide === 'buy' ? '正在买入…' : '正在卖出…')\n            : orderSide === 'buy' ? `立即买入${assetName}` : `立即卖出${assetName}`}")
part = part.replace('    </section>\n  );', "      {tradeFeedback ? <small className=\"ui-helper-text market-trade-feedback\" role={tradePhase === 'unconfirmed' ? 'alert' : 'status'}>{tradeFeedback}</small> : null}\n    </section>\n  );")
s = s[:a] + part + s[b:]
s = s.replace('<MarketImmediateTradeEntry\n', '<MarketImmediateTradeEntry\n            provinceId={model.selectedProvinceId}\n')
p.write_text(s)

# Server staffing authority is independent from industrial production.
p = Path('server/src/commercial-buildings.js')
s = "import { commercialExpansionStaffingRate, commercialStaffingCapacity, hasCommercialCycle, projectCommercialStaffingRate } from '../../shared/commercial-staffing.js';\n" + p.read_text()
s = s.replace('group.pendingRevenue > 0', 'hasCommercialCycle(group)')
s = s.replace("  if (hasCommercialCycle(group)) {\n    group.cycleStartedAt", "  if (hasCommercialCycle(group)) {\n    group.cycleActive = true;\n    group.cycleStartedAt", 1)
s = s.replace('    delete group.pendingInputs;', '    delete group.pendingInputs;\n    delete group.cycleActive;\n    delete group.pendingStaffingRateBps;\n    delete group.pendingEffectiveCount;')
s = s.replace('  delete group.pendingInputs;\n}', '  delete group.pendingInputs;\n  delete group.cycleActive;\n  delete group.pendingStaffingRateBps;\n  delete group.pendingEffectiveCount;\n}')
s = s.replace('  return group.count > 0 ? group : null;', '''  if (!Number.isInteger(group.staffingRateBps) || group.staffingRateBps < 0 || group.staffingRateBps > 10_000
    || !Number.isFinite(group.staffingUpdatedAt) || group.staffingUpdatedAt < 0) {
    // Establish the migration baseline now; never apply decay retroactively to old saves.
    group.staffingRateBps = 10_000;
    group.staffingUpdatedAt = Math.max(0, Number(now) || 0);
  }
  if (!Number.isInteger(group.staffingBatchCarryBps) || group.staffingBatchCarryBps < 0 || group.staffingBatchCarryBps >= 10_000) group.staffingBatchCarryBps = 0;
  return group.count > 0 ? group : null;''')
s = s.replace("      statusReason: 'manual',\n      lifetimeRevenue", "      statusReason: 'manual',\n      staffingRateBps: 10_000,\n      staffingUpdatedAt: now,\n      staffingBatchCarryBps: 0,\n      lifetimeRevenue")
s = s.replace('function setBlocked(group, reason) {', '''function commitCommercialStaffing(group, now) {
  const at = Math.max(Number(group.staffingUpdatedAt) || 0, Number(now) || 0);
  const rate = projectCommercialStaffingRate(group, at);
  group.staffingRateBps = rate ?? 10_000;
  group.staffingUpdatedAt = at;
  return group.staffingRateBps;
}

function setBlocked(group, reason, now) {
  if (group.status !== 'error') commitCommercialStaffing(group, now);''')
s = s.replace('  const requirements = cycleRequirements(type, participatingCount);', '''  const rate = projectCommercialStaffingRate(group, startedAt) ?? 10_000;
  const capacity = commercialStaffingCapacity(participatingCount, rate, group.staffingBatchCarryBps);
  const requirements = cycleRequirements(type, capacity.effectiveCount);''')
s = s.replace("setBlocked(group, 'insufficient_funds');", "setBlocked(group, 'insufficient_funds', startedAt);")
s = s.replace("setBlocked(group, 'insufficient_input');", "setBlocked(group, 'insufficient_input', startedAt);")
s = s.replace('  group.participatingCount = participatingCount;\n  group.status', '''  group.staffingRateBps = rate;
  group.staffingUpdatedAt = Math.max(Number(group.staffingUpdatedAt) || 0, startedAt);
  group.staffingBatchCarryBps = capacity.carryBps;
  group.cycleActive = true;
  group.pendingStaffingRateBps = rate;
  group.pendingEffectiveCount = capacity.effectiveCount;
  group.participatingCount = participatingCount;
  group.status''')
a = s.index('function buildCommercialBuilding(')
b = s.index('function startCommercialBuilding(', a)
part = s[a:b]
part = part.replace('  const totalCost =', '''  const provinceId = normalizeProvinceId(payload.provinceId);
  const existingGroup = groupFor(player, type.id, provinceId, false, now);
  if (existingGroup) processGroup(world, player, existingGroup, now);
  if (!Number.isSafeInteger((existingGroup?.count ?? 0) + quantity)) return result(false, '建筑数量超出系统可表示范围');
  const totalCost =''')
part = part.replace('  const provinceId = normalizeProvinceId(payload.provinceId);\n  player.credits', '  player.credits')
part = part.replace('  group.count += quantity;', '''  const previousCount = group.count;
  const rate = commitCommercialStaffing(group, now);
  group.count += quantity;
  group.staffingRateBps = commercialExpansionStaffingRate(rate, previousCount, group.count);''')
s = s[:a] + part + s[b:]
s = s.replace('  group.enabled = true;\n  if (hasCommercialCycle(group))', '''  processGroup(world, player, group, now);
  if (!group.enabled) commitCommercialStaffing(group, now);
  group.enabled = true;
  if (hasCommercialCycle(group))''')
s = s.replace('  group.enabled = false;\n  if (hasCommercialCycle(group))', '''  processGroup(world, player, group, now);
  if (group.enabled) commitCommercialStaffing(group, now);
  group.enabled = false;
  if (hasCommercialCycle(group))''')
p.write_text(s)
p = Path('server/src/commercial-building-deadline.js')
s = "import { hasCommercialCycle } from '../../shared/commercial-staffing.js';\n" + p.read_text()
s = s.replace('if (Number(group?.pendingRevenue || 0) <= 0) continue;', 'if (!hasCommercialCycle(group)) continue;')
p.write_text(s)

edit('src/types/commercial.ts', '  pendingRevenue?: number;', '''  cycleActive?: boolean;
  staffingRateBps?: number;
  staffingUpdatedAt?: number;
  staffingBatchCarryBps?: number;
  pendingStaffingRateBps?: number;
  pendingEffectiveCount?: number;
  pendingRevenue?: number;''')

p = Path('src/pages/production/ProductionFacilityDetail.tsx')
s = "import { BuildingStaffingProgress } from '../../components/buildings/BuildingStaffingProgress';\n" + p.read_text()
a = s.index('  return (', s.index('export function FacilityStaffingSummary('))
b = s.index('\nexport function recipeVariantsForType', a)
s = s[:a] + '''  return <BuildingStaffingProgress name={type.name} percent={currentPercent}
    directionLabel={directionLabel} description={description} />;
}
''' + s[b:]
p.write_text(s)
p = Path('src/components/commercial/CommercialBuildingDetail.tsx')
s = "import { CommercialStaffingSummary } from './CommercialStaffingSummary';\nimport { projectCommercialStaffingRate } from '../../../shared/commercial-staffing.js';\n" + p.read_text()
s = s.replace('  const profit = commercialProfitPerMinute(type);', '  const liveNow = useNow(now);\n  const staffingRate = projectCommercialStaffingRate(group, liveNow);\n  const profit = commercialProfitPerMinute(type);')
s = s.replace('commercialSettlementPresentation(group, type, markets)', 'commercialSettlementPresentation(group, type, markets, liveNow)')
s = s.replace("            {group.status === 'error' ?", '            <CommercialStaffingSummary group={group} name={type.name} now={now} />\n' + "            {group.status === 'error' ?")
s = s.replace('          <DataRow label={settlement.label}', '''          <DataRow label={settlement.locked ? '本周期等效营业数量' : '预计等效营业数量'}
            value={settlement.effectiveCount === null ? '—' : <CompactNumber value={settlement.effectiveCount} />} />
          <DataRow label={settlement.label}''')
s = s.replace('          <DataRow label="集群额定利润／分钟"', '''          <DataRow label="当前满员率预计利润／分钟" value={money(staffingRate === null ? null : profit * group.count * staffingRate / 10_000)} />
          <DataRow label="集群额定利润／分钟"''')
s = s.replace('下一周期按全部建筑和当前州官方价预估', '下一周期按当前满员率、整数等效经营量和当前州官方价预估')
s = s.replace('单座稳定利润／分钟', '单座满员额定利润／分钟')
p.write_text(s)
for path in ['src/pages/CommercePage.tsx', 'src/pages/GlobalBuildingsPage.tsx', 'src/pages/GlobalCommercialBuildingPage.tsx']:
    p = Path(path)
    s = p.read_text().replace('单座稳定利润', '单座满员额定利润')
    p.write_text(s)

# Existing fixtures retain their previous full staffing meaning; new tests cover partial/unknown.
p = Path('tests/browser/runtime-harness.tsx')
s = p.read_text()
a = s.index('function CommerceHarness(')
b = s.index('\nconst runtimeView =', a)
part = s[a:b].replace("commercialTypeId: type.id, provinceId: '110000',", "commercialTypeId: type.id, provinceId: '110000',\n      staffingRateBps: 10000, staffingUpdatedAt: fixtureNow, staffingBatchCarryBps: 0,")
part = part.replace('pendingRevenue: index === 0 ? 101.25', 'pendingEffectiveCount: index === 0 ? 2 : undefined,\n      pendingStaffingRateBps: index === 0 ? 10000 : undefined,\n      pendingRevenue: index === 0 ? 101.25')
s = s[:a] + part + s[b:]
p.write_text(s)
p = Path('tests/dt/commercial-auto-operation.test.ts')
s = p.read_text().replace("enabled: true, status: 'running',", "enabled: true, status: 'running', staffingRateBps: 10000, staffingUpdatedAt: 0, staffingBatchCarryBps: 0,")
p.write_text(s)

# Move structural checks to the real shared owner instead of deleting assertions.
for p in Path('scripts').glob('verify-*.mjs'):
    s = p.read_text()
    if 'facility-staffing-track' not in s: continue
    s = s.replace("read('src/pages/production/ProductionFacilityDetail.tsx')", "(read('src/pages/production/ProductionFacilityDetail.tsx') + read('src/components/buildings/BuildingStaffingProgress.tsx'))")
    p.write_text(s)
