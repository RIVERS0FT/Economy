from pathlib import Path


def replace(path, old, new, count=1):
    file = Path(path)
    text = file.read_text()
    assert text.count(old) == count, f'{path}: {text.count(old)} matches for {old[:80]!r}'
    file.write_text(text.replace(old, new))


p = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
replace(p, '新路线只在常驻战略地图创建，', '新路线只在常驻战略地图选择路径，待保存区域比较运输方式后显式创建，')
replace(p, '创建前的路线只能通过唯一常驻战略地图编辑。', '创建前的路线节点只能通过唯一常驻战略地图编辑；待保存比较区允许切换运输方式，不提供路径表单。')
replace(p, '没有运行周期时显示“等待在线规划”；', '没有运行周期时按本文定义的实际等待原因或可启动状态展示；')
replace(p, '在线客户端常驻协调器在节点停靠后根据当前库存和州级行情计算本次装卸', '在线客户端常驻协调器在节点停靠后根据真实可用库存和有效当日官方价计算本次装卸')
p = 'scripts/verify-provincial-unlock-transport.mjs'
replace(p, '创建前的路线只能通过唯一常驻战略地图编辑', '创建前的路线节点只能通过唯一常驻战略地图编辑')
p = 'docs/WAREHOUSE_EXPANSION_DESIGN.md'
replace(p, '共享策略维护安全余量；建线投入不重复计入每个周期。', '共享策略维护安全余量；建线投入不重复计入每个周期。创建前预览只在资金可运行性检查中先扣除预计建线费，不改写玩家余额。')
p = 'src/transport/TransportEconomics.tsx'
replace(p, "import { transportCyclePolicyForShipment } from '../../shared/transport-policy.js';", "import { TRANSPORT_COST_MARGIN, TRANSPORT_MIN_NET_GAIN, transportCyclePolicyForShipment } from '../../shared/transport-policy.js';")
replace(p, '<span>新周期要求预计增益至少覆盖 1 普通货币与周期费用 20% 中较高者；', '<span>新周期要求预计增益至少达到 {formatCurrency(TRANSPORT_MIN_NET_GAIN)} 与周期费用 {TRANSPORT_COST_MARGIN * 100}% 中的较高者；')
replace(p, '''        const estimate = estimateTransportRoute(game, candidate, now, provinceById);
        const setupCost = transportRouteSetupCost(candidate, mode, provinceById);''', '''        const setupCost = transportRouteSetupCost(candidate, mode, provinceById);
        const creditsAfterSetup = Math.max(0, Math.round((game.credits - setupCost) * 1_000_000) / 1_000_000);
        const estimate = estimateTransportRoute({ ...game, credits: creditsAfterSetup }, candidate, now, provinceById);
        const waitingLabel = game.credits < setupCost ? '建线资金不足' : TRANSPORT_WAITING_LABELS[estimate.reason];''')
replace(p, '''            <StatusTag tone={estimate.reason === 'ready' ? 'info' : 'neutral'}>{TRANSPORT_WAITING_LABELS[estimate.reason]}</StatusTag>''', '''            <StatusTag tone={estimate.reason === 'ready' ? 'info' : 'neutral'}>{waitingLabel}</StatusTag>''')
print('Aligned authoritative waiting rules, shared threshold text and post-setup affordability.')
