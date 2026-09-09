import type { ExtendedEconomicCalendarState, PublicProjectView } from '../../src/public-projects/types';
import { ECONOMIC_EVENT_TEMPLATE_IDS } from '../../src/economic-events/presentation';

export function createEconomicEventFixture(now: number): ExtendedEconomicCalendarState {
  const titles = ['节庆餐饮季', '蛋白采购季', '家居翻新季', '换季采购期', '日用补库期', '设备更新潮'];
  const events = ECONOMIC_EVENT_TEMPLATE_IDS.map((templateId, index) => ({
    id: `fixture-event-${index}`, templateId, scope: 'global' as const, title: titles[index],
    description: '居民消费需求发生变化，企业可以据此安排生产与运输。'.repeat(8),
    announcedAt: now - 3_600_000, startsAt: now + (index % 2 ? 3_600_000 : -3_600_000),
    endsAt: now + 7_200_000, rampMs: 0, classLabels: ['消费需求'], productIds: ['fruit', 'beverage', 'steel'],
  }));
  const project = {
    id: 'fixture-project', sourceEventId: 'fixture-regional', provinceId: 'US-TX', provinceName: '得克萨斯',
    title: '得克萨斯公共建设项目', description: '公共项目说明', announcedAt: now - 60_000,
    startsAt: now - 30_000, endsAt: now + 7_200_000, status: 'active',
    goals: [{ productId: 'steel', targetQuantity: 100, contributedQuantity: 25, completedAt: null }],
    rewardPoolPoints: 100, completedGoalCount: 0, totalContributionValue: 250, totalContributedQuantity: 25,
    myContributionValue: 100, myContributedQuantity: 10, myProducts: { steel: 10 },
    rewardPointsClaimed: 0, rewardPointsClaimable: 0, leaderboard: [],
  } satisfies PublicProjectView;
  return { version: 2, timeZone: 'Asia/Shanghai', events: [
    ...events,
    { ...events[0], id: 'fixture-regional', scope: 'regional', provinceId: 'US-TX', provinceName: '得克萨斯', title: '得克萨斯节庆餐饮季' },
    { ...events[0], id: 'fixture-unannounced', announcedAt: now + 60_000, startsAt: now + 90_000 },
    { ...events[0], id: 'fixture-ended', title: '已结束的节庆餐饮季', startsAt: now - 120_000, endsAt: now - 1_000 },
  ], publicProjects: { version: 1, points: 0, projects: [project] } };
}
