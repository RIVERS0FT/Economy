import { PRODUCT_CATALOG } from './industry-catalog.js';
import { ECONOMIC_EVENT_TEMPLATES, processRegionalEconomicEvents } from './economic-events.js';
import { inventoryForProvince, PROVINCE_CATALOG } from './provinces.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PROJECT_DURATION_MS = 3 * DAY_MS;
const PROJECT_RETENTION_MS = 3 * DAY_MS;
const PROJECT_VISIBLE_AHEAD_MS = 7 * DAY_MS;
const PROJECT_BASE_GOAL_VALUE = 4_000;
const PROJECT_BASE_REWARD_POINTS = 1_200;
const PROJECT_AUDIT_LIMIT = 240;

const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const TEMPLATE_BY_ID = new Map(ECONOMIC_EVENT_TEMPLATES.map((template) => [template.id, template]));
const PROVINCE_BY_ID = new Map(PROVINCE_CATALOG.map((province) => [province.id, province]));

function projectScale(world) {
  const playerCount = Math.max(1, Object.keys(world?.players || {}).length);
  return Math.min(5, Math.max(1, Math.sqrt(playerCount)));
}

function ensureProjectState(world) {
  world.marketDemand ||= {};
  const previous = world.marketDemand.publicProjects;
  const state = previous && typeof previous === 'object' ? previous : {};
  state.modelVersion = 1;
  state.projects = Array.isArray(state.projects) ? state.projects : [];
  state.audit = Array.isArray(state.audit) ? state.audit : [];
  world.marketDemand.publicProjects = state;
  return state;
}

function recordAudit(state, entry) {
  state.audit.push(entry);
  if (state.audit.length > PROJECT_AUDIT_LIMIT) state.audit.splice(0, state.audit.length - PROJECT_AUDIT_LIMIT);
}

function createGoals(template, scale) {
  return [...template.productIds].slice(0, 3).flatMap((productId) => {
    const product = PRODUCT_BY_ID.get(productId);
    if (!product) return [];
    const targetQuantity = Math.max(50, Math.ceil(PROJECT_BASE_GOAL_VALUE * scale / Math.max(0.01, Number(product.basePrice || 1))));
    return [{
      productId,
      targetQuantity,
      contributedQuantity: 0,
      completedAt: null,
    }];
  });
}

function createProject(world, event, now) {
  const template = TEMPLATE_BY_ID.get(String(event.templateId));
  if (!template) return null;
  const scale = projectScale(world);
  const goals = createGoals(template, scale);
  if (goals.length < 2) return null;
  const province = PROVINCE_BY_ID.get(String(event.provinceId));
  return {
    id: `public-project-${event.id}`,
    sourceEventId: String(event.id),
    sourceTemplateId: String(event.templateId),
    provinceId: String(event.provinceId),
    provinceName: province?.name || String(event.provinceName || event.provinceId),
    title: `${province?.shortName || province?.name || event.provinceId}公共保障项目`,
    description: `围绕“${template.title}”集中保障本州关键商品。商品必须先进入项目州本地仓库，再由玩家主动提交。`,
    announcedAt: Number(event.announcedAt ?? event.startsAt),
    startsAt: Number(event.startsAt),
    endsAt: Number(event.startsAt) + PROJECT_DURATION_MS,
    status: Number(now) < Number(event.startsAt) ? 'upcoming' : 'active',
    createdAt: Number(now),
    completedAt: null,
    goals,
    rewardPoolPoints: Math.max(PROJECT_BASE_REWARD_POINTS, Math.round(PROJECT_BASE_REWARD_POINTS * scale)),
    contributions: {},
    rewardClaims: {},
    totalContributionValue: 0,
    totalContributedQuantity: 0,
  };
}

function projectCompletedGoalCount(project) {
  return (project.goals || []).filter((goal) => Number(goal.contributedQuantity || 0) >= Number(goal.targetQuantity || 0)).length;
}

function updateProjectStatus(project, now) {
  const completedGoalCount = projectCompletedGoalCount(project);
  if (completedGoalCount >= (project.goals || []).length && (project.goals || []).length > 0) {
    if (project.status !== 'completed') project.completedAt = Number(now);
    project.status = 'completed';
    return;
  }
  if (Number(now) >= Number(project.endsAt)) {
    project.status = 'expired';
    return;
  }
  project.status = Number(now) < Number(project.startsAt) ? 'upcoming' : 'active';
}

