export const navigationItems = [
  { id: 'home', label: '概览' },
  { id: 'market', label: '市场' },
  { id: 'production', label: '生产' },
  { id: 'assets', label: '资产' },
  { id: 'auction', label: '拍卖' },
  { id: 'contracts', label: '合同' },
  { id: 'leaderboard', label: '排行' },
  { id: 'gem-shop', label: '商店' },
  { id: 'settings', label: '设置' },
] as const;

export type TabId = (typeof navigationItems)[number]['id'];
