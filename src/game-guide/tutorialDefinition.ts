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
    description: '前往生产页选择工厂并提交建设。每次重开教程都需要重新操作。',
    actionLabel: '前往建设',
    targetTab: 'production',
  },
  {
    id: 'start-facility',
    title: '启动生产设施',
    description: '选择一组已有工厂并点击启动，教程会记录本轮选择的工厂。',
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
    id: 'place-sell-order',
    title: '挂出商品卖单',
    description: '选择有库存的商品并提交卖单。点击提交后教程立即进入成交步骤。',
    actionLabel: '前往卖出',
    targetTab: 'market',
  },
  {
    id: 'complete-sale',
    title: '完成一次商品出售',
    description: '等待本轮新挂出的商品卖单至少成交一部分。历史订单不会计入。',
    actionLabel: '查看卖单',
    targetTab: 'market',
  },
];

export function tutorialStepDefinition(stepId: TutorialStepId) {
  return TUTORIAL_STEPS.find((step) => step.id === stepId) ?? TUTORIAL_STEPS[0];
}
