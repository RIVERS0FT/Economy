import type { TabId } from '../config/navigation';
import type { TutorialStepId } from './tutorialStorage';

export interface TutorialStepDefinition {
  id: TutorialStepId;
  title: string;
  description: string;
  actionLabel: string;
  targetTab: TabId;
}

export const TUTORIAL_STEPS: TutorialStepDefinition[] = [
  {
    id: 'work',
    title: '完成一次工作',
    description: '点击“开始工作”，了解经营失败时的基础资金来源。',
    actionLabel: '查看工作',
    targetTab: 'home',
  },
  {
    id: 'build-facility',
    title: '建设一座工厂',
    description: '前往生产页选择工厂并成功建设。每次重开成长线都需要重新操作。',
    actionLabel: '前往建设',
    targetTab: 'production',
  },
  {
    id: 'start-facility',
    title: '启动生产设施',
    description: '选择一组已有工厂并成功启动，成长线会记录本轮选择的工厂。',
    actionLabel: '管理工厂',
    targetTab: 'production',
  },
  {
    id: 'complete-production',
    title: '完成一次生产',
    description: '等待本轮启动的工厂完成一个新周期。资金、原料和仓库条件必须满足。',
    actionLabel: '查看生产',
    targetTab: 'production',
  },
  {
    id: 'set-auto-sell',
    title: '设置商品自动出售',
    description: '点击仓库中的商品，启用自动出售并设置最低出售价格；最低自由库存可填写 0，生产和合同预定会由系统另外保护。自动出售只在当前客户端在线时生效。',
    actionLabel: '前往仓库',
    targetTab: 'production',
  },
  {
    id: 'complete-sale',
    title: '完成一次自动出售',
    description: '保持客户端在线，等待市场买价达到你设置的最低价并完成一次自动出售。',
    actionLabel: '查看仓库',
    targetTab: 'production',
  },
  {
    id: 'start-research',
    title: '选择产业方向',
    description: '前往研发页，从满足前置条件的产业科技中选择一项并成功开始研发。',
    actionLabel: '前往研发',
    targetTab: 'research',
  },
  {
    id: 'review-contracts',
    title: '了解长期合作',
    description: '查看合同页，了解商品供货、玩家借贷和工厂租赁如何形成长期协作。',
    actionLabel: '查看合同',
    targetTab: 'contracts',
  },
  {
    id: 'make-bank-deposit',
    title: '建立银行存款',
    description: '前往银行成功存入任意正数金额，了解现金与银行存款之间的资产配置。',
    actionLabel: '前往银行',
    targetTab: 'bank',
  },
  {
    id: 'review-leaderboard',
    title: '确定长期目标',
    description: '查看排行榜中的财富、增长、生产和交易四榜，把经营结果转化为长期竞争目标。',
    actionLabel: '查看排行榜',
    targetTab: 'leaderboard',
  },
];

export function tutorialStepDefinition(stepId: TutorialStepId) {
  return TUTORIAL_STEPS.find((step) => step.id === stepId) ?? TUTORIAL_STEPS[0];
}
