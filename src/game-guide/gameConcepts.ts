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
  'factory-auto-operation': {
    label: '自动经营',
    description: '开启后，系统会按本工厂当前生产配置与原料保障周期派生自动采购和出售；玩家不需要逐商品维护策略。',
  },
  'input-coverage': {
    label: '原料保障',
    description: '除当前生产周期已预定的原料外，再保留指定数量完整生产周期所需的本地原料。',
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