export function processPublicProjects(world, now = Date.now()) {
  const normalizedNow = Math.max(0, Number(now) || 0);
  const regional = processRegionalEconomicEvents(world, normalizedNow);
  const state = ensureProjectState(world);
  for (const event of regional.events || []) {
    if (Number(event.slotIndex) % 3 !== 0) continue;
    if (state.projects.some((project) => project.sourceEventId === event.id)) continue;
    const project = createProject(world, event, normalizedNow);
    if (!project) continue;
    state.projects.push(project);
    recordAudit(state, {
      action: 'created',
      projectId: project.id,
      provinceId: project.provinceId,
      createdAt: normalizedNow,
    });
  }
  for (const project of state.projects) {
    const previousStatus = project.status;
    updateProjectStatus(project, normalizedNow);
    if (previousStatus !== project.status && (project.status === 'completed' || project.status === 'expired')) {
      recordAudit(state, {
        action: project.status,
        projectId: project.id,
        provinceId: project.provinceId,
        createdAt: normalizedNow,
      });
    }
  }
  state.projects = state.projects
    .filter((project) => Number(project.endsAt) > normalizedNow - PROJECT_RETENTION_MS)
    .sort((left, right) => Number(left.startsAt) - Number(right.startsAt) || String(left.id).localeCompare(String(right.id)));
  state.lastProcessedAt = normalizedNow;
  return state;
}

function projectForAction(world, projectId, now) {
  const state = processPublicProjects(world, now);
  const project = state.projects.find((candidate) => candidate.id === String(projectId || ''));
  return { state, project };
}

function contributionFor(project, userId) {
  const key = String(userId);
  project.contributions ||= {};
  project.contributions[key] ||= { value: 0, quantity: 0, products: {}, lastContributedAt: null };
  return project.contributions[key];
}

function rewardSummary(project, userId) {
  const completedGoalCount = projectCompletedGoalCount(project);
  const unlockedPool = Math.floor(Number(project.rewardPoolPoints || 0) * completedGoalCount / Math.max(1, (project.goals || []).length));
  const contribution = project.contributions?.[String(userId)] || { value: 0 };
  const totalValue = Math.max(0, Number(project.totalContributionValue || 0));
  const entitled = totalValue > 0
    ? Math.floor(unlockedPool * Math.max(0, Number(contribution.value || 0)) / totalValue)
    : 0;
  const claimed = Math.max(0, Math.floor(Number(project.rewardClaims?.[String(userId)] || 0)));
  const stable = project.status === 'completed' || project.status === 'expired';
  return {
    unlockedPool,
    entitled,
    claimed,
    claimable: stable ? Math.max(0, entitled - claimed) : 0,
  };
}

function applyContribution(world, user, payload, now) {
  const { state, project } = projectForAction(world, payload.projectId, now);
  if (!project) return { ok: false, message: '公共项目不存在或已结束' };
  if (project.status !== 'active') return { ok: false, message: project.status === 'upcoming' ? '公共项目尚未开始' : '公共项目已结束' };
  const productId = String(payload.productId || '');
  const goal = project.goals.find((candidate) => candidate.productId === productId);
  if (!goal) return { ok: false, message: '该商品不属于当前公共项目需求' };
  const requested = Math.floor(Number(payload.quantity));
  if (!Number.isSafeInteger(requested) || requested < 1) return { ok: false, message: '提交数量必须是不低于 1 的整数' };
  const remaining = Math.max(0, Number(goal.targetQuantity || 0) - Number(goal.contributedQuantity || 0));
  if (remaining < 1) return { ok: false, message: '该商品的项目目标已经完成' };
  const accepted = Math.min(requested, remaining);
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态不存在' };
  const inventory = inventoryForProvince(player, productId, project.provinceId);
  if (Number(inventory.available || 0) < accepted) {
    return { ok: false, message: `项目只接受${project.provinceName}本地非冻结库存，当前可提交数量不足` };
  }
  inventory.available -= accepted;
  goal.contributedQuantity = Number(goal.contributedQuantity || 0) + accepted;
  if (goal.contributedQuantity >= goal.targetQuantity && !goal.completedAt) goal.completedAt = Number(now);
  const product = PRODUCT_BY_ID.get(productId);
  const value = accepted * Math.max(0.01, Number(product?.basePrice || 1));
  const contribution = contributionFor(project, user.id);
  contribution.value = Number(contribution.value || 0) + value;
  contribution.quantity = Number(contribution.quantity || 0) + accepted;
  contribution.products[productId] = Number(contribution.products[productId] || 0) + accepted;
  contribution.lastContributedAt = Number(now);
  project.totalContributionValue = Number(project.totalContributionValue || 0) + value;
  project.totalContributedQuantity = Number(project.totalContributedQuantity || 0) + accepted;
  player.stats ||= {};
  player.stats.publicProjectGoodsContributed = Math.max(0, Number(player.stats.publicProjectGoodsContributed || 0)) + accepted;
  const previousStatus = project.status;
  updateProjectStatus(project, now);
  recordAudit(state, {
    action: 'contribution',
    projectId: project.id,
    provinceId: project.provinceId,
    userId: Number(user.id),
    productId,
    quantity: accepted,
    createdAt: Number(now),
  });
  if (previousStatus !== 'completed' && project.status === 'completed') {
    recordAudit(state, {
      action: 'completed',
      projectId: project.id,
      provinceId: project.provinceId,
      createdAt: Number(now),
    });
  }
  return {
    ok: true,
    message: accepted < requested
      ? `已提交 ${accepted} 件，剩余请求因项目目标已完成而未扣除`
      : `已向${project.provinceName}公共项目提交 ${accepted} 件商品`,
  };
}

