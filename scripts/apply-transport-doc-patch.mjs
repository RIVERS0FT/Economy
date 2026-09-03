import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOnce(source, pattern, replacement, label) {
  const matches = typeof pattern === 'string'
    ? source.split(pattern).length - 1
    : [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))].length;
  if (matches !== 1) throw new Error(`${label}: expected exactly one match, got ${matches}`);
  return source.replace(pattern, replacement);
}

const pagePath = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
let page = read(pagePath);

page = replaceOnce(
  page,
  /^\| 运输 \| `transport` \| `TransportPage` \|.*$/m,
  '| 运输 | `transport` | `TransportPage` | 只显示跨州运输路线目录；新路线只在常驻战略地图创建，起终点相同自动形成环线、起终点不同自动形成固定往返；`transport-route` 详情显示只读路径／运输方式、周期距离与费用、当前节点循环状态和历史；在线客户端负责节点装卸规划，服务端只做权威校验与单段到站结算 |',
  'page transport table row',
);

page = replaceOnce(
  page,
  /运输页的“增加路线”固定放在页面正文承载面的底部 sticky 操作区[^\n]*完整规则见 3\.1。/,
  '运输页的“增加路线”固定放在页面正文承载面的底部 sticky 操作区，不占用页面标题区，也不随路线列表滚出可视区；该操作区只显示“增加路线”，不得显示路线数量／上限胶囊。运输页只显示运输路线目录，不显示全局运输记录，一级目录不重复显示“运输路线”分区标题；点击路线进入同一 `transport` 导航上下文内的 `transport-route` 详情位置。路线详情负责名称、只读路径／运输方式、环线／固定往返形态、周期距离、周期运输费、周期燃料费、当前“运输中／节点装卸／等待在线规划”状态和该路线历史。',
  'page transport intro',
);

page = replaceOnce(
  page,
  /运输路线创建从运输页进入唯一常驻战略地图编辑模式；[^\n]*本文不复制参数与算法。/,
  '运输路线创建从运输页进入唯一常驻战略地图编辑模式；创建、取消、成功返回、详情只读和关闭路径属于页面导航规则。地图创建模式只选择节点顺序与运输方式，不提供单程／往返选择；起终点相同自动形成环线，起终点不同固定沿原路往返。运输方式、建线费、周期运输费、周期燃料费、节点装卸、到站与不可修改业务语义统一引用 `WAREHOUSE_EXPANSION_DESIGN.md`，本文不复制参数与算法。',
  'page transport creation intro',
);

page = replaceOnce(
  page,
  /运输记录唯一显示在对应路线页面。[\s\S]*?不得为路线详情、自动发运或地图动画新增第七个状态分区、专用轮询或第二份运输记录。/,
  `运输记录唯一显示在对应路线页面。路线详情把该 \`routeId\` 的 \`transportShipments\` 分成当前运输和历史运输；当前周期展示真实状态、当前节点／下一节点、当前车载商品、周期运输费、周期燃料费、周期总费用、到站状态与时间，一级运输页不得恢复“进行中运输／最近完成”的全局记录。路线名称允许单独修改，新建路线默认使用玩家可见州名形成“起始州-终点州”。路线创建后路径、站点顺序和运输方式永久只读，不存在“在地图上编辑路线”入口，也不得通过页面下拉框、草稿或旧 \`route-update\` 修改；需要调整时只能在没有进行中的运输周期后删除并重新创建，重新创建按 \`WAREHOUSE_EXPANSION_DESIGN.md\` 再次支付一次性建线费。

创建前的路线只能通过唯一常驻战略地图编辑。地图创建模式按顺序点击已解锁州面追加站点，可再次点击起点闭环，并在同一操作条修改运输方式、查看一次性建线费并直接提交创建；不得显示单程／往返选择。起终点相同即按保存顺序形成环线，起终点不同即固定抵达终点后沿原节点顺序反向返回起点。页面正文不得恢复起始州／目的州／中间站下拉、商品、运输数量或自动发运开关。

运输路线不指定商品或固定数量，也不得显示手动“发运”按钮。没有运行周期时显示“等待在线规划”；车辆在途时显示“运输中”；到达节点后显示“节点装卸”。在线客户端常驻协调器在节点停靠后根据当前库存和州级行情计算本次装卸，并提交权威节点动作；客户端离线时服务端只允许当前在途段到达下一节点并停靠，不得自动装卸、自动继续下一段或自动启动下一周期。运输费和燃料仅按完整周期距离计算，并在路线起点开始新周期时一次性结算；具体算法、容量、资产守恒和兼容迁移统一以 \`WAREHOUSE_EXPANSION_DESIGN.md\` 为唯一业务权威。

路线和运行周期都是玩家私有运输状态，\`transportRoutes\` 与 \`transportShipments\` 一并进入现有玩家分区的 \`player.misc\` slice。运输页订阅 \`catalog + player.assets + player.misc + market.quotes\`，不得为路线详情、节点装卸或地图动画新增第七个状态分区、专用轮询或第二份运输记录。`,
  'page transport detail block',
);

