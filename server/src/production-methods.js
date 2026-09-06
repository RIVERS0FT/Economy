import { balanceProductionPlan } from './production-balance.js';
import { resolveProductDisplayNames } from './product-catalog.js';

export const PRODUCTION_METHOD_GROUP_ID = 'operation';
export const LEGACY_DEFAULT_PRODUCTION_METHOD_ID = 'standard';

function dedicatedMethod(definition) {
  const { nameTemplate, descriptionTemplate, ...methodFields } = definition;
  return Object.freeze({
    ...methodFields,
    name: resolveProductDisplayNames(nameTemplate || definition.name),
    description: resolveProductDisplayNames(descriptionTemplate || definition.description),
    additionalInputs: Object.freeze((definition.additionalInputs || []).map((item) => Object.freeze({ ...item }))),
    baseInputQuantities: definition.baseInputQuantities
      ? Object.freeze([...definition.baseInputQuantities])
      : undefined,
    requiredTechnologyIds: Object.freeze([...(definition.requiredTechnologyIds || [])]),
  });
}

function balancedMethod(definition) {
  return dedicatedMethod({
    ...definition,
    requiredTechnologyIds: [],
  });
}

const FACILITY_METHOD_BLUEPRINTS = Object.freeze({
  farm: Object.freeze([
    dedicatedMethod({ id: 'open-field-rotation', name: '轮作耕作', iconId: 'field', description: '采用轮作与基础田间管理，不消耗额外生产资料。', tone: 'neutral', outputQuantity: 1 }),
    dedicatedMethod({ id: 'tool-tillage', nameTemplate: '{product:tools}耕作', iconId: 'tool', descriptionTemplate: '每周期整件消耗 1 {product:tools}并提高作物产量。', tone: 'warning', additionalInputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 12, requiredTechnologyIds: ['tool-operation'] }),
    dedicatedMethod({ id: 'precision-fertilization', nameTemplate: '精准{product:fertilizer}作业', iconId: 'fertilizer', descriptionTemplate: '每周期整件消耗 2 {product:fertilizer}并进一步提高产量。', tone: 'success', additionalInputs: [{ productId: 'fertilizer', quantity: 2 }], outputQuantity: 14, requiredTechnologyIds: ['fertilizer-application'] }),
    dedicatedMethod({ id: 'tractor-farming', nameTemplate: '{product:tractor}耕作', iconId: 'tractor', descriptionTemplate: '每周期整件消耗 1 {product:tractor}并获得最高作物产量。', tone: 'accent', additionalInputs: [{ productId: 'tractor', quantity: 1 }], outputQuantity: 16, requiredTechnologyIds: ['tractor-operation'] }),
  ]),
  orchard: Object.freeze([
    dedicatedMethod({ id: 'orchard-care', name: '果园管护', iconId: 'orchard', description: '进行基础修枝与果园管护，不消耗额外生产资料。', tone: 'neutral', outputQuantity: 1 }),
    dedicatedMethod({ id: 'tool-pruning', nameTemplate: '{product:tools}修枝', iconId: 'pruning', descriptionTemplate: '每周期整件消耗 1 {product:tools}并提高{product:fruit}产量。', tone: 'warning', additionalInputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 11, requiredTechnologyIds: ['tool-operation'] }),
    dedicatedMethod({ id: 'precision-fertilization', nameTemplate: '精准{product:fertilizer}作业', iconId: 'fertilizer', descriptionTemplate: '每周期整件消耗 2 {product:fertilizer}并进一步提高产量。', tone: 'success', additionalInputs: [{ productId: 'fertilizer', quantity: 2 }], outputQuantity: 13, requiredTechnologyIds: ['fertilizer-application'] }),
    dedicatedMethod({ id: 'tractor-orchard', nameTemplate: '{product:tractor}果园管理', iconId: 'tractor', descriptionTemplate: '每周期整件消耗 1 {product:tractor}并获得最高{product:fruit}产量。', tone: 'accent', additionalInputs: [{ productId: 'tractor', quantity: 1 }], outputQuantity: 15, requiredTechnologyIds: ['tractor-operation'] }),
  ]),
  ranch: Object.freeze([
    dedicatedMethod({ id: 'pasture-husbandry', name: '牧场放养', iconId: 'pasture', description: '采用牧场放养，不消耗额外生产资料。', tone: 'neutral', outputQuantity: 1 }),
    dedicatedMethod({ id: 'formula-feeding', nameTemplate: '{product:feed}精养', iconId: 'feed', descriptionTemplate: '每周期整件消耗 1 {product:feed}并提高养殖产量。', tone: 'warning', additionalInputs: [{ productId: 'feed', quantity: 1 }], outputQuantity: 4, requiredTechnologyIds: ['feed-husbandry'] }),
    dedicatedMethod({ id: 'veterinary-care', name: '药剂精养', iconId: 'medicine', descriptionTemplate: '每周期整件消耗 1 {product:veterinary-medicine}并进一步提高畜产品产量。', tone: 'success', additionalInputs: [{ productId: 'veterinary-medicine', quantity: 1 }], outputQuantity: 8, requiredTechnologyIds: ['veterinary-application'] }),
    dedicatedMethod({ id: 'mechanized-husbandry', name: '机械化畜牧', iconId: 'livestock-machine', descriptionTemplate: '每周期整件消耗 1 {product:machinery}并获得最高畜产品产量。', tone: 'accent', additionalInputs: [{ productId: 'machinery', quantity: 1 }], outputQuantity: 9, requiredTechnologyIds: ['machinery-operation'] }),
  ]),
  fishery: Object.freeze([
    dedicatedMethod({ id: 'pond-aquaculture', name: '池塘养殖', iconId: 'fish', description: '采用池塘养殖，不消耗额外生产资料。', tone: 'neutral', outputQuantity: 1 }),
    dedicatedMethod({ id: 'formula-feeding', nameTemplate: '{product:feed}精养', iconId: 'feed', descriptionTemplate: '每周期整件消耗 1 {product:feed}并提高养殖产量。', tone: 'warning', additionalInputs: [{ productId: 'feed', quantity: 1 }], outputQuantity: 4, requiredTechnologyIds: ['feed-husbandry'] }),
    dedicatedMethod({ id: 'veterinary-care', name: '药剂精养', iconId: 'medicine', descriptionTemplate: '每周期整件消耗 1 {product:veterinary-medicine}并进一步提高{product:fish}产量。', tone: 'success', additionalInputs: [{ productId: 'veterinary-medicine', quantity: 1 }], outputQuantity: 8, requiredTechnologyIds: ['veterinary-application'] }),
    dedicatedMethod({ id: 'recirculating-aquaculture', name: '循环水养殖', iconId: 'water-cycle', descriptionTemplate: '每周期整件消耗 1 {product:machinery}并获得最高{product:fish}产量。', tone: 'accent', additionalInputs: [{ productId: 'machinery', quantity: 1 }], outputQuantity: 9, requiredTechnologyIds: ['machinery-operation'] }),
  ]),
  'logging-camp': Object.freeze([
    dedicatedMethod({ id: 'selective-logging', name: '择伐作业', iconId: 'forest', descriptionTemplate: '采用择伐作业采集{product:timber}。', tone: 'neutral', outputQuantity: 2, operatingCost: 9 }),
    dedicatedMethod({ id: 'saw-assisted-logging', name: '锯具采伐', iconId: 'saw', descriptionTemplate: '每周期整件消耗 1 {product:tools}，提高{product:timber}采伐量。', tone: 'warning', additionalInputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 4, operatingCost: 6, requiredTechnologyIds: ['tool-operation'] }),
    dedicatedMethod({ id: 'powered-logging', name: '动力采伐', iconId: 'powered-saw', descriptionTemplate: '{product:tools}配合{product:industrial-fuel}形成动力采伐线。', tone: 'success', additionalInputs: [{ productId: 'tools', quantity: 1 }, { productId: 'industrial-fuel', quantity: 1 }], outputQuantity: 5, operatingCost: 5, requiredTechnologyIds: ['tool-operation', 'industrial-fuel-operation'] }),
    dedicatedMethod({ id: 'mechanized-logging', name: '机械化采伐', iconId: 'logging-machine', descriptionTemplate: '{product:machinery}与{product:industrial-fuel}共同驱动最高强度采伐。', tone: 'accent', additionalInputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'industrial-fuel', quantity: 2 }], outputQuantity: 7, operatingCost: 7.95, requiredTechnologyIds: ['machinery-operation', 'industrial-fuel-operation'] }),
  ]),
  mine: Object.freeze([
    dedicatedMethod({ id: 'conventional-mining', name: '常规井采', iconId: 'mine', description: '采用常规矿井开采方式。', tone: 'neutral', outputQuantity: 2, operatingCost: 11 }),
    dedicatedMethod({ id: 'drill-mining', name: '钻具开采', iconId: 'drill', descriptionTemplate: '每周期整件消耗 1 {product:tools}，提高矿石产量。', tone: 'warning', additionalInputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 4, operatingCost: 10, requiredTechnologyIds: ['tool-operation'] }),
    dedicatedMethod({ id: 'blast-mining', name: '爆破开采', iconId: 'blast', descriptionTemplate: '{product:tools}与{product:industrial-chemicals}配合进行强化开采。', tone: 'success', additionalInputs: [{ productId: 'tools', quantity: 1 }, { productId: 'industrial-chemicals', quantity: 1 }], outputQuantity: 5, operatingCost: 9, requiredTechnologyIds: ['tool-operation', 'industrial-chemical-operation'] }),
    dedicatedMethod({ id: 'mechanized-mining', name: '机械化采矿', iconId: 'mining-machine', descriptionTemplate: '{product:machinery}、{product:industrial-chemicals}与{product:industrial-fuel}组成完整机械化矿山。', tone: 'accent', additionalInputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'industrial-chemicals', quantity: 1 }, { productId: 'industrial-fuel', quantity: 1 }], outputQuantity: 6, operatingCost: 6.95, requiredTechnologyIds: ['machinery-operation', 'industrial-chemical-operation', 'industrial-fuel-operation'] }),
  ]),
  'oil-field': Object.freeze([
    dedicatedMethod({ id: 'conventional-extraction', name: '常规抽采', iconId: 'oil-pump', description: '采用常规油井抽采方式。', tone: 'neutral', outputQuantity: 2, operatingCost: 15 }),
    dedicatedMethod({ id: 'chemical-recovery', name: '化学驱油', iconId: 'chemical-pump', descriptionTemplate: '每周期整件消耗 1 {product:industrial-chemicals}提高采收率。', tone: 'warning', additionalInputs: [{ productId: 'industrial-chemicals', quantity: 1 }], outputQuantity: 3, operatingCost: 16, requiredTechnologyIds: ['industrial-chemical-operation'] }),
    dedicatedMethod({ id: 'mechanical-recovery', name: '机械增产钻采', iconId: 'drilling-rig', descriptionTemplate: '{product:machinery}配合{product:industrial-chemicals}进行强化钻采。', tone: 'success', additionalInputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'industrial-chemicals', quantity: 1 }], outputQuantity: 5, operatingCost: 15.45, requiredTechnologyIds: ['machinery-operation', 'industrial-chemical-operation'] }),
    dedicatedMethod({ id: 'powered-drilling', name: '动力机械钻采', iconId: 'powered-rig', descriptionTemplate: '{product:machinery}、{product:industrial-chemicals}与{product:industrial-fuel}组成最高强度钻采体系。', tone: 'accent', additionalInputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'industrial-chemicals', quantity: 1 }, { productId: 'industrial-fuel', quantity: 1 }], outputQuantity: 6, operatingCost: 18.95, requiredTechnologyIds: ['machinery-operation', 'industrial-chemical-operation', 'industrial-fuel-operation'] }),
  ]),
  mill: Object.freeze([
    dedicatedMethod({ id: 'stone-milling', name: '石磨加工', iconId: 'millstone', description: '采用石磨完成基础粮食或糖料加工。', tone: 'neutral', outputQuantity: 1, operatingCost: 8.6 }),
    dedicatedMethod({ id: 'roller-milling', name: '辊式加工', iconId: 'roller', descriptionTemplate: '扩大原料批量并整件消耗{product:tools}进行辊式加工。', tone: 'warning', baseInputQuantities: [4], additionalInputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 2, operatingCost: 5.2, requiredTechnologyIds: ['tool-operation'] }),
    dedicatedMethod({ id: 'mechanical-processing', name: '机械加工', iconId: 'gear', descriptionTemplate: '扩大原料批量并整件消耗{product:machinery}进行加工。', tone: 'success', baseInputQuantities: [6], additionalInputs: [{ productId: 'machinery', quantity: 1 }], outputQuantity: 3, operatingCost: 10.25, requiredTechnologyIds: ['machinery-operation'] }),
    dedicatedMethod({ id: 'continuous-processing', name: '连续化加工', iconId: 'conveyor', descriptionTemplate: '{product:machinery}与{product:industrial-fuel}驱动连续化加工线。', tone: 'accent', baseInputQuantities: [6], additionalInputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'industrial-fuel', quantity: 1 }], outputQuantity: 4, operatingCost: 18.25, requiredTechnologyIds: ['machinery-operation', 'industrial-fuel-operation'] }),
  ]),
  sawmill: Object.freeze([
    dedicatedMethod({ id: 'band-sawing', name: '带锯制材', iconId: 'band-saw', descriptionTemplate: '采用带锯完成基础{product:timber}制材。', tone: 'neutral', outputQuantity: 1, operatingCost: 3 }),
    dedicatedMethod({ id: 'saw-line', name: '锯具流水线', iconId: 'saw-line', descriptionTemplate: '扩大{product:timber}批量并整件消耗{product:tools}形成锯切流水线。', tone: 'warning', baseInputQuantities: [8], additionalInputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 4, operatingCost: 4, requiredTechnologyIds: ['tool-operation'] }),
    dedicatedMethod({ id: 'mechanical-sawmilling', name: '机械制材', iconId: 'gear-saw', descriptionTemplate: '{product:machinery}提高{product:timber}利用率与制材吞吐。', tone: 'success', baseInputQuantities: [7], additionalInputs: [{ productId: 'machinery', quantity: 1 }], outputQuantity: 4, operatingCost: 4.45, requiredTechnologyIds: ['machinery-operation'] }),
    dedicatedMethod({ id: 'continuous-sawmilling', name: '动力连续制材', iconId: 'conveyor-saw', descriptionTemplate: '{product:machinery}与{product:industrial-fuel}驱动连续制材线。', tone: 'accent', baseInputQuantities: [8], additionalInputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'industrial-fuel', quantity: 1 }], outputQuantity: 5, operatingCost: 10.45, requiredTechnologyIds: ['machinery-operation', 'industrial-fuel-operation'] }),
  ]),
  'feed-factory': Object.freeze([
    dedicatedMethod({ id: 'batch-mixing', name: '批次混配', iconId: 'mixer', descriptionTemplate: '采用批次方式完成基础{product:feed}配制。', tone: 'neutral', outputQuantity: 2, operatingCost: 4.9 }),
    dedicatedMethod({ id: 'tool-assisted-mixing', name: '工具辅助配料', iconId: 'tool-mixer', descriptionTemplate: '扩大原料批量并整件消耗{product:tools}辅助配料。', tone: 'warning', baseInputQuantities: [4, 2], additionalInputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 5, operatingCost: 3.6, requiredTechnologyIds: ['tool-operation'] }),
    dedicatedMethod({ id: 'mechanical-mixing', name: '机械混配', iconId: 'gear-mixer', descriptionTemplate: '{product:machinery}完成大批量稳定混配。', tone: 'success', baseInputQuantities: [6, 3], additionalInputs: [{ productId: 'machinery', quantity: 1 }], outputQuantity: 8, operatingCost: 10.75, requiredTechnologyIds: ['machinery-operation'] }),
    dedicatedMethod({ id: 'continuous-mixing', name: '动力连续混配', iconId: 'conveyor-mixer', descriptionTemplate: '{product:machinery}与{product:industrial-fuel}驱动连续混配生产线。', tone: 'accent', baseInputQuantities: [8, 4], additionalInputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'industrial-fuel', quantity: 1 }], outputQuantity: 11, operatingCost: 18.95, requiredTechnologyIds: ['machinery-operation', 'industrial-fuel-operation'] }),
  ]),
  'pulp-mill': Object.freeze([
    balancedMethod({ id: 'mechanical-pulping', name: '机械制浆', iconId: 'pulp', description: '采用机械磨解形成纸浆。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'continuous-pulping', name: '连续制浆', iconId: 'pulp-flow', description: '连续投料并加快制浆批次周转。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'low-temperature-pulping', name: '低温制浆', iconId: 'pulp-cold', description: '延长浸润与磨解周期，降低单周期支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'high-consistency-pulping', name: '高浓制浆', iconId: 'pulp-dense', description: '以高浓浆料组织双倍批次吞吐。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  steelworks: Object.freeze([
    balancedMethod({ id: 'blast-furnace-smelting', name: '高炉冶炼', iconId: 'furnace', description: '按高炉批次完成金属冶炼。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'oxygen-smelting', name: '富氧冶炼', iconId: 'furnace-flame', description: '强化炉内供氧并加快出钢。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'holding-smelting', name: '保温冶炼', iconId: 'furnace-hold', description: '延长炉次并降低单炉支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'continuous-casting', name: '连铸冶炼', iconId: 'steel-flow', description: '衔接冶炼与连铸组织双倍批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  'textile-mill': Object.freeze([
    balancedMethod({ id: 'shuttle-weaving', name: '有梭织造', iconId: 'loom', description: '采用有梭织机完成布匹生产。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'automatic-weaving', name: '自动织造', iconId: 'loom-auto', description: '自动引纬并加快织造周转。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'low-tension-weaving', name: '低张力织造', iconId: 'loom-soft', description: '降低经纱张力并延长稳定织造周期。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'continuous-finishing', name: '连续织整', iconId: 'textile-flow', description: '连续衔接织造与整理的双倍批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  'food-factory': Object.freeze([
    balancedMethod({ id: 'batch-food-processing', name: '批次熟制', iconId: 'food-pot', description: '按批次完成食品熟制。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'continuous-cooking', name: '连续熟制', iconId: 'food-flow', description: '连续进料并加快食品出锅。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'low-temperature-processing', name: '低温加工', iconId: 'food-cold', description: '延长低温加工周期并降低单批支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'automated-packaging', name: '自动包装线', iconId: 'package-line', description: '自动衔接加工和包装的双倍批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  'paper-mill': Object.freeze([
    balancedMethod({ id: 'fourdrinier-papermaking', name: '长网造纸', iconId: 'paper', description: '采用长网纸机完成纸张生产。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'accelerated-dewatering', name: '强化脱水', iconId: 'paper-water', description: '强化网部脱水并加快纸机周转。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'low-temperature-drying', name: '低温干燥', iconId: 'paper-dry', description: '延长干燥周期并降低单批支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'continuous-papermaking', name: '连续造纸', iconId: 'paper-flow', description: '连续组织成形与干燥的双倍批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  refinery: Object.freeze([
    balancedMethod({ id: 'atmospheric-distillation', name: '常压蒸馏', iconId: 'distillation', description: '通过常压蒸馏分离石油组分。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'catalytic-cracking', name: '催化裂化', iconId: 'refinery-catalyst', description: '强化裂化反应并加快装置周转。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'low-pressure-refining', name: '低压精炼', iconId: 'refinery-pressure', description: '延长低压精炼周期并降低单批支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'integrated-refining', name: '联合炼化', iconId: 'refinery-flow', description: '联合装置组织双倍炼化批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  'fertilizer-factory': Object.freeze([
    balancedMethod({ id: 'batch-synthesis', name: '批次合成', iconId: 'reactor', description: '按反应釜批次合成化肥。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'catalytic-synthesis', name: '催化合成', iconId: 'reactor-catalyst', description: '采用催化反应加快合成周转。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'low-pressure-synthesis', name: '低压合成', iconId: 'reactor-pressure', description: '延长低压反应并降低单批支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'continuous-granulation', name: '连续造粒', iconId: 'granulation', description: '连续衔接合成与造粒的双倍批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  'veterinary-medicine-factory': Object.freeze([
    balancedMethod({ id: 'batch-synthesis', name: '批次合成', iconId: 'reactor', description: '按反应釜批次合成养殖药剂。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'aseptic-formulation', name: '无菌配制', iconId: 'medicine', description: '强化无菌配制并加快批次周转。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'low-temperature-reaction', name: '低温反应', iconId: 'medicine-cold', description: '延长低温反应并降低单批支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'continuous-formulation', name: '连续配制', iconId: 'medicine-flow', description: '连续组织反应与配制的双倍批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  'beverage-factory': Object.freeze([
    balancedMethod({ id: 'batch-blending', name: '批次调配', iconId: 'beverage', description: '按配料罐批次完成饮料调配。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'aseptic-filling', name: '无菌灌装', iconId: 'bottle', description: '无菌灌装并加快生产周转。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'cold-blending', name: '冷法调配', iconId: 'beverage-cold', description: '延长冷法调配并降低单批支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'continuous-filling', name: '连续灌装', iconId: 'bottle-line', description: '连续组织调配与灌装的双倍批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  'furniture-factory': Object.freeze([
    balancedMethod({ id: 'craft-woodworking', name: '工艺木作', iconId: 'woodwork', description: '采用工艺木作完成家具生产。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'mechanical-woodworking', name: '机械木作', iconId: 'woodwork-machine', description: '机械加工并加快木作周转。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'precision-cutting', name: '精密裁板', iconId: 'precision-cut', description: '延长精密裁板周期并降低单批支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'furniture-assembly-line', name: '家具装配线', iconId: 'assembly-line', description: '流水组织木作和装配的双倍批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  'garment-factory': Object.freeze([
    balancedMethod({ id: 'cut-and-sew', name: '裁剪缝制', iconId: 'sewing', description: '按裁剪与缝制工序生产服装。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'automatic-cutting', name: '自动裁剪', iconId: 'cutting-auto', description: '自动排料裁剪并加快周转。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'lean-sewing', name: '精益缝制', iconId: 'sewing-lean', description: '延长精益缝制周期并降低单批支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'garment-assembly-line', name: '成衣流水线', iconId: 'assembly-line', description: '流水组织裁剪与缝制的双倍批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  'tool-workshop': Object.freeze([
    balancedMethod({ id: 'forge-working', name: '锻造加工', iconId: 'forge', description: '通过锻造与加工制造工具。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'precision-machining', name: '精密机加', iconId: 'precision-machine', description: '精密机加并加快工序周转。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'controlled-heat-treatment', name: '可控热处理', iconId: 'heat-treatment', description: '延长可控热处理并降低单批支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'automated-machining', name: '自动机加线', iconId: 'robot-arm', description: '自动组织机加的双倍批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  'machine-factory': Object.freeze([
    balancedMethod({ id: 'machining-assembly', name: '机加装配', iconId: 'gear', description: '按机加与装配工序制造机械。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'precision-machining', name: '精密机加', iconId: 'precision-machine', description: '精密机加并加快工序周转。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'cellular-manufacturing', name: '单元制造', iconId: 'factory-cell', description: '延长制造单元节拍并降低单批支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'automated-assembly', name: '自动装配线', iconId: 'robot-arm', description: '自动组织装配的双倍批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  'tractor-factory': Object.freeze([
    balancedMethod({ id: 'chassis-assembly', name: '底盘装配', iconId: 'tractor', description: '按底盘与总成工序制造拖拉机。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'modular-assembly', name: '模块装配', iconId: 'module', description: '模块化装配并加快工序周转。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'cellular-manufacturing', name: '单元制造', iconId: 'factory-cell', description: '延长制造单元节拍并降低单批支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'automated-assembly', name: '自动装配线', iconId: 'robot-arm', description: '自动组织装配的双倍批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  'electronics-factory': Object.freeze([
    balancedMethod({ id: 'board-assembly', name: '板级装联', iconId: 'circuit', description: '按板级装联工序制造电子设备。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'precision-placement', name: '精密贴装', iconId: 'chip-placement', description: '精密贴装并加快工序周转。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'low-temperature-soldering', name: '低温焊接', iconId: 'soldering', description: '延长低温焊接并降低单批支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'cleanroom-production', name: '洁净室生产', iconId: 'cleanroom', description: '洁净环境组织双倍装联批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
  'appliance-factory': Object.freeze([
    balancedMethod({ id: 'unit-assembly', name: '整机装配', iconId: 'appliance', description: '按整机装配工序制造家电。', tone: 'neutral', planKind: 'base' }),
    balancedMethod({ id: 'modular-assembly', name: '模块装配', iconId: 'module', description: '模块化装配并加快工序周转。', tone: 'warning', planKind: 'short-cycle' }),
    balancedMethod({ id: 'cellular-manufacturing', name: '单元制造', iconId: 'factory-cell', description: '延长制造单元节拍并降低单批支出。', tone: 'success', planKind: 'long-cycle' }),
    balancedMethod({ id: 'automated-assembly', name: '自动装配线', iconId: 'robot-arm', description: '自动组织装配的双倍批次。', tone: 'accent', planKind: 'double-batch' }),
  ]),
});

const MONEY_DECIMALS = 2;
const MONEY_SCALE = 10 ** MONEY_DECIMALS;

function cloneItems(items) {
  return (items || []).map((item) => ({
    productId: String(item.productId),
    quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
  }));
}

function productPriceMap(products) {
  return new Map((products || []).map((product) => [product.id, Number(product.basePrice)]));
}

function moneyUnits(value, label = '金额') {
  const numeric = Number(value);
  const units = Math.round(numeric * MONEY_SCALE);
  if (
    !Number.isFinite(numeric)
    || !Number.isSafeInteger(units)
    || Math.abs(numeric - units / MONEY_SCALE) > 1e-9
  ) throw new Error(`${label}必须为最多两位小数的安全数值`);
  return units;
}

function moneyFromUnits(units) {
  return units / MONEY_SCALE;
}

function valueOfItemsUnits(items, prices) {
  return cloneItems(items).reduce(
    (sum, item) => sum + moneyUnits(prices.get(item.productId) || 0, `${item.productId} 参考价`) * item.quantity,
    0,
  );
}

function referenceProfitPerMinute(recipe, prices) {
  const outputValueUnits = valueOfItemsUnits([recipe.output], prices);
  const inputValueUnits = valueOfItemsUnits(recipe.inputs || (recipe.input ? [recipe.input] : []), prices);
  const profitPerCycleUnits = outputValueUnits - inputValueUnits - moneyUnits(recipe.operatingCost, `${recipe.id} 周期成本`);
  const profitNumerator = profitPerCycleUnits * 60_000;
  if (!Number.isSafeInteger(profitNumerator) || profitNumerator % recipe.cycleMs !== 0) {
    throw new Error(`${recipe.id} 无法形成分币精确的参考分钟利润`);
  }
  return moneyFromUnits(profitNumerator / recipe.cycleMs);
}

function variantRecipeId(baseRecipeId, methodId, defaultMethodId) {
  return methodId === defaultMethodId
    ? baseRecipeId
    : `${baseRecipeId}--${methodId}`;
}

function alignedCycleMs(baseCycleMs, expectedProfitPerMinute, mode) {
  const base = Math.max(1_000, Math.floor(Number(baseCycleMs) / 1_000) * 1_000);
  const target = mode === 'short-cycle'
    ? Math.max(1_000, Math.floor(base / 2_000) * 1_000)
    : Math.ceil((base * 3) / 2_000) * 1_000;
  const profit = Math.max(1, Math.floor(Number(expectedProfitPerMinute) || 1));

  if (mode === 'short-cycle') {
    for (let cycleMs = target; cycleMs < base; cycleMs += 1_000) {
      if ((profit * cycleMs) % 60_000 === 0) return cycleMs;
    }
    return base;
  }

  for (let cycleMs = target; cycleMs <= base * 3; cycleMs += 1_000) {
    if ((profit * cycleMs) % 60_000 === 0) return cycleMs;
  }
  return base * 2;
}

function createBalancedPlan(recipe, blueprint, defaultMethodId, prices, expectedProfitPerMinute) {
  const baseInputs = cloneItems(recipe.inputs || (recipe.input ? [recipe.input] : []));
  const baseOutput = {
    productId: String(recipe.output.productId),
    quantity: Math.max(1, Math.floor(Number(recipe.output.quantity) || 1)),
  };
  const baseRecipeId = recipe.id;
  if (blueprint.planKind === 'base') {
    return {
      recipeId: baseRecipeId,
      baseRecipeId,
      productionMethodId: blueprint.id,
      cycleMs: recipe.cycleMs,
      operatingCost: recipe.operatingCost,
      inputs: baseInputs,
      output: baseOutput,
    };
  }

  const scale = blueprint.planKind === 'double-batch' ? 2 : 1;
  const inputs = baseInputs.map((item) => ({ ...item, quantity: item.quantity * scale }));
  const output = { ...baseOutput, quantity: baseOutput.quantity * scale };
  let cycleMs = blueprint.planKind === 'double-batch'
    ? recipe.cycleMs
    : alignedCycleMs(recipe.cycleMs, expectedProfitPerMinute, blueprint.planKind);
  const outputValueUnits = valueOfItemsUnits([output], prices);
  const inputValueUnits = valueOfItemsUnits(inputs, prices);
  const profitPerMinuteUnits = moneyUnits(expectedProfitPerMinute, '参考分钟利润');
  let profitNumerator = profitPerMinuteUnits * cycleMs;
  if (!Number.isSafeInteger(profitNumerator) || profitNumerator % 60_000 !== 0) {
    throw new Error(`${baseRecipeId}/${blueprint.id} 无法形成分币精确的参考利润`);
  }
  let operatingCostUnits = outputValueUnits - inputValueUnits - profitNumerator / 60_000;
  if (blueprint.planKind === 'long-cycle' && operatingCostUnits < 0) {
    const baseOperatingCostUnits = moneyUnits(recipe.operatingCost, '基础周期成本');
    for (let candidateCycleMs = cycleMs - 1_000; candidateCycleMs > recipe.cycleMs; candidateCycleMs -= 1_000) {
      const candidateProfitNumerator = profitPerMinuteUnits * candidateCycleMs;
      if (!Number.isSafeInteger(candidateProfitNumerator) || candidateProfitNumerator % 60_000 !== 0) continue;
      const candidateOperatingCostUnits = outputValueUnits - inputValueUnits - candidateProfitNumerator / 60_000;
      if (
        Number.isSafeInteger(candidateOperatingCostUnits)
        && candidateOperatingCostUnits >= 0
        && candidateOperatingCostUnits < baseOperatingCostUnits
      ) {
        cycleMs = candidateCycleMs;
        profitNumerator = candidateProfitNumerator;
        operatingCostUnits = candidateOperatingCostUnits;
        break;
      }
    }
  }
  if (!Number.isSafeInteger(operatingCostUnits) || operatingCostUnits < 0) {
    throw new Error(`${baseRecipeId}/${blueprint.id} 无法形成非负两位小数周期成本`);
  }
  return {
    recipeId: variantRecipeId(baseRecipeId, blueprint.id, defaultMethodId),
    baseRecipeId,
    productionMethodId: blueprint.id,
    cycleMs,
    operatingCost: moneyFromUnits(operatingCostUnits),
    inputs,
    output,
  };
}

function freezePlan(plan) {
  const inputs = Object.freeze(plan.inputs.map((item) => Object.freeze({ ...item })));
  return Object.freeze({
    ...plan,
    inputs,
    input: inputs.length === 1 ? inputs[0] : null,
    output: Object.freeze({ ...plan.output }),
  });
}

function inputsForDedicatedMethod(recipe, blueprint) {
  const baseInputs = cloneItems(recipe.inputs || (recipe.input ? [recipe.input] : []));
  const normalizedBaseInputs = blueprint.baseInputQuantities
    ? baseInputs.map((item, index) => ({
      ...item,
      quantity: Math.max(0, Math.floor(Number(blueprint.baseInputQuantities[index]) || 0)),
    }))
    : baseInputs;
  if (blueprint.baseInputQuantities && blueprint.baseInputQuantities.length !== baseInputs.length) {
    throw new Error(`${recipe.id}/${blueprint.id} 基础投入数量与配方输入数量不一致`);
  }
  return [...normalizedBaseInputs, ...cloneItems(blueprint.additionalInputs)];
}

function createDedicatedProductionMethodGroups(facility) {
  const blueprints = FACILITY_METHOD_BLUEPRINTS[facility.id];
  if (!blueprints) throw new Error(`${facility.id} 缺少工厂专属作业制度`);
  const defaultMethodId = blueprints[0]?.id;
  const methods = blueprints.map((blueprint, methodIndex) => {
    const plansByRecipeId = Object.freeze(Object.fromEntries(facility.recipes.map((recipe) => [
      recipe.id,
      freezePlan(balanceProductionPlan(facility, blueprint.planKind
        ? createBalancedPlan(
          recipe,
          blueprint,
          defaultMethodId,
          productPriceMap(facility.products),
          referenceProfitPerMinute(recipe, productPriceMap(facility.products)),
        )
        : {
            recipeId: variantRecipeId(recipe.id, blueprint.id, defaultMethodId),
            baseRecipeId: recipe.id,
            productionMethodId: blueprint.id,
            cycleMs: recipe.cycleMs,
            operatingCost: blueprint.operatingCost ?? recipe.operatingCost,
            inputs: inputsForDedicatedMethod(recipe, blueprint),
            output: {
              productId: String(recipe.output.productId),
              quantity: blueprint.outputQuantity ?? recipe.output.quantity,
            },
          }, methodIndex)),
    ])));
    const {
      additionalInputs: _additionalInputs,
      baseInputQuantities: _baseInputQuantities,
      outputQuantity: _outputQuantity,
      operatingCost: _operatingCost,
      planKind: _planKind,
      ...definition
    } = blueprint;
    return Object.freeze({ ...definition, plansByRecipeId });
  });
  return Object.freeze([
    Object.freeze({
      id: PRODUCTION_METHOD_GROUP_ID,
      name: '作业制度',
      defaultMethodId,
      methods: Object.freeze(methods),
    }),
  ]);
}

export function createProductionMethodGroups(facility, products) {
  return createDedicatedProductionMethodGroups({ ...facility, products });
}

export function createProductionMethodRecipes(facility, productionMethodGroups) {
  const baseRecipes = new Map(facility.recipes.map((recipe) => [recipe.id, recipe]));
  const group = productionMethodGroups.find((candidate) => candidate.id === PRODUCTION_METHOD_GROUP_ID)
    || productionMethodGroups[0];
  return Object.freeze(facility.recipes.flatMap((baseRecipe) => (
    group.methods.map((method) => {
      const plan = method.plansByRecipeId[baseRecipe.id];
      return freezePlan({
        ...plan,
        id: plan.recipeId,
        name: baseRecipe.name,
        baseRecipeId: baseRecipe.id,
        productionMethodId: method.id,
      });
    })
  )).filter((recipe) => baseRecipes.has(recipe.baseRecipeId)));
}

export function productionMethodGroupFor(type, groupId = PRODUCTION_METHOD_GROUP_ID) {
  return (type?.productionMethodGroups || []).find((group) => group.id === groupId)
    || type?.productionMethodGroups?.[0];
}

export function baseRecipeIdFor(recipe) {
  return recipe?.baseRecipeId || recipe?.id;
}

export function productionMethodIdFor(recipe) {
  return recipe?.productionMethodId || LEGACY_DEFAULT_PRODUCTION_METHOD_ID;
}

export function recipeVariantFor(type, baseRecipeId, productionMethodId) {
  return (type?.recipes || []).find((recipe) => (
    baseRecipeIdFor(recipe) === baseRecipeId
    && productionMethodIdFor(recipe) === productionMethodId
  ));
}

export function resolveProductionPlan(type, recipeId, selections) {
  const selectedRecipe = (type?.recipes || []).find((candidate) => candidate.id === recipeId)
    || (type?.recipes || []).find((candidate) => candidate.id === type?.defaultRecipeId)
    || type?.recipes?.[0];
  if (!selectedRecipe) return null;
  const baseRecipeId = baseRecipeIdFor(selectedRecipe);
  const group = productionMethodGroupFor(type);
  const candidateMethodId = String(selections?.[group.id] || productionMethodIdFor(selectedRecipe));
  const method = group.methods.find((candidate) => candidate.id === candidateMethodId)
    || group.methods.find((candidate) => candidate.id === group.defaultMethodId)
    || group.methods[0];
  const plan = method?.plansByRecipeId?.[baseRecipeId];
  return plan ? {
    ...plan,
    productionMethodSelections: { [group.id]: method.id },
  } : null;
}
