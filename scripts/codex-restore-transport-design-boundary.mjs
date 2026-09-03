import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);

function insertAfter(path, anchor, addition) {
  const source = read(path);
  if (!source.includes(anchor)) throw new Error(`${path} 缺少插入锚点`);
  if (source.includes(addition.trim())) return;
  write(path, source.replace(anchor, `${anchor}\n\n${addition.trim()}`));
}

insertAfter(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '商品库存、商品行情、工厂集群和服务器内部市场状态按州级地区隔离：玩家商品即时交易只改变成交州的本地资金与库存；人口／储备内部订单只能在同州模拟市场内撮合；工厂交易或拍卖后仍留在原地区。',
  '跨州商品只能通过付费运输在已解锁州之间流动；运输方式、节点循环、周期费用、在途库存和客户端装卸规划边界继续唯一遵循 `WAREHOUSE_EXPANSION_DESIGN.md`，市场即时交易不得隐式跨州取货或替代正式运输。',
);

insertAfter(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '浏览器只持有展示缓存、本地匿名成交记录、偏好、按教程版本／玩家 ID 隔离的客户端教程状态和在线运输节点规划意图。运输节点装卸规划可以由客户端根据已交付的玩家库存与州级行情计算，但不得直接修改权威资产；服务器仍重新校验周期世代、节点位置、真实车载货物、地区可用库存、容量和资金后才允许落账。浏览器不得决定资产、存贷款、利息、抵押、违约处置、邀请奖励、封禁、拍卖、合同交付、成交、配方、生产结果或排行榜。',
  '跨州运输继续使用 `transportShip` 的 `cycle-start` 与 `node-service` 两类权威操作推进。客户端负责节点装卸规划，但只能提交当前节点的装卸意图；服务端只结算当前到期运输段，并在每次 `node-service` 重新校验路线、周期、当前访问节点、真实车载货物、地区库存与容量。车辆抵达节点后进入 `docked`，不得因离线恢复一次跨越多个未来节点。`transportShipments` 与 `transportRoutes` 一并归入 `player.misc`，运输到站或装卸不得新增第七父分区或错误推进市场分区。',
);

for (const path of [
  'scripts/codex-restore-transport-design-boundary.mjs',
  '.github/workflows/codex-restore-transport-design-boundary.yml',
]) {
  if (existsSync(path)) unlinkSync(path);
}

console.log('已恢复市场收口误删的运输产品／服务器权威边界。');
