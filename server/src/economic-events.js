const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const EVENT_SLOT_MS = 3 * DAY_MS;
const EVENT_DURATION_MS = DAY_MS;
const EVENT_RAMP_MS = 30 * 60 * 1000;
const VISIBLE_WINDOW_MS = 7 * DAY_MS;

export const ECONOMIC_EVENT_EPOCH_MS = Date.UTC(2026, 6, 27, 2, 0, 0, 0);

const EVENT_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'festival-catering',
    title: '节庆餐饮季',
    description: '居民在节庆期间增加新鲜食品、饮品和便利餐食的消费比重。',
    classMultipliersBps: Object.freeze({
      food: Object.freeze({ 'fresh-drinks': 13_500, convenience: 12_500 }),
    }),
    productMultipliersBps: Object.freeze({ fruit: 12_000, beverage: 12_000, 'prepared-meal': 12_000 }),
    classLabels: Object.freeze(['新鲜与饮品', '便利食品与糖类']),
    productIds: Object.freeze(['fruit', 'beverage', 'prepared-meal']),
  }),
  Object.freeze({
    id: 'protein-procurement',
    title: '蛋白采购季',
    description: '居民集中补充肉、蛋、奶和鱼类，蛋白质类别的需求份额上升。',
    classMultipliersBps: Object.freeze({ food: Object.freeze({ protein: 13_500 }) }),
    productMultipliersBps: Object.freeze({ meat: 11_500, eggs: 11_500, milk: 11_500, fish: 11_500 }),
    classLabels: Object.freeze(['蛋白质']),
    productIds: Object.freeze(['meat', 'eggs', 'milk', 'fish']),
  }),
  Object.freeze({
    id: 'home-renovation',
    title: '家居翻新季',
    description: '装修、包装与家居更新活动增加，木材、纸浆、木板和家具更受关注。',
    classMultipliersBps: Object.freeze({ household: Object.freeze({ home: 14_000 }) }),
    productMultipliersBps: Object.freeze({ timber: 11_500, lumber: 12_000, pulp: 12_000, furniture: 12_000 }),
    classLabels: Object.freeze(['木材、纸品与家居']),
    productIds: Object.freeze(['timber', 'lumber', 'pulp', 'furniture']),
  }),
  Object.freeze({
    id: 'seasonal-apparel',
    title: '换季采购期',
    description: '穿着维护和换季采购增加，纺织产业链的终端需求份额上升。',
    classMultipliersBps: Object.freeze({ household: Object.freeze({ wear: 14_000 }) }),
    productMultipliersBps: Object.freeze({ cotton: 11_500, wool: 11_500, textile: 11_500, clothing: 11_500 }),
    classLabels: Object.freeze(['穿着与纺织']),
    productIds: Object.freeze(['cotton', 'wool', 'textile', 'clothing']),
  }),
  Object.freeze({
    id: 'daily-restocking',
    title: '日用补库期',
    description: '能源、包装和日用材料进入集中补库阶段，相关商品的选择权重上升。',
    classMultipliersBps: Object.freeze({ household: Object.freeze({ daily: 13_500 }) }),
    productMultipliersBps: Object.freeze({ paper: 11_500, 'crude-oil': 11_500, plastic: 11_500 }),
    classLabels: Object.freeze(['能源、包装与日用消耗']),
    productIds: Object.freeze(['paper', 'crude-oil', 'plastic']),
  }),
  Object.freeze({
    id: 'equipment-renewal',
    title: '设备更新潮',
    description: '建设维修和设备更新活动增加，金属、机械、电子产品和家电更受关注。',
    classMultipliersBps: Object.freeze({ household: Object.freeze({ durables: 13_500 }) }),
    productMultipliersBps: Object.freeze({ steel: 11_500, copper: 11_500, machinery: 12_000, electronics: 12_000, appliance: 12_000 }),
    classLabels: Object.freeze(['金属建设与耐用品']),
    productIds: Object.freeze(['steel', 'copper', 'machinery', 'electronics', 'appliance']),
  }),
]);

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function eventForSlot(slotIndex) {
  const template = EVENT_TEMPLATES[modulo(slotIndex, EVENT_TEMPLATES.length)];
  const startsAt = ECONOMIC_EVENT_EPOCH_MS + slotIndex * EVENT_SLOT_MS;
  return {
    id: `economic-event-${slotIndex}-${template.id}`,
    template,
    startsAt,
    endsAt: startsAt + EVENT_DURATION_MS,
    announcedAt: startsAt - 2 * DAY_MS,
  };
}

