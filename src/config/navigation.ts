export const navigationItems = [
  { id: 'home', label: '概览', icon: '⌂' },
  { id: 'market', label: '市场', icon: '↕' },
  { id: 'production', label: '生产', icon: '⚙' },
  { id: 'assets', label: '资金', icon: '◫' },
  { id: 'leaderboard', label: '排行', icon: '♛' },
  { id: 'settings', label: '设置', icon: '⚙' },
] as const;

export type TabId = (typeof navigationItems)[number]['id'];