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
    description: '在当前地区建设一座工厂，开始生产商品。首次建设会尝试自动运行；每次重开教程都需要重新建设。',
    actionLabel: '前往建设',
    targetTab: 'buildings',
  },
  {
    id: 'start-facility',
    title: '确认工厂运行',
    description: '检查本轮建设的工厂。已运行会自动进入下一步；缺料时先采购，手动停工时再开启运行。',
    actionLabel: '管理工厂',
    targetTab: 'buildings',
  },
  {
    id: 'complete-production',
    title: '完成一次生产',
    description: '等待本轮工厂完成一个新周期。商品进入本州仓库，可用于商业建筑经营、合同履约或市场出售。',
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
    description: '现货处理即时缺口，供货合同约定长期交付；商业建筑消耗本州商品获取营业收入。查看合同，了解供货、借贷与工厂租赁。',
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
