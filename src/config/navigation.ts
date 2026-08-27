export const navigationItems = [
  { id: 'home', label: '概览' },
  { id: 'market', label: '市场' },
  { id: 'buildings', label: '建筑' },
  { id: 'transport', label: '运输' },
  { id: 'research', label: '研发' },
  { id: 'auction', label: '拍卖' },
  { id: 'contracts', label: '合同' },
  { id: 'bank', label: '银行' },
  { id: 'leaderboard', label: '排行' },
  { id: 'gem-shop', label: '商店' },
  { id: 'settings', label: '设置' },
] as const;

export type NavigationTabId = (typeof navigationItems)[number]['id'];
export type TabId = NavigationTabId | 'map' | 'province';
