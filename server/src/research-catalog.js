import { resolveProductDisplayNames } from './product-catalog.js';

// Research eras describe knowledge, independently of building complexity.
export const RESEARCH_CATALOG_VERSION = 3;
// Retained for legacy imports and paid snapshots.
export const RESEARCH_DURATION_MS = 6 * 60 * 60_000;
export const RESEARCH_DURATION_BY_STAGE = Object.freeze({
  C1: 0, C2: 30 * 60_000, C3: 60 * 60_000, C4: 2 * 60 * 60_000,
  C5: 4 * 60 * 60_000, C6: 6 * 60 * 60_000, C7: 8 * 60 * 60_000,
});

const rawTechnologies = [
  {
    id: 'basic-crops', name: '基础种植', branch: 'agriculture', stage: 'C1', rank: 1, cost: 0,
    durationMs: RESEARCH_DURATION_BY_STAGE.C1, initial: true,
    prerequisiteTechnologyIds: [], unlockFacilityTypeIds: ["farm","orchard"],
    unlockCommercialTypeIds: [], operationProductIds: [],
    description: '掌握基础农作物与果树种植。',
  },
  {
    id: 'basic-livestock', name: '基础养殖', branch: 'agriculture', stage: 'C1', rank: 1, cost: 0,
    durationMs: RESEARCH_DURATION_BY_STAGE.C1, initial: true,
    prerequisiteTechnologyIds: [], unlockFacilityTypeIds: ["ranch","fishery"],
    unlockCommercialTypeIds: [], operationProductIds: [],
    description: '掌握基础畜牧与渔业生产。',
  },
  {
    id: 'basic-commerce', name: '基础商贸', branch: 'commerce', stage: 'C1', rank: 1, cost: 0,
    durationMs: RESEARCH_DURATION_BY_STAGE.C1, initial: true,
    prerequisiteTechnologyIds: [], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: ["convenience-store","fresh-market"], operationProductIds: [],
    description: '通过市场采购商品，开展社区零售与生鲜经营。',
  },
  {
    id: 'industrial-tools', name: '采掘与制材工具', branch: 'machinery', stage: 'C2', rank: 2, cost: 100,
    durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ["basic-crops"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: [], operationProductIds: ["tools"],
    description: '将钻具和锯具流水线用于矿业与制材。',
  },
  {
    id: 'scientific-agriculture', name: '科学农牧', branch: 'agriculture', stage: 'C2', rank: 2, cost: 450,
    durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ["basic-crops","basic-livestock"], unlockFacilityTypeIds: ["mill","feed-factory"],
    unlockCommercialTypeIds: [], operationProductIds: ["feed"],
    description: '建立粮食加工、饲料生产与标准化饲养体系。',
  },
  {
    id: 'powered-forestry', name: '林业工具与动力', branch: 'machinery', stage: 'C2', rank: 2, cost: 100,
    durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ["basic-crops"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: [], operationProductIds: ["tools","industrial-fuel"],
    description: '利用锯具与动力设备提高采伐效率。',
  },
  {
    id: 'resource-survey', name: '林矿勘探', branch: 'materials', stage: 'C2', rank: 2, cost: 300,
    durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ["basic-crops"], unlockFacilityTypeIds: ["logging-camp","mine"],
    unlockCommercialTypeIds: [], operationProductIds: [],
    description: '识别并开发林木与金属矿藏。',
  },
  {
    id: 'processing-tools', name: '粮饲加工工具', branch: 'machinery', stage: 'C2', rank: 2, cost: 100,
    durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ["basic-crops"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: [], operationProductIds: ["tools"],
    description: '将工具用于辊式粮食加工和饲料配料。',
  },
  {
    id: 'petroleum-survey', name: '石油勘探', branch: 'materials', stage: 'C2', rank: 2, cost: 150,
    durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ["basic-crops"], unlockFacilityTypeIds: ["oil-field"],
    unlockCommercialTypeIds: [], operationProductIds: [],
    description: '识别油藏并建立基础石油开采能力。',
  },
  {
    id: 'powered-production', name: '农用工具', branch: 'machinery', stage: 'C2', rank: 2, cost: 150,
    durationMs: RESEARCH_DURATION_BY_STAGE.C2,
    prerequisiteTechnologyIds: ["basic-crops"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: [], operationProductIds: ["tools"],
    description: '将工具用于农田耕作与果树修枝；工具可以直接采购。',
  },
  {
    id: 'pulp-paper-industry', name: '制浆造纸', branch: 'materials', stage: 'C3', rank: 3, cost: 900,
    durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ["resource-survey"], unlockFacilityTypeIds: ["pulp-mill","paper-mill"],
    unlockCommercialTypeIds: [], operationProductIds: [],
    description: '建立制浆与造纸生产体系。',
  },
  {
    id: 'food-processing', name: '食品加工工业', branch: 'agriculture', stage: 'C3', rank: 3, cost: 1200,
    durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ["scientific-agriculture"], unlockFacilityTypeIds: ["food-factory","beverage-factory"],
    unlockCommercialTypeIds: [], operationProductIds: [],
    description: '建立规模化食品、预制餐与饮料生产体系。',
  },
  {
    id: 'textile-industry', name: '纺织工业', branch: 'materials', stage: 'C3', rank: 3, cost: 1300,
    durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ["scientific-agriculture"], unlockFacilityTypeIds: ["textile-mill","garment-factory"],
    unlockCommercialTypeIds: [], operationProductIds: [],
    description: '建立从纤维加工到成衣制造的纺织体系。',
  },
  {
    id: 'veterinary-science', name: '养殖药剂应用', branch: 'materials', stage: 'C3', rank: 3, cost: 350,
    durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ["basic-livestock"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: [], operationProductIds: ["veterinary-medicine"],
    description: '将兽药用于畜牧和水产精养。',
  },
  {
    id: 'wood-industry', name: '制材与木作', branch: 'materials', stage: 'C3', rank: 3, cost: 900,
    durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ["resource-survey"], unlockFacilityTypeIds: ["sawmill","furniture-factory"],
    unlockCommercialTypeIds: [], operationProductIds: [],
    description: '建立木材加工与家具制造体系。',
  },
  {
    id: 'applied-chemistry', name: '精准施肥', branch: 'materials', stage: 'C3', rank: 3, cost: 400,
    durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ["powered-production"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: [], operationProductIds: ["fertilizer"],
    description: '将化肥用于农田与果园的精准施肥；无需自建化工厂。',
  },
  {
    id: 'extraction-chemistry', name: '采掘化学', branch: 'materials', stage: 'C3', rank: 3, cost: 350,
    durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ["industrial-tools"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: [], operationProductIds: ["industrial-chemicals"],
    description: '将{product:industrial-chemicals}用于爆破开采和化学驱油。',
  },
  {
    id: 'metallurgical-engineering', name: '冶金与金属加工', branch: 'materials', stage: 'C3', rank: 3, cost: 1600,
    durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ["resource-survey"], unlockFacilityTypeIds: ["steelworks","tool-workshop"],
    unlockCommercialTypeIds: [], operationProductIds: [],
    description: '掌握金属冶炼与标准化工具制造。',
  },
  {
    id: 'urban-commerce', name: '城市商业', branch: 'commerce', stage: 'C3', rank: 3, cost: 900,
    durationMs: RESEARCH_DURATION_BY_STAGE.C3,
    prerequisiteTechnologyIds: ["basic-commerce"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: ["restaurant","clothing-store"], operationProductIds: [],
    description: '掌握城市餐饮与服装零售经营，无需自行制造所售商品。',
  },
  {
    id: 'mechanized-petroleum', name: '石油强化钻采', branch: 'machinery', stage: 'C4', rank: 4, cost: 175,
    durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ["extraction-chemistry"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: [], operationProductIds: ["machinery","industrial-chemicals"],
    description: '利用机械增产和动力钻采提高油田吞吐。',
  },
  {
    id: 'mechanized-extraction', name: '林矿机械化', branch: 'machinery', stage: 'C4', rank: 4, cost: 175,
    durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ["powered-forestry","extraction-chemistry"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: [], operationProductIds: ["machinery","industrial-fuel"],
    description: '建立机械化采伐与采矿作业能力。',
  },
  {
    id: 'mechanized-sawmilling', name: '机械连续制材', branch: 'machinery', stage: 'C4', rank: 4, cost: 175,
    durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ["industrial-tools"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: [], operationProductIds: ["machinery","industrial-fuel"],
    description: '建立机械制材和动力连续制材能力。',
  },
  {
    id: 'mechanized-production', name: '种植机械化', branch: 'machinery', stage: 'C4', rank: 4, cost: 250,
    durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ["powered-production"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: [], operationProductIds: ["tractor"],
    description: '将农业机械用于农田耕作和果园管理；设备可以直接采购。',
  },
  {
    id: 'mechanized-milling', name: '粮食机械加工', branch: 'machinery', stage: 'C4', rank: 4, cost: 175,
    durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ["processing-tools"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: [], operationProductIds: ["machinery","industrial-fuel"],
    description: '建立粮食机械加工和连续化加工能力。',
  },
  {
    id: 'agrochemical-engineering', name: '农牧化工', branch: 'materials', stage: 'C4', rank: 4, cost: 1400,
    durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ["applied-chemistry","veterinary-science"], unlockFacilityTypeIds: ["fertilizer-factory","veterinary-medicine-factory"],
    unlockCommercialTypeIds: [], operationProductIds: [],
    description: '建立肥料与兽药制造能力。',
  },
  {
    id: 'chemical-engineering', name: '石油化工', branch: 'materials', stage: 'C4', rank: 4, cost: 1400,
    durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ["extraction-chemistry"], unlockFacilityTypeIds: ["refinery"],
    unlockCommercialTypeIds: [], operationProductIds: [],
    description: '建立石油炼化与{product:industrial-chemicals}制造能力。',
  },
  {
    id: 'mechanized-livestock', name: '养殖机械化', branch: 'machinery', stage: 'C4', rank: 4, cost: 175,
    durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ["scientific-agriculture"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: [], operationProductIds: ["machinery"],
    description: '以机械化畜牧和循环水系统提高养殖效率。',
  },
  {
    id: 'mechanized-feed', name: '饲料机械混配', branch: 'machinery', stage: 'C4', rank: 4, cost: 175,
    durationMs: RESEARCH_DURATION_BY_STAGE.C4,
    prerequisiteTechnologyIds: ["processing-tools"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: [], operationProductIds: ["machinery","industrial-fuel"],
    description: '建立机械混配和动力连续混配能力。',
  },
  {
    id: 'machine-engineering', name: '机械工程', branch: 'machinery', stage: 'C5', rank: 5, cost: 3800,
    durationMs: RESEARCH_DURATION_BY_STAGE.C5,
    prerequisiteTechnologyIds: ["metallurgical-engineering","mechanized-production"], unlockFacilityTypeIds: ["machine-factory","tractor-factory"],
    unlockCommercialTypeIds: [], operationProductIds: [],
    description: '建立通用机械及农业机械制造体系。',
  },
  {
    id: 'department-retail', name: '百货经营', branch: 'commerce', stage: 'C5', rank: 5, cost: 2400,
    durationMs: RESEARCH_DURATION_BY_STAGE.C5,
    prerequisiteTechnologyIds: ["urban-commerce"], unlockFacilityTypeIds: [],
    unlockCommercialTypeIds: ["furniture-showroom","appliance-store"], operationProductIds: [],
    description: '建立家具与家电等耐用品的专业零售经营能力。',
  },
  {
    id: 'electronic-engineering', name: '电子工程', branch: 'machinery', stage: 'C6', rank: 6, cost: 4200,
    durationMs: RESEARCH_DURATION_BY_STAGE.C6,
    prerequisiteTechnologyIds: ["machine-engineering","chemical-engineering"], unlockFacilityTypeIds: ["electronics-factory"],
    unlockCommercialTypeIds: [], operationProductIds: [],
    description: '建立电子元件与电子产品制造能力。',
  },
  {
    id: 'electrical-integration', name: '机电集成', branch: 'machinery', stage: 'C7', rank: 7, cost: 6200,
    durationMs: RESEARCH_DURATION_BY_STAGE.C7,
    prerequisiteTechnologyIds: ["electronic-engineering"], unlockFacilityTypeIds: ["appliance-factory"],
    unlockCommercialTypeIds: [], operationProductIds: [],
    description: '综合机械与电子工程技术制造家用电器。',
  },
];

export const RESEARCH_TECHNOLOGY_CATALOG = Object.freeze(rawTechnologies.map((technology) => Object.freeze({
  ...technology,
  description: resolveProductDisplayNames(technology.description),
  prerequisiteTechnologyIds: Object.freeze(technology.prerequisiteTechnologyIds),
  unlockFacilityTypeIds: Object.freeze(technology.unlockFacilityTypeIds),
  unlockCommercialTypeIds: Object.freeze(technology.unlockCommercialTypeIds),
  operationProductIds: Object.freeze(technology.operationProductIds),
})));
export const RESEARCH_TECHNOLOGY_BY_ID = new Map(RESEARCH_TECHNOLOGY_CATALOG.map((t) => [t.id, t]));
export const RESEARCH_TECHNOLOGY_ID_BY_FACILITY = new Map(RESEARCH_TECHNOLOGY_CATALOG.flatMap((t) => t.unlockFacilityTypeIds.map((id) => [id, t.id])));
const commercialTechnologyIds = new Map(RESEARCH_TECHNOLOGY_CATALOG.flatMap((t) => t.unlockCommercialTypeIds.map((id) => [id, t.id])));
export const RESEARCH_LEVEL_CATALOG = Object.freeze(Array.from({ length: 7 }, (_, index) => {
  const rank = index + 1;
  return Object.freeze({ id: `C${rank}`, rank,
    cost: RESEARCH_TECHNOLOGY_CATALOG.filter((t) => t.rank === rank).reduce((sum, t) => sum + t.cost, 0),
    durationMs: RESEARCH_DURATION_BY_STAGE[`C${rank}`] });
}));
export function researchTechnologyFor(value) { return RESEARCH_TECHNOLOGY_BY_ID.get(String(value || '')) || null; }
export function researchTechnologyForFacility(id) { return researchTechnologyFor(RESEARCH_TECHNOLOGY_ID_BY_FACILITY.get(String(id || ''))); }
export function researchTechnologyForCommercial(id) { return researchTechnologyFor(commercialTechnologyIds.get(String(id || ''))); }
export function researchTechnologiesForStage(stage) { return RESEARCH_TECHNOLOGY_CATALOG.filter((t) => t.stage === stage); }
export function researchTechnologyClosure(ids) {
  const result = new Set();
  const include = (id) => {
    const technology = researchTechnologyFor(id);
    if (!technology || result.has(id)) return;
    result.add(id);
    for (const prerequisite of technology.prerequisiteTechnologyIds) include(prerequisite);
  };
  for (const id of ids || []) include(id);
  return [...result];
}
