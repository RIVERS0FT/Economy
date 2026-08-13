import { readFileSync, writeFileSync } from 'node:fs';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, content) { writeFileSync(path, content); }
function replaceOnce(path, from, to) {
  const content = read(path);
  const first = content.indexOf(from);
  if (first < 0) throw new Error(`${path}: missing exact fragment: ${from.slice(0, 100)}`);
  if (content.indexOf(from, first + from.length) >= 0) throw new Error(`${path}: duplicate exact fragment`);
  write(path, content.slice(0, first) + to + content.slice(first + from.length));
}
function appendSection(path, marker, section) {
  const content = read(path);
  if (content.includes(marker)) return;
  write(path, `${content.trimEnd()}\n\n${section.trim()}\n`);
}

replaceOnce(
  'src/pages/OverviewPage.tsx',
  '<div className="overview-summary-row"><div className="overview-summary-row">',
  '<div className="overview-summary-row">',
);
replaceOnce(
  'tests/browser/partition-authority-harness.tsx',
  '  let patches: Record<string, object>;',
  '  let patches: any;',
);

appendSection(
  'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md',
  '### 客户端第三阶段响应边界',
  `### 客户端第三阶段响应边界

客户端继续只接受 \`catalog / player / market / auction / contract / leaderboard\` 六个外层权威分区；不得为了 React 性能增加第七个业务分区。服务器可在状态 envelope 顶层返回可选 \`sliceRevisions\`，仅描述 \`player\` 与 \`market\` 内稳定字段组是否变化。当前子修订固定为 \`player.identity\`、\`player.assets\`、\`player.production\`、\`player.progression\`、\`player.bank\`、\`player.stats\`、\`market.orders\`、\`market.quotes\`、\`market.calendar\`，以及各父分区的兼容 \`misc\` 子切片。

\`sliceRevisions\` 不是 \`EconomyState\`、不是世界状态，也不改变外层分区完整快照语义。服务器仍在父分区变化时返回完整 \`player\` 或 \`market\` 快照；客户端只有在同名子修订与上一份完全相同时，才允许把该子切片对应的顶层字段引用替换回旧引用，以减少 React 与派生索引失效。子修订变化时必须完整接受服务器新字段，包括字段删除；不得用结构共享复活服务器已经删除的字段。旧服务器缺少 \`sliceRevisions\` 时必须退化为父分区整体变化并清除陈旧子修订 token，不能漏掉 React 更新。

页面与外壳可以通过 \`useGameAuthorityDependencies\` 同时声明外层分区或子切片。纯银行变化不得提交市场页，纯行情变化不得通知 \`market.orders\` 消费者，纯订单变化不得通知 \`market.quotes\` / \`market.calendar\` 消费者；根 \`GameApp\` 继续保持稳定只读权威视图。

所有默认 1 秒可见时间刷新必须共享同一秒级 ticker；不得为每个 \`useNow\` 调用分别创建 \`setInterval\`。页面根组件不得订阅默认 1 秒 ticker：工作冷却、生产进度、研发倒计时、拍卖剩余时间、银行期限、商店报价倒计时和经济事件倒计时应下沉到最小可见叶子或独立动态区块。确实不需要秒级精度的根级判断可以使用至少 10 秒或 60 秒的共享慢速 ticker，但不能因此降低原本需要秒级显示的倒计时精度。

浏览器回归必须同时证明：子切片 patch 只提交声明该依赖的 React 消费者；共享秒级 ticker 连续运行时父组件 render count 保持不变、时间叶子正常更新。`,
);

appendSection(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '### 六分区内部子修订元数据',
  `### 六分区内部子修订元数据

状态交付的六个外层分区保持不变，字段归属仍由 \`state-partitions.js\` 决定。为允许新客户端在收到完整 \`player\` / \`market\` 快照时复用未变化字段引用，服务器可在 envelope 顶层同时返回 \`sliceRevisions\`。子切片定义唯一维护在 \`server/shared/economy-state-slices.js\`；服务端与客户端必须共享同一字段归属，禁止各自复制一套映射。

\`sliceRevisions\` 只是传输元数据，不写入世界 JSON、SQLite 玩家状态或 \`EconomyState\`，也不参与经济规则。客户端仍只提交六个父分区 revision 作为已知状态，服务器仍以父分区 revision 判断是否需要发送完整父分区 patch；子修订不能让服务器发送字段级 patch。没有父分区 patch 的轻量无变化响应仍可省略子修订。

增加、删除或调整子切片不得修改客户端状态版本或世界状态版本，除非实际 \`EconomyState\` 字段或持久化结构同时发生了不兼容变化。旧客户端会忽略 \`sliceRevisions\`；新客户端遇到缺少该元数据的旧响应必须按整个父分区变化处理，因此发布期间不需要双协议切换。`,
);

appendSection(
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  '### 客户端订单索引性能边界',
  `### 客户端订单索引性能边界

客户端允许针对当前收到的 \`orders\` 数组建立只读派生的客户端订单索引，用于市场展示、自己的未完成订单统计和在线自动交易状态判断。该索引可以维护订单 ID 查询、按资产分组的开放订单、自己的开放订单，以及商品自己的／外部的最高买价和最低卖价；只有 \`market.orders\` 实际变化时才重建。

客户端订单索引只是查询加速器，不是第二套订单簿，不得撮合、冻结、成交、收费、改变 FIFO、决定 maker price 或绕过服务器校验。服务器 \`order-book-runtime.js\` 与统一撮合内核仍是订单状态和价格时间优先的唯一权威来源。索引中的对象必须直接引用当前权威订单快照，不得复制或持久化可产生另一份订单状态的数据。`,
);

appendSection(
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  '### 自动交易客户端索引性能边界',
  `### 自动交易客户端索引性能边界

在线自动交易维护器只在 \`catalog\`、\`player.assets\`、\`player.production\`、\`market.orders\` 或 \`contract\` 变化时重新判断维护需求；纯行情、经济事件、银行、签到、研发计时或排行榜变化不得触发自动交易扫描。维护候选只遍历实际启用采购／出售策略的商品，并复用当前 \`market.orders\` 对应的客户端订单索引识别托管单、自己的交叉单和可成交外部盘口。

同一权威状态代内重复查询同一商品状态可以缓存，但库存、资金、工厂、合同、策略、托管订单 ID 或 \`market.orders\` 任一相关来源变化时必须失效。客户端订单索引只负责避免重复线性扫描；自动交易目标数量、冻结资金／库存、自交叉阻断和最终合法性仍由服务器动作再次校验，不能把在线客户端维护器升级为本地权威交易引擎。`,
);

appendSection(
  'docs/README.md',
  '### 客户端子修订与叶子时钟索引',
  `### 客户端子修订与叶子时钟索引

客户端仍以六个外层完整状态分区为传输边界；\`player / market\` 的 \`sliceRevisions\`、结构共享、\`useSyncExternalStore\` 子切片 React 消费和共享秒级叶子 ticker 以 \`AUTHORITATIVE_COUNTDOWN_DESIGN.md\` 为准，服务器 envelope 元数据边界以 \`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md\` 为准。客户端订单索引分别受 \`UNIFIED_ASSET_ORDER_BOOK_DESIGN.md\` 与 \`WAREHOUSE_EXPANSION_DESIGN.md\` 约束，只允许作为只读派生加速器。`,
);

console.log('Phase 3 design and cleanup transforms applied.');