function applyClaim(world, user, payload, now) {
  const { state, project } = projectForAction(world, payload.projectId, now);
  if (!project) return { ok: false, message: '公共项目不存在或已结束' };
  updateProjectStatus(project, now);
  const reward = rewardSummary(project, user.id);
  if (project.status !== 'completed' && project.status !== 'expired') return { ok: false, message: '公共项目尚未结算' };
  if (reward.claimable < 1) return { ok: false, message: '当前没有可领取的项目贡献积分' };
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态不存在' };
  player.stats ||= {};
  player.stats.publicProjectPoints = Math.max(0, Math.floor(Number(player.stats.publicProjectPoints || 0))) + reward.claimable;
  project.rewardClaims ||= {};
  project.rewardClaims[String(user.id)] = reward.claimed + reward.claimable;
  recordAudit(state, {
    action: 'reward',
    projectId: project.id,
    provinceId: project.provinceId,
    userId: Number(user.id),
    points: reward.claimable,
    createdAt: Number(now),
  });
  return { ok: true, message: `已领取 ${reward.claimable} 项目贡献积分` };
}

export function applyPublicProjectAction(world, user, action, payload = {}, now = Date.now()) {
  if (action === 'contributePublicProject') return applyContribution(world, user, payload, now);
  if (action === 'claimPublicProjectReward') return applyClaim(world, user, payload, now);
  return { ok: false, message: '公共项目操作不存在' };
}

export function createPublicProjectClientState(world, userId, now = Date.now()) {
  const normalizedNow = Math.max(0, Number(now) || 0);
  const projects = world?.marketDemand?.publicProjects?.projects || [];
  return {
    version: 1,
    points: Math.max(0, Math.floor(Number(world?.players?.[String(userId)]?.stats?.publicProjectPoints || 0))),
    projects: projects
      .filter((project) => (
        Number(project.announcedAt ?? project.startsAt) <= normalizedNow
        && Number(project.endsAt) > normalizedNow - PROJECT_RETENTION_MS
        && Number(project.startsAt) <= normalizedNow + PROJECT_VISIBLE_AHEAD_MS
      ))
      .map((project) => {
        const status = projectCompletedGoalCount(project) >= (project.goals || []).length && (project.goals || []).length > 0
          ? 'completed'
          : normalizedNow >= Number(project.endsAt)
            ? 'expired'
            : normalizedNow < Number(project.startsAt) ? 'upcoming' : 'active';
        const reward = rewardSummary({ ...project, status }, userId);
        const mine = project.contributions?.[String(userId)] || { value: 0, quantity: 0, products: {} };
        const leaderboard = Object.entries(project.contributions || {})
          .map(([id, contribution]) => ({
            userId: Number(id),
            playerName: String(world?.players?.[String(id)]?.playerName || `玩家 ${id}`),
            contributionValue: Math.max(0, Number(contribution?.value || 0)),
          }))
          .sort((left, right) => right.contributionValue - left.contributionValue || left.userId - right.userId)
          .slice(0, 10)
          .map((entry, index) => ({
            rank: index + 1,
            playerName: entry.playerName,
            contributionValue: entry.contributionValue,
            isCurrentPlayer: entry.userId === Number(userId),
          }));
        return {
          id: project.id,
          sourceEventId: project.sourceEventId,
          provinceId: project.provinceId,
          provinceName: project.provinceName,
          title: project.title,
          description: project.description,
          announcedAt: Number(project.announcedAt ?? project.startsAt),
          startsAt: project.startsAt,
          endsAt: project.endsAt,
          status,
          goals: (project.goals || []).map((goal) => ({ ...goal })),
          rewardPoolPoints: project.rewardPoolPoints,
          completedGoalCount: projectCompletedGoalCount(project),
          totalContributionValue: Number(project.totalContributionValue || 0),
          totalContributedQuantity: Number(project.totalContributedQuantity || 0),
          myContributionValue: Number(mine.value || 0),
          myContributedQuantity: Number(mine.quantity || 0),
          myProducts: { ...(mine.products || {}) },
          rewardPointsClaimed: reward.claimed,
          rewardPointsClaimable: reward.claimable,
          leaderboard,
        };
      }),
  };
}
