from pathlib import Path


def replace(path, old, new, count=1):
    file = Path(path)
    text = file.read_text()
    actual = text.count(old)
    if actual != count:
        raise RuntimeError(f'{path}: expected {count} matches, got {actual}: {old[:100]!r}')
    file.write_text(text.replace(old, new))


p = 'server/src/transport.js'
replace(p, '  TRANSPORT_MODE_POLICY,\n', '  TRANSPORT_MODE_POLICY,\n  createTransportCyclePolicy,\n  transportCyclePolicyForShipment,\n  transportPolicyDurationMs,\n')
replace(p, '''  const definition = TRANSPORT_MODES[mode];
  if (!definition) return null;
  const distance = Math.max(0, Number(distanceKm) || 0);
  return Math.max(1_000, Math.round(distance * TRANSPORT_BASE_SECONDS_PER_KM * definition.timeFactor * 1000));''', '''  if (!TRANSPORT_MODES[mode]) return null;
  return transportPolicyDurationMs(createTransportCyclePolicy(mode), Math.max(0, Number(distanceKm) || 0));''')
replace(p, '  const durationMs = transportDurationMs(shipment.mode, distanceKm);', '  const policy = transportCyclePolicyForShipment(shipment);\n  const durationMs = transportPolicyDurationMs(policy, distanceKm);')
replace(p, '''  const definition = TRANSPORT_MODES[shipment.mode];
  if (!shipment.legacyCycle && definition) {''', '''  if (!shipment.legacyCycle) {''')
replace(p, 'roundFuel(Number(shipment.fuelConsumed || 0) + distanceKm * definition.fuelPerKm)', 'roundFuel(Number(shipment.fuelConsumed || 0) + distanceKm * policy.fuelPerKm)')
replace(p, '    nodeCycleVersion: 1,\n', '    nodeCycleVersion: 1,\n    policySnapshot: createTransportCyclePolicy(route.mode),\n')
replace(p, '  if (nextLoad > Number(TRANSPORT_MODES[route.mode]?.capacity || 0)) {', '  if (nextLoad > transportCyclePolicyForShipment(shipment).capacity) {')
replace(p, '''    shipment.status = 'arrived';
    shipment.arrivedAt = now;''', '''    shipment.status = 'arrived';
    if (!shipment.legacyCycle) shipment.fuelConsumed = Number(shipment.fuelPurchased || 0);
    shipment.arrivedAt = now;''')
replace(p, '    migrateLegacyShipment(world, shipment);\n', '    migrateLegacyShipment(world, shipment);\n    if (!shipment.policySnapshot) shipment.policySnapshot = transportCyclePolicyForShipment(shipment);\n')
replace(p, '        cycleDistanceKm: Number(shipment.cycleDistanceKm || 0),\n', '''        cycleDistanceKm: Number(shipment.cycleDistanceKm || 0),
        policySnapshot: transportCyclePolicyForShipment(shipment),
        deliveredQuantity: (shipment.cycleManifest || []).reduce((sum, entry) => sum + Math.max(0, Number(entry.quantity || 0)), 0),
''')
replace(p, '    totals.set(productId, (totals.get(productId) || 0) + quantity);', '    const total = (totals.get(productId) || 0) + quantity;\n    if (!Number.isSafeInteger(total)) return null;\n    totals.set(productId, total);')

p = 'src/utils/provinceLogistics.ts'
replace(p, '  TRANSPORT_MODE_POLICY,\n', '  TRANSPORT_MODE_POLICY,\n  createTransportCyclePolicy,\n  transportPolicyDurationMs,\n')
replace(p, '  timeFactor: number;\n', '  timeFactor: number;\n  departureSeconds: number;\n')
replace(p, '  return Math.max(1_000, Math.round(distanceKm * TRANSPORT_BASE_SECONDS_PER_KM * definition.timeFactor * 1000));', '  return transportPolicyDurationMs(createTransportCyclePolicy(mode), Math.max(0, distanceKm));')
replace(p, 'export function formatTransportDuration(ms: number) {', '''export function transportCycleDurationMs(
  route: TransportRouteStopsInput,
  mode: TransportModeId,
  provinceById: Map<string, ProvinceDefinition>,
) {
  const stops = transportTraversalStopIds(route);
  if (stops.length < 2) return 0;
  let durationMs = 0;
  for (let index = 0; index < stops.length - 1; index += 1) {
    const from = provinceById.get(stops[index]);
    const to = provinceById.get(stops[index + 1]);
    if (!from || !to) return 0;
    durationMs += transportDurationMs(mode, provinceDistanceKm(from, to));
  }
  return durationMs;
}

export function formatTransportDuration(ms: number) {''')
replace('src/types.ts', 'export interface TransportShipment {\n', '''export interface TransportShipment {
  /** Server-owned parameters locked when this cycle starts. */
  policySnapshot?: import('../shared/transport-policy.js').TransportCyclePolicy;
  deliveredQuantity?: number;
''')

