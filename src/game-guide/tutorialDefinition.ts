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
    id: 'build-facility',
    title: '建设一座工厂',
    description: '前往建筑页选择工厂并成功建设。每次重开教程都需要重新操作。',
    actionLabel: '前往建设',
    targetTab: 'buildings',
  },
  {
    id: 'start-facility',
    title: '启动生产设施',
    description: '选择一组已有工厂并成功启动，教程会记录本轮选择的工厂。',
    actionLabel: '管理工厂',
    targetTab: 'buildings',
  },
  {
    id: 'complete-production',
    title: '完成一次生产',
    description: '等待本轮启动的工厂完成一个新周期。资金、原料和仓库条件必须满足。',
    actionLabel: '查看生产',
    targetTab: 'buildings',
  },
  {
    id: 'set-auto-sell',
    title: '设置工厂自动经营',
    description: '打开已有工厂详情，设置原料保障周期并开启自动经营。自动采购和出售仅在服务器确认周期完成时执行。',
    actionLabel: '设置自动经营',
    targetTab: 'buildings',
  },
  {
    id: 'complete-sale',
    title: '完成一次自动出售',
    description: '保持工厂自动经营开启，等待周期完成后按今日官方价自动出售本地区非冻结商品。冻结商品不会出售。',
    actionLabel: '查看市场',
    targetTab: 'market',
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