function slotIndexAt(now) {
  return Math.floor((Number(now) - ECONOMIC_EVENT_EPOCH_MS) / EVENT_SLOT_MS);
}

function nearbyEvents(now, before = 3, after = 5) {
  const base = slotIndexAt(now);
  const events = [];
  for (let offset = -before; offset <= after; offset += 1) events.push(eventForSlot(base + offset));
  return events;
}

function eventStrength(event, now) {
  if (!event || now < event.startsAt || now >= event.endsAt) return 0;
  const rampIn = Math.min(1, Math.max(0, (now - event.startsAt) / EVENT_RAMP_MS));
  const rampOut = Math.min(1, Math.max(0, (event.endsAt - now) / EVENT_RAMP_MS));
  return Math.min(rampIn, rampOut);
}

function activeEvent(now) {
  return nearbyEvents(now, 1, 1).find((event) => now >= event.startsAt && now < event.endsAt) || null;
}

export function createEconomicCalendarClientState(now = Date.now()) {
  const normalizedNow = Math.max(0, Number(now) || 0);
  const visibleUntil = normalizedNow + VISIBLE_WINDOW_MS;
  const events = nearbyEvents(normalizedNow, 1, 4)
    .filter((event) => event.endsAt > normalizedNow && event.startsAt <= visibleUntil)
    .sort((left, right) => left.startsAt - right.startsAt)
    .map((event) => ({
      id: event.id,
      templateId: event.template.id,
      title: event.template.title,
      description: event.template.description,
      announcedAt: event.announcedAt,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      rampMs: EVENT_RAMP_MS,
      classLabels: [...event.template.classLabels],
      productIds: [...event.template.productIds],
    }));
  return {
    version: 1,
    timeZone: 'Asia/Shanghai',
    visibleUntil,
    events,
  };
}

export function economicEventClassShares(modelId, groupId, baseShares, now = Date.now()) {
  void modelId;
  const event = activeEvent(Number(now));
  const strength = eventStrength(event, Number(now));
  const multipliers = event?.template.classMultipliersBps?.[groupId] || {};
  const entries = Object.entries(baseShares || {});
  if (strength <= 0 || entries.length === 0 || Object.keys(multipliers).length === 0) return { ...(baseShares || {}) };
  const weighted = entries.map(([classId, share]) => {
    const base = Math.max(0, Number(share || 0));
    const targetMultiplier = Math.max(0, Number(multipliers[classId] || 10_000)) / 10_000;
    const multiplier = 1 + (targetMultiplier - 1) * strength;
    return [classId, base * multiplier];
  });
  const total = weighted.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return { ...(baseShares || {}) };
  return Object.fromEntries(weighted.map(([classId, value]) => [classId, value / total]));
}

export function economicEventProductWeight(productId, now = Date.now()) {
  const event = activeEvent(Number(now));
  const strength = eventStrength(event, Number(now));
  if (strength <= 0) return 1;
  const target = Math.max(0, Number(event.template.productMultipliersBps?.[productId] || 10_000)) / 10_000;
  return 1 + (target - 1) * strength;
}

export function nextEconomicEventDeadline(now = Date.now()) {
  const normalizedNow = Math.max(0, Number(now) || 0);
  let next = null;
  for (const event of nearbyEvents(normalizedNow, 4, 6)) {
    for (const candidate of [event.startsAt - VISIBLE_WINDOW_MS, event.startsAt, event.endsAt]) {
      if (candidate <= normalizedNow) continue;
      if (next === null || candidate < next) next = candidate;
    }
  }
  return next;
}