p = 'docs/WAREHOUSE_EXPANSION_DESIGN.md'
replace(p, '''| 模式 | 一次性建线费 | 周期运输费 | 燃料消耗 | 最大载荷 | 时间 |
|---|---:|---:|---:|---:|---:|
| 公路 | 固定 100 + 0.02/公里 | 0.02/公里 | 0.01/公里 | 100 | 1.0 × 基准 |
| 铁路 | 固定 1,000 + 0.15/公里 | 0.17/公里 | 0.08/公里 | 2,000 | 2.0 × 基准 |
| 航空 | 固定 500 + 0.05/公里 | 0.27/公里 | 0.13/公里 | 500 | 0.25 × 基准 |''', '''| 模式 | 一次性建线费 | 周期运输费 | 燃料消耗 | 最大载荷 | 每 1,000 公里行驶时间 | 每段起运时间 |
|---|---:|---:|---:|---:|---:|---:|
| 公路 | 固定 80 + 0.02/公里 | 0.015/公里 | 0.005/公里 | 200 | 60 秒 | 10 秒 |
| 铁路 | 固定 1,200 + 0.10/公里 | 0.02/公里 | 0.01/公里 | 2,000 | 90 秒 | 45 秒 |
| 航空 | 固定 2,400 + 0.08/公里 | 0.22/公里 | 0.08/公里 | 300 | 15 秒 | 15 秒 |''')
replace(p, '基准时间为 `60 秒 / 1,000 公里`。', '基准时间为 `60 秒 / 1,000 公里`；单段耗时等于该方式固定起运时间加距离对应的行驶时间，完整周期累加全部运输段。固定起运时间只影响耗时，不产生额外装卸费或每站收费。公路面向低投入小批量，铁路面向低单位成本大宗，航空以高建线投入和高单位运费换快速周转；这些定位不构成距离或商品准入限制。')
replace(p, '车辆可以空车运行到后续节点取货，是否值得启动由在线客户端规划器判断，服务器不计算收益或最优货物。', '''车辆可以空车运行到后续节点取货，是否值得启动由在线客户端规划器判断，服务器不计算收益或最优货物。

客户端启动前必须预估完整往返或环线，只使用各州真实 `available` 和有效当日 `officialPrice`，不得使用旧盘口、最近成交价或基础价猜测机会。缺少有效官方价或 `nextPriceAt` 已过期时等待行情同步。预估周期会跨过所用报价的下一次日界时等待调价后重算；已付费周期不因价格变化被取消或重新收费。

对已有库存，预计运输增益固定以“当前在来源州卖出”为基准：`Σ(数量 × (卸货州官方价 − 来源州官方价) × 99%) − 整周期费用`；发车要求该增益至少达到 `max(1, 整周期费用 × 20%)`。共享策略维护安全余量；建线投入不重复计入每个周期。该指标是相对本地出售的估计，不是已实现现金利润，也不是买入后转售利润；运输不自动买卖，后者仍需另扣实际采购成本。

整周期预估按州×商品为当前真实库存建立一次共享剩余池，去程与返程重复访问同一州不得重复计入原始库存，模拟卸下的货物不得回填为另一批可再次装运的原始库存。未来产量、未履约合同和冻结库存不得算作货源。没有硬性满载率门槛；正价差或满载本身都不能代替净增益判断。每到节点重新决定本次装卸；已经支付的周期费用是既定支出，不得每站重复扣除或据此把车辆卡在中途。''')
replace(p, '在线客户端根据最新地区库存和州级市场摘要计算本次', '在线客户端只根据最新地区可用库存和有效当日官方价计算本次')
replace(p, '同一往返路线返程再次访问同一州时重新计算，不复用去程决定。', '''同一往返路线返程再次访问同一州时重新计算，不复用去程决定。

在线调度固定优先处理返回起点的最终卸货，再处理其他到站车辆，最后启动新周期；每个优先级内按路线轮转。最终卸货不占新的在途名额。客户端提前跳过资金或在途名额不足的启动意图，同一操作在资金、相关库存、官方价、在途名额和节点世代均未变化时不得连续重试；失败不能阻塞其他路线。一次仅提交一个运输动作，动作期间的权威状态通知合并后继续处理，错误与状态确认有可读反馈，不新增轮询计时器。''')
replace(p, '客户端状态版本保持 40，世界状态版本保持 32；新运行字段继续复用既有 `transportRoutes` / `transportShipments` 顶层语义，不新增世界顶层 segment。', '''每个周期在启动时由服务器持久化运输周期参数快照 `policySnapshot`，锁定容量、每公里费用与燃料、燃料单价、行驶时间和每段起运时间；新参数只作用于新周期。已付费用、历史建线投入和已经确定的当前段截止时间不重算、不追缴。无快照的旧周期按正式兼容参数幂等补齐，旧航空周期继续使用 500 容量和原有计时，不能因新周期容量降为 300 而截断货物或阻塞装卸。客户端提交的快照没有权威性。

新运行字段继续复用既有 `transportRoutes` / `transportShipments` 顶层语义，不新增世界顶层 segment；客户端与世界状态版本以共享协议和存储常量为准，不在运输规则复制版本值。''')

p = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
replace(p, '当前“运输中／节点装卸／等待在线规划”状态和该路线历史。', '''当前运输状态和该路线历史。等待原因细分为无可运库存、收益不足、资金不足、行情未就绪、等待调价和在途名额已满，不统一伪装为等待在线规划。路线卡片增加当前装载率与下一周期预计增益；路线详情的运输结算展示当前周期已付费用、当前载货和已交货数量，历史费用只读取实际支付值。预计增益必须明确标记为下一周期预测，说明通过悬浮框展示，不把估值差写成已实现现金利润。''')
replace(p, '地图创建模式只选择节点顺序与运输方式，不提供单程／往返选择；', '地图创建模式只选择节点顺序与运输方式，不提供单程／往返选择；完成地图选择后，在待保存区域比较同一路线三种方式的建线投入、周期费用、容量、耗时与当前库存下的预计增益及等待原因，允许切换方式后再创建。')

p = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
anchor = '车辆抵达节点后进入 `docked`，不得因离线恢复一次跨越多个未来节点。`transportShipments` 与 `transportRoutes` 一并归入 `player.misc`，运输到站或装卸不得新增第七父分区或错误推进市场分区。'
replace(p, anchor, anchor + '''

运输周期启动事务同时保存服务器构造的 `policySnapshot`，后续段耗时、燃料消耗与节点容量校验必须读取该快照，而不是最新模式参数。客户端不能覆盖快照、费用、距离或截止时间。无快照的存量周期只按共享兼容策略幂等补齐，保持当前段截止时间和历史扣款；投影只返回快照和实际已交货数量，不接收客户端预测利润作为账本。业务取价、发车阈值与旧周期保护唯一引用 `WAREHOUSE_EXPANSION_DESIGN.md`。''')

p = 'scripts/verify-provincial-unlock-transport.mjs'
replace(p, "  '客户端状态版本保持 40，世界状态版本保持 32',\n", "  '运输周期参数快照',\n")
replace(p, "  'setupFixedCost: 100', 'setupFixedCost: 1000', 'setupFixedCost: 500',", "  'setupFixedCost: 80', 'setupFixedCost: 1200', 'setupFixedCost: 2400',")
replace(p, "  'setupCostPerKm: 0.02', 'setupCostPerKm: 0.15', 'setupCostPerKm: 0.05',", "  'setupCostPerKm: 0.02', 'setupCostPerKm: 0.10', 'setupCostPerKm: 0.08',")
replace(p, "  'transportFeePerKm: 0.02', 'transportFeePerKm: 0.17', 'transportFeePerKm: 0.27',", "  'transportFeePerKm: 0.015', 'transportFeePerKm: 0.02', 'transportFeePerKm: 0.22',")
replace(p, "  'fuelPerKm: 0.01', 'fuelPerKm: 0.08', 'fuelPerKm: 0.13',", "  'fuelPerKm: 0.005', 'fuelPerKm: 0.01', 'fuelPerKm: 0.08',")
replace(p, "  'capacity: 100', 'capacity: 2000', 'capacity: 500',", "  'capacity: 200', 'capacity: 2000', 'capacity: 300',")
replace(p, "  'timeFactor: 1.0', 'timeFactor: 2.0', 'timeFactor: 0.25',", "  'timeFactor: 1.0', 'timeFactor: 1.5', 'timeFactor: 0.25',\n  'departureSeconds: 10', 'departureSeconds: 45', 'departureSeconds: 15',\n  'TRANSPORT_POLICY_VERSION = 2',")
replace(p, "  'routeHasFutureOpportunity',\n  'planUnload',\n  'planLoad',", "  'createTransportCoordinator',\n  'transportMaintenanceCandidates',\n  'estimateServerNow',")
replace(p, "  '等待在线规划',\n", "  'TRANSPORT_WAITING_LABELS',\n")

print('Applied transport backend, timing, type, design and verifier edits.')
