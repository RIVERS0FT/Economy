import { resolveProductDisplayNames } from './product-catalog.js';

// Retained only for legacy imports and snapshots, not new research scheduling.
export const RESEARCH_DURATION_MS = 6 * 60 * 60_000;
export const RESEARCH_DURATION_BY_STAGE = Object.freeze({
  C1: 0, C2: 30 * 60_000, C3: 60 * 60_000, C4: 2 * 60 * 60_000,
  C5: 4 * 60 * 60_000, C6: 6 * 60 * 60_000, C7: 8 * 60 * 60_000,
});

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
    id: 'forestry-development', name: '林业开发', stage: 'C2', rank: 2, cost: 300, durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: ['logging-camp'],
    descriptionTemplate: '建立规模化{product:timber}采伐能力。',
  },
  {
    id: 'mineral-exploration', name: '矿产勘探', stage: 'C2', rank: 2, cost: 350, durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: ['mine'],
    description: '建立铁矿与铜矿勘探开采能力。',
  },
  {
    id: 'petroleum-exploration', name: '石油勘探', stage: 'C2', rank: 2, cost: 400, durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: ['oil-field'],
    descriptionTemplate: '建立{product:crude-oil}勘探与开采能力。',
  },
  {
    id: 'grain-processing', name: '粮食加工', stage: 'C2', rank: 2, cost: 300, durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: ['mill'],
    description: '掌握粮食与糖料初级加工。',
  },
  {
    id: 'wood-processing', name: '木材加工', stage: 'C2', rank: 2, cost: 400, durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ['forestry-development'], unlockFacilityTypeIds: ['sawmill'],
    descriptionTemplate: '将原木加工为标准{product:lumber}。',
  },
  {
    id: 'feed-processing', name: '饲料加工', stage: 'C2', rank: 2, cost: 350, durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: ['feed-factory'],
    descriptionTemplate: '生产标准化{product:feed}。',
  },
  {
    id: 'tool-operation', nameTemplate: '{product:tools}作业', stage: 'C2', rank: 2, cost: 300, durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['tools'],
    descriptionTemplate: '掌握在农业、采掘和初级加工中使用工业{product:tools}的作业能力，不提供{product:tools}制造能力。',
  },
  {
    id: 'feed-husbandry', nameTemplate: '{product:feed}饲养', stage: 'C2', rank: 2, cost: 200, durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ['basic-livestock'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['feed'],
    descriptionTemplate: '掌握使用{product:feed}进行标准化养殖的作业能力，不提供饲料生产能力。',
  },
  {
    id: 'pulp-technology', name: '制浆技术', stage: 'C3', rank: 3, cost: 550, durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ['forestry-development'], unlockFacilityTypeIds: ['pulp-mill'],
    descriptionTemplate: '将{product:timber}转化为工业{product:pulp}。',
  },
  {
    id: 'metallurgy', name: '冶金技术', stage: 'C3', rank: 3, cost: 700, durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ['mineral-exploration'], unlockFacilityTypeIds: ['steelworks'],
    descriptionTemplate: '冶炼{product:steel}与{product:copper}。',
  },
  {
    id: 'textile-technology', name: '纺织技术', stage: 'C3', rank: 3, cost: 600, durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ['grain-processing', 'basic-livestock'], unlockFacilityTypeIds: ['textile-mill'],
    description: '建立棉纺与毛纺生产体系。',
  },
  {
    id: 'food-industry', name: '食品工业', stage: 'C3', rank: 3, cost: 550, durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ['grain-processing'], unlockFacilityTypeIds: ['food-factory'],
    descriptionTemplate: '建立规模化{product:food}与{product:prepared-meal}生产。',
  },
  {
    id: 'papermaking', name: '造纸技术', stage: 'C3', rank: 3, cost: 700, durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ['pulp-technology'], unlockFacilityTypeIds: ['paper-mill'],
    descriptionTemplate: '将{product:pulp}加工为终端{product:paper}。',
  },
  {
    id: 'fertilizer-application', nameTemplate: '{product:fertilizer}施用', stage: 'C3', rank: 3, cost: 400, durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['fertilizer'],
    descriptionTemplate: '掌握在农场与果园中使用工业{product:fertilizer}的施用能力，不提供{product:fertilizer}生产能力。',
  },
  {
    id: 'veterinary-application', name: '药剂精养', stage: 'C3', rank: 3, cost: 450, durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ['feed-husbandry'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['veterinary-medicine'],
    descriptionTemplate: '掌握在畜牧与渔业中使用{product:veterinary-medicine}的精养能力，不提供{product:veterinary-medicine}生产能力。',
  },
  {
    id: 'industrial-fuel-operation', name: '工业动力作业', stage: 'C3', rank: 3, cost: 450, durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ['tool-operation'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['industrial-fuel'],
    descriptionTemplate: '掌握将{product:industrial-fuel}用于动力采伐和连续化加工的作业能力，不提供炼油能力。',
  },
  {
    id: 'industrial-chemical-operation', name: '工业化学作业', stage: 'C3', rank: 3, cost: 500, durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ['tool-operation'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['industrial-chemicals'],
    descriptionTemplate: '掌握将{product:industrial-chemicals}用于强化采矿与采油的作业能力，不提供炼化生产能力。',
  },
  {
    id: 'oil-refining', name: '石油炼化', stage: 'C4', rank: 4, cost: 950, durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ['petroleum-exploration'], unlockFacilityTypeIds: ['refinery'],
    descriptionTemplate: '从{product:crude-oil}生产{product:plastic}等基础化工材料。',
  },
  {
    id: 'fertilizer-engineering', name: '化肥工程', stage: 'C4', rank: 4, cost: 1_000, durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ['oil-refining'], unlockFacilityTypeIds: ['fertilizer-factory'],
    descriptionTemplate: '建立工业{product:fertilizer}生产能力。',
  },
  {
    id: 'veterinary-medicine', nameTemplate: '{product:veterinary-medicine}', stage: 'C4', rank: 4, cost: 1_250, durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ['feed-processing', 'fertilizer-engineering'], unlockFacilityTypeIds: ['veterinary-medicine-factory'],
    descriptionTemplate: '生产专业{product:veterinary-medicine}。',
  },
  {
    id: 'beverage-industry', name: '饮料工业', stage: 'C4', rank: 4, cost: 850, durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ['grain-processing', 'basic-livestock'], unlockFacilityTypeIds: ['beverage-factory'],
    descriptionTemplate: '建立乳制与果汁{product:beverage}生产线。',
  },
  {
    id: 'furniture-manufacturing', name: '家具制造', stage: 'C4', rank: 4, cost: 800, durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ['wood-processing'], unlockFacilityTypeIds: ['furniture-factory'],
    descriptionTemplate: '将标准{product:lumber}加工为{product:furniture}。',
  },
  {
    id: 'garment-manufacturing', name: '成衣制造', stage: 'C4', rank: 4, cost: 900, durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ['textile-technology'], unlockFacilityTypeIds: ['garment-factory'],
    descriptionTemplate: '将{product:textile}加工为成衣。',
  },
  {
    id: 'tool-manufacturing', name: '工具制造', stage: 'C4', rank: 4, cost: 1_050, durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ['metallurgy', 'wood-processing'], unlockFacilityTypeIds: ['tool-workshop'],
    descriptionTemplate: '生产工业{product:tools}并奠定机械工业基础。',
  },
  {
    id: 'machinery-operation', name: '机械化作业', stage: 'C4', rank: 4, cost: 700, durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ['tool-operation'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['machinery'],
    descriptionTemplate: '掌握在农业、养殖、采掘与加工中使用通用{product:machinery}的作业能力，不提供{product:machinery}制造能力。',
  },
  {
    id: 'tractor-operation', nameTemplate: '{product:tractor}作业', stage: 'C4', rank: 4, cost: 800, durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ['machinery-operation'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['tractor'],
    descriptionTemplate: '掌握在农场与果园中使用{product:tractor}的农业作业能力，不提供{product:tractor}制造能力。',
  },
  {
    id: 'mechanical-engineering', name: '机械工程', stage: 'C5', rank: 5, cost: 2_500, durationMs: RESEARCH_DURATION_BY_STAGE.C5,
    prerequisiteTechnologyIds: ['tool-manufacturing', 'metallurgy'], unlockFacilityTypeIds: ['machine-factory'],
    descriptionTemplate: '建立通用{product:machinery}制造体系。',
  },
  {
    id: 'agricultural-machinery', name: '农业机械', stage: 'C5', rank: 5, cost: 1_900, durationMs: RESEARCH_DURATION_BY_STAGE.C5,
    prerequisiteTechnologyIds: ['mechanical-engineering', 'fertilizer-engineering'], unlockFacilityTypeIds: ['tractor-factory'],
    descriptionTemplate: '将机械工程应用于{product:tractor}制造。',
  },
  {
    id: 'electronics-engineering', name: '电子工程', stage: 'C6', rank: 6, cost: 4_500, durationMs: RESEARCH_DURATION_BY_STAGE.C6,
    prerequisiteTechnologyIds: ['mechanical-engineering', 'oil-refining', 'metallurgy'], unlockFacilityTypeIds: ['electronics-factory'],
    descriptionTemplate: '建立电子元件与{product:electronics}制造体系。',
  },
  {
    id: 'appliance-engineering', name: '家电工程', stage: 'C7', rank: 7, cost: 7_000, durationMs: RESEARCH_DURATION_BY_STAGE.C7,
    prerequisiteTechnologyIds: ['electronics-engineering', 'mechanical-engineering'], unlockFacilityTypeIds: ['appliance-factory'],
    descriptionTemplate: '综合机械与电子技术生产{product:appliance}。',
  },
];

export const RESEARCH_TECHNOLOGY_CATALOG = Object.freeze(rawTechnologies.map((technology) => {
  const { nameTemplate, descriptionTemplate, ...technologyFields } = technology;
  return Object.freeze({
    ...technologyFields,
    name: resolveProductDisplayNames(nameTemplate || technology.name),
    description: resolveProductDisplayNames(descriptionTemplate || technology.description),
    kind: technology.kind || 'production',
    prerequisiteTechnologyIds: Object.freeze([...technology.prerequisiteTechnologyIds]),
    unlockFacilityTypeIds: Object.freeze([...technology.unlockFacilityTypeIds]),
    operationProductIds: Object.freeze([...(technology.operationProductIds || [])]),
  });
}));

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
      durationMs: RESEARCH_DURATION_BY_STAGE[`C${rank}`],
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
