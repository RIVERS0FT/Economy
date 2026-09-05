export const GAME_CONCEPTS = {
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
    description: '营业周期完成后，服务器按正利润和可用资金采购本州经营商品并立即冻结。地区自动出售开启时，同时出售本地区非冻结商品。首次缺货需要手动准备，关闭自动经营不取消已投入周期。',
  },
  'commercial-input-coverage': {
    label: '商品保障',
    description: '将 1、2、3 或 5 个尚未扣料周期所需的本州商品冻结到本建筑名下。已经消费的商品不属于库存，其他建筑、合同和拍卖的冻结不能挪用。',
  },
  'commercial-settlement': {
    label: '经营结算',
    description: '服务器在周期开始时锁定已投入商品、商品价值、运营成本和固定利润；完成后返还商品价值与运营成本并发放固定利润。运行中显示锁定值，未运行时仅显示下一周期预估。',
  },
  'factory-auto-operation': {
    label: '自动经营',
    description: '开启后仅在生产周期完成时，按扣除材料、运营成本和卖出手续费后的正利润采购原料并冻结。地区自动出售开启时出售本地区全部非冻结商品，不按基础价设置上下限。',
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
