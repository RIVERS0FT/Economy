import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);
const replace = (source, from, to, label) => {
  if (!source.includes(from)) throw new Error(`缺少待替换文本: ${label}`);
  return source.replace(from, to);
};

{
  const path = 'docs/MARKET_CHART_LAYOUT_DESIGN.md';
  let source = read(path);
  source = replace(
    source,
    '全局市场商品目录不再承载跨州覆盖条。商品全局详情的地区行情行只显示该地区商品的卖单量、买单量、官方市场价和真实 24h 变化；不得把不同地区订单簿合并为全国买卖盘，也不得从最低／最高成交价推导全国市场价。',
    '全局市场商品目录不再承载跨州覆盖条。商品全局详情的地区行情行只显示该地区商品的今日官方价格、真实 24h 成交量和真实 24h 价格变化；不得把服务器内部人口／储备订单聚合成玩家可见全国盘口，也不得从最低／最高成交价推导全国市场价。',
    'global regional market row',
  );
  source = replace(
    source,
    '地区商品详情顶部只保留商品身份、真实 24h 变化和当前可用库存。市场价、相对基础价偏离／基准偏离、需求满足率、需求参考价／参考价和上轮需求不属于地区详情可见信息；卖单量、买单量与盘口深度继续由目录和五档订单簿表达，冻结库存、发运在途、预计生产速度和预计等效产能分别归仓库或建筑页面。',
    '地区商品详情顶部只保留商品身份、今日官方价格、真实 24h 变化和当前可用库存。相对基础价偏离／基准偏离、需求满足率、需求参考价／参考价和上轮需求不属于地区详情可见信息；玩家商品市场不展示卖单量、买单量或盘口深度，冻结库存、发运在途、预计生产速度和预计等效产能分别归仓库或建筑页面。',
    'regional detail facts',
  );
  source = replace(
    source,
    '地区商品详情不再渲染基本面条或商品基本面卡。顶部身份与两项市场事实必须按市场正文真实容器宽度响应：宽容器保持单行；不大于 `720px` 时商品身份占第一行，24h 变化和可用库存进入第二行并完整位于详情边界内，不得保留被删除字段的空轨道或造成横向溢出。',
    '地区商品详情不再渲染基本面条或商品基本面卡。顶部身份与今日价格、24h 变化、可用库存三项市场事实必须按市场正文真实容器宽度响应：宽容器保持单行；不大于 `720px` 时商品身份占第一行，三项市场事实进入第二行并完整位于详情边界内，不得保留被删除字段的空轨道或造成横向溢出。',
    'regional detail responsive facts',
  );
  source = replace(
    source,
    '页面顺序固定为“身份与精简市场事实 → 近 24h 行情图 → 手动下单与五档盘口 → 本人订单与本地成交”。身份区、行情图、手动交易区和本人订单／成交都直接排列在页面内容区；手动交易区不使用一级卡片底座，但下单控件和订单簿内部操作边界继续保留。地区商品详情不得渲染自动经营执行卡。交易区摘要只显示最近成交和真实 24h 成交量，不重复顶部 24h 变化。',
    '页面顺序固定为“身份与精简市场事实 → 近 24h 行情图 → 当日价即时交易 → 最近成交”。身份区、行情图、即时交易区和最近成交都直接排列在页面内容区；即时交易区不使用一级卡片底座，玩家只调整方向与数量，不显示价格输入、五档盘口、已有订单或撤单。地区商品详情不得渲染自动经营执行卡。交易区摘要固定显示今日价格、今日成交量、真实 24h 成交量和下一北京时间 00:00 调价时间，不重复顶部 24h 变化。',
    'regional detail flow',
  );
  write(path, source);
}

{
  const path = 'docs/UI_DESIGN_SYSTEM.md';
  let source = read(path);
  source = source.replace(
    '- 市场页“我的订单与成交 → 本地成交记录”：`MarketPage.tsx` 的 `.local-trades-scroll-area` 单一双轴 `.virtual-record-table`。',
    '- 市场页“最近成交”：`MarketPage.tsx` 的 `.local-trades-scroll-area` 单一双轴 `.virtual-record-table`。',
  );
  write(path, source);
}

for (const path of [
  'scripts/codex-update-instant-market-layout-design.mjs',
  '.github/workflows/codex-update-instant-market-layout-design.yml',
]) if (existsSync(path)) unlinkSync(path);
