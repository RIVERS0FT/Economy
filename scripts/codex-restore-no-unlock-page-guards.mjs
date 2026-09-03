import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
let source = readFileSync(path, 'utf8');
const anchor = '连续 48 州均为完整经营上下文，不存在地区锁定、只读锁定市场、解锁信息、解锁按钮或按解锁状态裁剪全局列表。概览始终显示官方常住人口以及该玩家在该州的只读经营摘要；市场提供商品目录、今日官方价格、真实成交行情和当日价即时交易写操作；建筑与仓库直接显示本地经营内容；地区商品详情仍不渲染自动经营执行卡，自动经营策略与玩家可见执行解释继续只在地区工厂详情显示。一级市场商品的地区行情列表与一级建筑工厂的地区列表覆盖连续 48 州，并仅按各自业务筛选、排序和数据可用性决定展示。';
const guard = '实现层不得保留仅靠固定 `false` 关闭的 `StartingProvinceOverview` 或等价起始州选择死分支；起始州选择已从玩家流程永久移除，兼容字段不得重新变成入口。战略地图 `UsMainlandMap` 不接受 `unlockedProvinceIds` 或 `locked` 访问状态，州面只能表达当前经营上下文与业务数据，不得恢复锁定州视觉或访问资格。';
if (!source.includes(anchor)) throw new Error('找不到 48 州直接经营设计锚点');
if (!source.includes('实现层不得保留仅靠固定 `false` 关闭的 `StartingProvinceOverview`')) {
  source = source.replace(anchor, `${anchor}\n\n${guard}`);
  writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
}
for (const temp of ['scripts/codex-restore-no-unlock-page-guards.mjs', '.github/workflows/codex-restore-no-unlock-page-guards.yml']) {
  if (existsSync(temp)) unlinkSync(temp);
}
