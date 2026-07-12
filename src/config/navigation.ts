export const navigationItems = [
  { id: 'home', label: '概览' },
  { id: 'market', label: '市场' },
  { id: 'production', label: '生产' },
  { id: 'assets', label: '资金' },
  { id: 'leaderboard', label: '排行' },
  { id: 'settings', label: '设置' },
] as const;

export type TabId = (typeof navigationItems)[number]['id'];