write(pagePath, page);

const serverPath = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md';
let server = read(serverPath);

server = replaceOnce(
  server,
  /浏览器只持有展示缓存、本地匿名成交记录、偏好和按教程版本／玩家 ID 隔离的客户端教程状态。浏览器不得决定资产、存贷款、利息、抵押、违约处置、邀请奖励、封禁、拍卖、合同交付、成交、配方、生产结果或排行榜。/,
  '浏览器只持有展示缓存、本地匿名成交记录、偏好、按教程版本／玩家 ID 隔离的客户端教程状态和在线运输节点规划意图。运输节点装卸规划可以由客户端根据已交付的玩家库存与州级行情计算，但不得直接修改权威资产；服务器仍重新校验周期世代、节点位置、真实车载货物、地区可用库存、容量和资金后才允许落账。浏览器不得决定资产、存贷款、利息、抵押、违约处置、邀请奖励、封禁、拍卖、合同交付、成交、配方、生产结果或排行榜。',
  'server browser authority boundary',
);

server = replaceOnce(
  server,
  /跨州运输把 `world\.transportShipments` 作为顶层 segment[\s\S]*?条件不足只保持等待，不产生失败[^。]*。/,
  '跨州运输继续把 `world.transportShipments` 作为顶层 segment 随事务持久化，但运行语义改为单段节点循环：路线起终点相同按环线运行，起终点不同固定沿保存路径往返。客户端负责节点装卸规划；服务器通过 `transportShip` 的 `cycle-start` 与 `node-service` 操作校验路线、周期、当前访问节点、真实车载货物、地区库存和容量。新周期只能在起点启动，服务器按完整周期距离一次性计算并扣除周期运输费与整周期燃料费，客户端不得提交费用、距离或燃料量作为权威值。服务端只结算当前到期运输段：世界截止时间到达时只把该运输从 `in-transit` 改为 `docked` 并停在下一节点，不自动装卸、不继续下一段、不启动新周期；因此离线补算复杂度不随离线时长增长。',
  'server transport runtime paragraph',
);

server = replaceOnce(
  server,
  /^- 客户端状态版本唯一来源是 `server\/shared\/economy-state-version\.js`；.*$/m,
  '- 客户端状态版本唯一来源是 `server/shared/economy-state-version.js`；当前版本与最低兼容版本均为 39，当前客户端状态版本为 39，当前客户端只接受版本 39。客户端状态版本 39 的运输投影继续复用 `transportRoutes` 与 `transportShipments`：路线只保存路径与运输方式，当前运输记录只携带节点循环所需的轻量当前段、当前车载摘要、周期费用／燃料摘要和 `docked` 状态；普通玩家不存在手动 `route-dispatch`。服务器响应、`src/types.ts`、浏览器合并器、README、DESIGN 和 verifier 不得维护独立版本常量。版本低于下限或高于当前值时返回明确的“客户端状态版本不兼容”，客户端只允许刷新入口 HTML，不得在旧 JavaScript 内原地重试状态请求。',
  'server client version transport bullet',
);

server = replaceOnce(
  server,
  /^- 六分区状态交付、父分区 revision、可选 `sliceRevisions` 和按需详情以 `state-partitions\.js`、`state-delivery\.js` 与 `market-detail` 实现为权威。运输路线归入 `player\.misc`，真实运输记录归入 `market\.misc`，不得新增第七父分区。$/m,
  '- 六分区状态交付、父分区 revision、可选 `sliceRevisions` 和按需详情以 `state-partitions.js`、`state-delivery.js` 与 `market-detail` 实现为权威。`transportShipments` 与 `transportRoutes` 一并归入 `player.misc`，不得再让车辆到站或装卸变化推进 `market.misc`，也不得新增第七父分区。',
  'server state partition transport bullet',
);

server = replaceOnce(
  server,
  /运输路线 `transportRoutes` 显式归入 `player\.misc`，真实运输记录 `transportShipments` 显式归入 `market\.misc`，不得为运输新增第七个父分区。/,
  '`transportShipments` 与 `transportRoutes` 一并归入 `player.misc`；运输运行态不再归入 `market.misc`，不得为运输新增第七个父分区。',
  'server slice transport paragraph',
);

server = replaceOnce(
  server,
  /排行榜结算与订单历史裁剪中选出最早绝对时间/,
  '排行榜结算、运输当前在途段到站与订单历史裁剪中选出最早绝对时间',
  'server deadline transport inclusion',
);

write(serverPath, server);

console.log('Transport authoritative document patches applied.');
