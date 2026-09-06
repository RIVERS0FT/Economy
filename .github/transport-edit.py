from pathlib import Path


def replace(path, old, new, count=1):
    file = Path(path)
    text = file.read_text()
    if text.count(old) != count:
        raise RuntimeError(f'{path}: expected {count} matches, got {text.count(old)}: {old[:100]!r}')
    file.write_text(text.replace(old, new))


p = 'src/components/shell/StrategicWorkspace.tsx'
replace(p, "import { useContext, useMemo, useState } from 'react';", "import { useContext, useMemo } from 'react';")
replace(p, '  const [savingRoute, setSavingRoute] = useState(false);\n', '')
replace(p, '  async function createDraftRoute() {\n    if (!routeDraft?.draft || savingRoute) return;', '  async function finishDraftSelection() {\n    if (!routeDraft?.draft) return;')
replace(p, '''    setSavingRoute(true);
    try {
      const result = await model.createTransportRoute({
        sourceProvinceId: draft.sourceProvinceId,
        destinationProvinceId: draft.destinationProvinceId,
        viaProvinceIds: draft.viaProvinceIds,
        mode: draft.mode,
      });
      await model.showResult(result);
      if (result.ok) routeDraft.closeDraft();
      else routeDraft.finishPicking();
    } finally {
      setSavingRoute(false);
    }''', '    routeDraft.finishPicking();')
replace(p, '              disabled={savingRoute}\n', '')
replace(p, 'disabled={savingRoute || draftStops.length < 2 || draftClosed}', 'disabled={draftStops.length < 2 || draftClosed}')
replace(p, 'disabled={savingRoute || draftStops.length === 0}', 'disabled={draftStops.length === 0}')
replace(p, '''onClick={() => void createDraftRoute()} disabled={savingRoute || draftStops.length < 2}>{savingRoute ? '创建中…' : '完成选择'}''', '''onClick={() => void finishDraftSelection()} disabled={draftStops.length < 2}>完成选择''')
replace(p, 'onClick={routeDraft.cancelPicking} disabled={savingRoute}', 'onClick={routeDraft.cancelPicking}')

p = 'src/pages/TransportPage.tsx'
replace(p, "import { formatCurrency } from '../utils/formatters';", """import { formatCurrency } from '../utils/formatters';
import { estimateTransportRoute } from '../transport/transportPlanning.js';
import { TRANSPORT_WAITING_LABELS } from '../transport/transportPlanner.js';
import { TransportForecast, TransportLoad, TransportModeComparison } from '../transport/TransportEconomics';""")
replace(p, "function routeRuntimeLabel(shipment: TransportShipmentView | undefined) {\n  if (!shipment) return '等待在线规划';", "function routeRuntimeLabel(shipment: TransportShipmentView | undefined, waitingReason: keyof typeof TRANSPORT_WAITING_LABELS) {\n  if (!shipment) return TRANSPORT_WAITING_LABELS[waitingReason];")
replace(p, '  const currentLocation = pageNavigation?.currentLocation;', '''  const routeEstimates = useMemo(() => new Map(routes.map((route) => [
    route.id, estimateTransportRoute(game, route, now, provinceById),
  ])), [game, now, provinceById]);

  const currentLocation = pageNavigation?.currentLocation;''')
replace(p, '''          <span><small>燃料费</small><strong>{formatCurrency(Number(shipment.fuelCost || 0))}</strong></span>''', '''          <span><small>燃料费</small><strong>{formatCurrency(Number(shipment.fuelCost || 0))}</strong></span>
          <span><small>已交货数量</small><strong><CompactNumber value={Number(shipment.deliveredQuantity || 0)} /></strong></span>''')
replace(p, '        <div className="transport-shipment-cargo">', '        {active ? <TransportLoad shipment={shipment} /> : null}\n        <div className="transport-shipment-cargo">')
replace(p, '''      <div className="transport-route-editor-actions">
        <Button variant="primary" disabled={Boolean(pendingAction)} onClick={() => void saveRouteDraft()}>创建路线</Button>''', '''      <TransportModeComparison
        game={game} route={routeDraft} now={now} provinceById={provinceById}
        disabled={Boolean(pendingAction)} onSelect={(mode) => setDraft({ ...routeDraft, mode })}
      />
      <div className="transport-route-editor-actions">
        <Button variant="primary" disabled={Boolean(pendingAction)} onClick={() => void saveRouteDraft()}>创建路线</Button>''')
