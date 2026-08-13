export const RESEARCH_DURATION_MS = 6 * 60 * 60_000;

const rawTechnologies = [
  {
    id: 'basic-crops', name: '基础种植', stage: 'C1', rank: 1, cost: 0, durationMs: 0, initial: true,
    prerequisiteTechnologyIds: [], unlockFacilityTypeIds: ['farm', 'orchard'],
    description: '掌握基础农作物与果树种植。',
  },
  {
    id: 'basic-livestock', name: '基础养殖', stage: 'C1', rank: 1, cost: 0, durationMs: 0, initial: true,
    prerequisiteTechnologyIds: [], unlockFacilityTypeIds: ['ranch', 'fishery'],
    description: '掌握基础畜牧与渔业生产。',
  },
  {
    id: 'forestry-development', name: '林业开发', stage: 'C2', rank: 2, cost: 300, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: ['logging-camp'],
    description: '建立规模化木材采伐能力。',
  },
  {
    id: 'mineral-exploration', name: '矿产勘探', stage: 'C2', rank: 2, cost: 350, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: ['mine'],
    description: '建立铁矿与铜矿勘探开采能力。',
  },
  {
    id: 'petroleum-exploration', name: '石油勘探', stage: 'C2', rank: 2, cost: 400, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: ['oil-field'],
    description: '建立原油勘探与开采能力。',
  },
  {
    id: 'grain-processing', name: '粮食加工', stage: 'C2', rank: 2, cost: 300, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: ['mill'],
    description: '掌握粮食与糖料初级加工。',
  },
  {
    id: 'wood-processing', name: '木材加工', stage: 'C2', rank: 2, cost: 400, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['forestry-development'], unlockFacilityTypeIds: ['sawmill'],
    description: '将原木加工为标准木板。',
  },
  {
    id: 'feed-processing', name: '饲料加工', stage: 'C2', rank: 2, cost: 350, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: ['feed-factory'],
    description: '生产标准化配合饲料。',
  },
  {
    id: 'tool-operation', name: '工具作业', stage: 'C2', rank: 2, cost: 300, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['tools'],
    description: '掌握在农业、采掘和初级加工中使用工业工具的作业能力，不提供工具制造能力。',
  },
  {
    id: 'feed-husbandry', name: '饲料饲养', stage: 'C2', rank: 2, cost: 200, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['basic-livestock'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['feed'],
    description: '掌握使用配合饲料进行标准化养殖的作业能力，不提供饲料生产能力。',
  },
  {
    id: 'pulp-technology', name: '制浆技术', stage: 'C3', rank: 3, cost: 550, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['forestry-development'], unlockFacilityTypeIds: ['pulp-mill'],
    description: '将木材转化为工业纸浆。',
  },
  {
    id: 'metallurgy', name: '冶金技术', stage: 'C3', rank: 3, cost: 700, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['mineral-exploration'], unlockFacilityTypeIds: ['steelworks'],
    description: '冶炼钢材与铜材。',
  },
  {
    id: 'textile-technology', name: '纺织技术', stage: 'C3', rank: 3, cost: 600, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['grain-processing', 'basic-livestock'], unlockFacilityTypeIds: ['textile-mill'],
    description: '建立棉纺与毛纺生产体系。',
  },
  {
    id: 'food-industry', name: '食品工业', stage: 'C3', rank: 3, cost: 550, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['grain-processing'], unlockFacilityTypeIds: ['food-factory'],
    description: '建立规模化食品与预制餐生产。',
  },
  {
    id: 'papermaking', name: '造纸技术', stage: 'C3', rank: 3, cost: 700, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['pulp-technology'], unlockFacilityTypeIds: ['paper-mill'],
    description: '将纸浆加工为终端纸品。',
  },
  {
    id: 'fertilizer-application', name: '化肥施用', stage: 'C3', rank: 3, cost: 400, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['fertilizer'],
    description: '掌握在农场与果园中使用工业化肥的施用能力，不提供化肥生产能力。',
  },
  {
    id: 'veterinary-application', name: '药剂精养', stage: 'C3', rank: 3, cost: 450, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['feed-husbandry'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['veterinary-medicine'],
    description: '掌握在畜牧与渔业中使用养殖药剂的精养能力，不提供养殖药剂生产能力。',
  },
  {
    id: 'industrial-fuel-operation', name: '工业动力作业', stage: 'C3', rank: 3, cost: 450, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['tool-operation'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['industrial-fuel'],
    description: '掌握将工业燃料用于动力采伐和连续化加工的作业能力，不提供炼油能力。',
  },
  {
    id: 'industrial-chemical-operation', name: '工业化学作业', stage: 'C3', rank: 3, cost: 500, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['tool-operation'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['industrial-chemicals'],
    description: '掌握将工业化学品用于强化采矿与采油的作业能力，不提供炼化生产能力。',
  },
  {
    id: 'oil-refining', name: '石油炼化', stage: 'C4', rank: 4, cost: 950, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['petroleum-exploration'], unlockFacilityTypeIds: ['refinery'],
    description: '从原油生产塑料等基础化工材料。',
  },
  {
    id: 'fertilizer-engineering', name: '化肥工程', stage: 'C4', rank: 4, cost: 1_000, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['oil-refining'], unlockFacilityTypeIds: ['fertilizer-factory'],
    description: '建立工业化肥生产能力。',
  },
  {
    id: 'veterinary-medicine', name: '养殖药剂', stage: 'C4', rank: 4, cost: 1_250, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['feed-processing', 'fertilizer-engineering'], unlockFacilityTypeIds: ['veterinary-medicine-factory'],
    description: '生产专业养殖药剂。',
  },
  {
    id: 'beverage-industry', name: '饮料工业', stage: 'C4', rank: 4, cost: 850, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['grain-processing', 'basic-livestock'], unlockFacilityTypeIds: ['beverage-factory'],
    description: '建立乳制与果汁饮料生产线。',
  },
  {
    id: 'furniture-manufacturing', name: '家具制造', stage: 'C4', rank: 4, cost: 800, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['wood-processing'], unlockFacilityTypeIds: ['furniture-factory'],
    description: '将标准木板加工为家具。',
  },
  {
    id: 'garment-manufacturing', name: '成衣制造', stage: 'C4', rank: 4, cost: 900, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['textile-technology'], unlockFacilityTypeIds: ['garment-factory'],
    description: '将纺织品加工为成衣。',
  },
  {
    id: 'tool-manufacturing', name: '工具制造', stage: 'C4', rank: 4, cost: 1_050, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['metallurgy', 'wood-processing'], unlockFacilityTypeIds: ['tool-workshop'],
    description: '生产工业工具并奠定机械工业基础。',
  },
  {
    id: 'machinery-operation', name: '机械化作业', stage: 'C4', rank: 4, cost: 700, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['tool-operation'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['machinery'],
    description: '掌握在农业、养殖、采掘与加工中使用通用机械的作业能力，不提供机械制造能力。',
  },
  {
    id: 'tractor-operation', name: '拖拉机作业', stage: 'C4', rank: 4, cost: 800, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['machinery-operation'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['tractor'],
    description: '掌握在农场与果园中使用拖拉机的农业作业能力，不提供拖拉机制造能力。',
  },
  {
    id: 'mechanical-engineering', name: '机械工程', stage: 'C5', rank: 5, cost: 2_500, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['tool-manufacturing', 'metallurgy'], unlockFacilityTypeIds: ['machine-factory'],
    description: '建立通用机械制造体系。',
  },
  {
    id: 'agricultural-machinery', name: '农业机械', stage: 'C5', rank: 5, cost: 1_900, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['mechanical-engineering', 'fertilizer-engineering'], unlockFacilityTypeIds: ['tractor-factory'],
    description: '将机械工程应用于拖拉机制造。',
  },
  {
    id: 'electronics-engineering', name: '电子工程', stage: 'C6', rank: 6, cost: 4_500, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['mechanical-engineering', 'oil-refining', 'metallurgy'], unlockFacilityTypeIds: ['electronics-factory'],
    description: '建立电子元件与电子产品制造体系。',
  },
  {
    id: 'appliance-engineering', name: '家电工程', stage: 'C7', rank: 7, cost: 7_000, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['electronics-engineering', 'mechanical-engineering'], unlockFacilityTypeIds: ['appliance-factory'],
    description: '综合机械与电子技术生产家电。',
  },
];

export const RESEARCH_TECHNOLOGY_CATALOG = Object.freeze(rawTechnologies.map((technology) => Object.freeze({
  ...technology,
  kind: technology.kind || 'production',
  prerequisiteTechnologyIds: Object.freeze([...technology.prerequisiteTechnologyIds]),
  unlockFacilityTypeIds: Object.freeze([...technology.unlockFacilityTypeIds]),
  operationProductIds: Object.freeze([...(technology.operationProductIds || [])]),
})));

export const RESEARCH_TECHNOLOGY_BY_ID = new Map(
  RESEARCH_TECHNOLOGY_CATALOG.map((technology) => [technology.id, technology]),
);

export const RESEARCH_TECHNOLOGY_ID_BY_FACILITY = new Map(
  RESEARCH_TECHNOLOGY_CATALOG.flatMap((technology) => (
    technology.unlockFacilityTypeIds.map((facilityTypeId) => [facilityTypeId, technology.id])
  )),
);

export const RESEARCH_LEVEL_CATALOG = Object.freeze(
  Array.from({ length: 7 }, (_, index) => {
    const rank = index + 1;
    const technologies = RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => technology.rank === rank);
    return Object.freeze({
      id: `C${rank}`,
      rank,
      cost: technologies.reduce((sum, technology) => sum + technology.cost, 0),
      durationMs: RESEARCH_DURATION_MS,
    });
  }),
);

export function researchTechnologyFor(value) {
  return RESEARCH_TECHNOLOGY_BY_ID.get(String(value || '')) || null;
}

export function researchTechnologyForFacility(facilityTypeId) {
  const technologyId = RESEARCH_TECHNOLOGY_ID_BY_FACILITY.get(String(facilityTypeId || ''));
  return technologyId ? researchTechnologyFor(technologyId) : null;
}

export function researchTechnologiesForStage(stage) {
  return RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => technology.stage === stage);
}

export function researchTechnologyClosure(technologyIds) {
  const result = new Set();
  const include = (technologyId) => {
    const technology = researchTechnologyFor(technologyId);
    if (!technology || result.has(technology.id)) return;
    for (const prerequisiteId of technology.prerequisiteTechnologyIds) include(prerequisiteId);
    result.add(technology.id);
  };
  for (const technologyId of technologyIds || []) include(technologyId);
  return [...result];
}
