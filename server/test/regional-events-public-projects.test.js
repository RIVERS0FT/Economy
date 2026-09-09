import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  ECONOMIC_EVENT_TEMPLATES,
  REGIONAL_ECONOMIC_EVENT_EPOCH_MS,
  createEconomicCalendarClientState,
  economicEventRegionalProductWeight,
  processRegionalEconomicEvents,
} from '../src/economic-events.js';
import {
  applyPublicProjectAction,
  createPublicProjectClientState,
  processPublicProjects,
} from '../src/public-projects.js';
import { inventoryForProvince, PROVINCE_CATALOG } from '../src/provinces.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const NOW = REGIONAL_ECONOMIC_EVENT_EPOCH_MS + 3 * DAY_MS + HOUR_MS;

function createPlayer(now = NOW) {
  const world = createWorld(now);
  const user = { id: 77_001, email: 'regional-project@example.com', name: '地区项目测试' };
  const player = ensurePlayer(world, user, now);
  return { world, user, player };
}

test('地区动态事件按真实经营足迹选州并只提高目标州对应商品权重', () => {
  const { world, player } = createPlayer();
  const footprintProvinceId = PROVINCE_CATALOG.find((province) => province.id !== player.startingProvinceId)?.id;
  assert.ok(footprintProvinceId);
  inventoryForProvince(player, 'wheat', footprintProvinceId).available = 5;

  const first = processRegionalEconomicEvents(world, NOW);
  const second = processRegionalEconomicEvents(world, NOW + 1);
  assert.equal(first, second);
  const active = first.events.find((event) => NOW >= event.startsAt && NOW < event.endsAt);
  assert.ok(active);
  assert.equal(active.provinceId, footprintProvinceId);
  assert.ok(first.audit.some((entry) => entry.eventId === active.id && entry.action === 'created'));
  const template = ECONOMIC_EVENT_TEMPLATES.find((candidate) => candidate.id === active.templateId);
  assert.ok(template);
  const affectedProductId = template.productIds.find((productId) => (
    economicEventRegionalProductWeight(world, productId, NOW, active.provinceId) > 1
  ));
  assert.ok(affectedProductId);
  const otherProvinceId = PROVINCE_CATALOG.find((province) => province.id !== active.provinceId)?.id;
  assert.ok(otherProvinceId);
  assert.equal(economicEventRegionalProductWeight(world, affectedProductId, NOW, otherProvinceId), 1);
});

test('地区事件和公共项目可以预生成，但公告时间前不得进入玩家状态', () => {
  const early = REGIONAL_ECONOMIC_EVENT_EPOCH_MS + DAY_MS + HOUR_MS;
  const { world, user } = createPlayer(early);
  const regional = processRegionalEconomicEvents(world, early);
  const hiddenEvent = regional.events.find((event) => Number(event.announcedAt) > early);
  assert.ok(hiddenEvent);

  const projectState = processPublicProjects(world, early);
  const hiddenProject = projectState.projects.find((project) => Number(project.announcedAt) > early);
  assert.ok(hiddenProject);

  const calendar = createEconomicCalendarClientState(early, world);
  assert.equal(calendar.events.some((event) => event.id === hiddenEvent.id), false);
  assert.equal(calendar.events.some((event) => event.id === `public-project-event:${hiddenProject.id}`), false);
  const playerProjects = createPublicProjectClientState(world, user.id, early);
  assert.equal(playerProjects.projects.some((project) => project.id === hiddenProject.id), false);
});

test('大型公共项目只扣目标州本地非冻结库存，并按最终贡献领取项目积分', () => {
  const { world, user, player } = createPlayer();
  const state = processPublicProjects(world, NOW);
  const project = state.projects.find((candidate) => candidate.status === 'active');
  assert.ok(project, '当前时段应生成进行中的公共项目');
  assert.ok(project.goals.length >= 2);
  const otherProvinceId = PROVINCE_CATALOG.find((province) => province.id !== project.provinceId)?.id;
  assert.ok(otherProvinceId);

  const firstGoal = project.goals[0];
  const targetInventory = inventoryForProvince(player, firstGoal.productId, project.provinceId);
  const otherInventory = inventoryForProvince(player, firstGoal.productId, otherProvinceId);
  targetInventory.available = 1;
  targetInventory.frozen = 100;
  otherInventory.available = firstGoal.targetQuantity + 100;

  const rejected = applyPublicProjectAction(world, user, 'contributePublicProject', {
    projectId: project.id,
    productId: firstGoal.productId,
    quantity: 2,
  }, NOW);
  assert.equal(rejected.ok, false);
  assert.equal(targetInventory.available, 1);
  assert.equal(targetInventory.frozen, 100);
  assert.equal(otherInventory.available, firstGoal.targetQuantity + 100);

  const creditsBefore = player.credits;
  for (const goal of project.goals) {
    const inventory = inventoryForProvince(player, goal.productId, project.provinceId);
    inventory.available = Math.max(Number(inventory.available || 0), goal.targetQuantity);
    const result = applyPublicProjectAction(world, user, 'contributePublicProject', {
      projectId: project.id,
      productId: goal.productId,
      quantity: goal.targetQuantity,
    }, NOW + 1);
    assert.equal(result.ok, true);
    assert.equal(goal.contributedQuantity, goal.targetQuantity);
  }

  assert.equal(project.status, 'completed');
  assert.equal(player.credits, creditsBefore, '公共项目提交不得直接发放或扣除普通货币');
  assert.ok(Number(player.stats.publicProjectGoodsContributed || 0) > 0);
  const projected = createPublicProjectClientState(world, user.id, NOW + 2);
  const projectedProject = projected.projects.find((candidate) => candidate.id === project.id);
  assert.ok(projectedProject);
  assert.ok(projectedProject.rewardPointsClaimable > 0);
  assert.equal(projectedProject.leaderboard[0]?.isCurrentPlayer, true);

  const claimed = applyPublicProjectAction(world, user, 'claimPublicProjectReward', {
    projectId: project.id,
  }, NOW + 3);
  assert.equal(claimed.ok, true);
  assert.ok(Number(player.stats.publicProjectPoints || 0) > 0);
  assert.equal(player.credits, creditsBefore, '项目贡献奖励只发放项目积分，不发行普通货币');
  const repeated = applyPublicProjectAction(world, user, 'claimPublicProjectReward', {
    projectId: project.id,
  }, NOW + 4);
  assert.equal(repeated.ok, false);
});