replace(p, '    const cycleCost = cycleCostFor(detailRoute);', '    const cycleCost = cycleCostFor(detailRoute);\n    const detailEstimate = routeEstimates.get(detailRoute.id) ?? estimateTransportRoute(game, detailRoute, now, provinceById);')
replace(p, 'routeRuntimeLabel(activeShipment ?? undefined)', 'routeRuntimeLabel(activeShipment ?? undefined, detailEstimate.reason)')
replace(p, '<small>最大载荷</small><strong><CompactNumber value={routeMode?.capacity ?? 0}', '<small>新周期最大载荷</small><strong><CompactNumber value={routeMode?.capacity ?? 0}')
replace(p, '''            <p className="transport-route-auto-note">起终点相同时按环线运行；''', '''            <TransportForecast estimate={detailEstimate} />
            <p className="transport-route-auto-note">起终点相同时按环线运行；''')
replace(p, '<WidgetHeading title="当前运输" />', '<WidgetHeading title="运输结算" />')
replace(p, '当前没有运行中的运输周期；在线客户端发现可运输机会后会从起点启动新周期。', '当前没有运行中的运输周期；在线客户端仅在完整周期预计增益达到安全余量后启动。')
replace(p, '                  const cycleCost = cycleCostFor(route);', '                  const cycleCost = cycleCostFor(route);\n                  const estimate = routeEstimates.get(route.id) ?? estimateTransportRoute(game, route, now, provinceById);')
replace(p, 'routeRuntimeLabel(activeShipment)', 'routeRuntimeLabel(activeShipment, estimate.reason)')
replace(p, '''                        <span><small>建线投入</small><strong>{formatCurrency(Number(route.setupCost || 0))}</strong></span>
                      </div>''', '''                        <span><small>建线投入</small><strong>{formatCurrency(Number(route.setupCost || 0))}</strong></span>
                        <span><small>下一周期预计增益</small><strong>{estimate.netGain === null ? '待行情同步' : formatCurrency(estimate.netGain)}</strong></span>
                      </div>
                      {activeShipment ? <><TransportLoad shipment={activeShipment} /><span className="transport-route-next-stop">{shipmentProgress(activeShipment)}</span></> : null}''')

p = 'src/styles/transport-page.css'
file = Path(p)
file.write_text(file.read_text() + '''

.transport-forecast,
.transport-mode-comparison,
.transport-mode-option,
.transport-load {
  min-width: 0;
  display: grid;
  gap: var(--space-3);
}

.transport-forecast,
.transport-mode-comparison {
  margin-top: var(--space-4);
}

.transport-mode-comparison {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
}

.transport-mode-option {
  align-content: start;
  border-top: 1px solid var(--color-divider);
  padding-top: var(--space-3);
}

.transport-mode-option .transport-route-summary-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.transport-mode-option > .ui-button {
  width: 100%;
}

.transport-forecast > .ui-status-tag,
.transport-mode-option > .ui-status-tag {
  justify-self: start;
}

.transport-load-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.transport-load-heading > span,
.transport-route-next-stop {
  color: var(--color-text-muted);
}

.transport-load progress {
  display: block;
  width: 100%;
  height: 6px;
  accent-color: var(--color-info);
}

.transport-route-summary-grid strong,
.transport-shipment-meta strong {
  min-width: 0;
  overflow-wrap: anywhere;
}
''')

p = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
replace(p, '并在同一操作条修改运输方式、查看一次性建线费并直接提交创建；', '并在同一操作条修改运输方式、查看一次性建线费；“完成选择”只结束地图选州并返回待保存比较区域，不提交创建、不扣款，只有玩家显式点击“创建路线”才提交权威建线事务；')
replace(p, '地图创建模式按顺序点击已解锁州面追加站点', '地图创建模式按顺序点击州面追加站点')

p = 'tests/browser/transport-map-picking.spec.ts'
replace(p, '''  // The account-free preview rejects all writes, so the failed direct-create
  // attempt preserves the draft in the transport page for a retry instead of
  // pretending a server route was created.''', '''  // Finishing map selection is read-only: the preserved draft allows comparing
  // all three modes before the explicit create action can charge any funds.''')

p = 'server/test/transport-balance.test.js'
replace(p, '  migrateTransportWorld(restored);\n', '  migrateTransportWorld(restored);\n  for (const market of Object.values(restored.markets || {})) market.officialPrice = 9999;\n')
print('Applied transport UI integration and read-only map completion.')
