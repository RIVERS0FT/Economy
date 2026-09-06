export const GAME_CONCEPTS = {
  'transport-trip': {
    label: '每趟运输',
    description: '一趟从起点出发并返回起点。往返路线沿原路返回，环线完整运行一圈；每个设置的停靠站均可重新装卸。',
  },
  'transport-distance': {
    label: '全线距离',
    description: '一趟实际经过的全部运输段距离之和，往返包含返程。计费沿用州中心球面距离；地图公路、铁路折线只用于显示，不以屏幕折线长度计费。',
  },
  'transport-fuel': {
    label: '每趟燃料',
    description: '全线距离乘以运输方式的每公里耗油量，整趟只向上取整一次。从起点可用库存一次性扣除燃料商品，途中不重复扣除、不自动购油。动力燃料不占载荷，作为货物运输的燃料仍占载荷。',
  },
  'transport-node-service': {
    label: '逐站装卸',
    description: '到每个设置的停靠站后先卸货再装货，按最新库存和官方价比较继续携带与换装新货的增益。允许部分换货，返程再次停靠会重新判断；仅经过某地区不自动停靠。',
  },
  'transport-online': {
    label: '在线运输',
    description: '在线客户端负责选货，服务器校验并结算。离线最多完成当前一段，到站停靠，重新上线后继续；已经支付的一趟不会因行情变化重复收费。',
  },
  'transport-route-maintenance': {
    label: '路线维护',
    description: '路线创建后仅可重命名，路径或运输方式调整需要重新创建。运行中可预约本趟完成后删除，先返回并卸完货，再删除且不启动下一趟；删除不退建线费。',
  },
  'production-settlement': {
    label: '生产结算',
    description: '按当前生产方案、有效参与产能与周期状态计算本周期需要消耗的原料、运营成本和完成后写入本地仓库的产出。',
  },
  'production-input': {
    label: '投入',
    description: '工厂每个生产周期需要从当前地区本地仓库实际消耗的原料；显示数量会随有效参与产能同步变化。',
  },
  'production-output': {
    label: '产出',
    description: '工厂完成生产周期后写入当前地区本地仓库的商品；显示数量会随有效参与产能同步变化。',
  },
  'commercial-auto-operation': {
    label: '自动经营',
    description: '开启后，营业周期完成时出售本地区全部非冻结商品，并按正利润和可用资金采购后续经营商品并冻结。首次缺货需要手动准备，关闭自动经营不取消已投入周期。',
  },
  'commercial-input-coverage': {
    label: '商品保障',
    description: '将 1、2、3 或 5 个尚未扣料周期所需的本州商品冻结到本建筑名下。已经消费的商品不属于库存，其他建筑、合同和拍卖的冻结不能挪用。',
  },
  'commercial-settlement': {
    label: '经营结算',
    description: '营业周期开始后，本周期商品消耗、运营成本与营业收入即确定；周期完成时由服务器结算收入。未营业时仅显示下一周期预估。',
  },
  'factory-auto-operation': {
    label: '自动经营',
    description: '开启后，生产周期完成时出售本地区全部非冻结商品，并按扣除材料、运营成本和卖出手续费后的正利润采购原料并冻结。',
  },
  'input-coverage': {
    label: '原料保障',
    description: '按当前配方、数量和满员率，为所选的 1、2、3 或 5 个尚未扣料周期冻结真实原料。冻结商品不参与出售，只能被对应工厂消耗。',
  },
  'local-trades': {
    label: '本地成交',
    description: '当前浏览器为当前地区保存的匿名逐笔成交记录，只用于本地查看，不替代服务器权威资产、订单或银行流水。',
  },
  'demand-satisfaction': {
    label: '需求满足率',
    description: '服务器记录的上一轮直接消费需求中，实际完成成交的需求数量占总需求数量的比例。',
  },
} as const;

export type GameConceptId = keyof typeof GAME_CONCEPTS;

export function gameConceptDefinition(id: GameConceptId) {
  return GAME_CONCEPTS[id];
}
