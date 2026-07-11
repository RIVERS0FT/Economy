# Economy

Economy 是一款多人在线经济模拟与交易游戏。

- 项目：`RIVERS0FT/Economy`
- 生产网页：`https://game.riversoft.top/economy/`
- 当前产品方向：网页端多人联机金融与产业经营

玩家以个人身份拥有货币、商品、工厂、订单和其他资产。游戏不设置企业身份，不依赖角色或城市场景。核心目标是通过工作、生产、交易和资产配置持续提升总资产，并在排行榜中与其他玩家竞争。

## 核心循环

```text
工作获得基础资金
-> 建设或收购工厂
-> 设置持续或定量生产计划
-> 手动启动工厂
-> 消耗资金与原料生产商品
-> 领取产成品
-> 在独立商品订单簿交易
-> 在市场直接管理订单和撤单
-> 在资金页复盘资金与资产变化
-> 提升总资产与排名
```

## 当前产业系统

### 商品

首批提供六种商品：

- 粮食
- 铁矿石
- 面粉
- 钢材
- 食品
- 机械

每种商品拥有独立的：

- 可用库存与冻结库存
- 限价订单簿
- 买一、卖一与价差
- 最近成交价和价格历史
- 人口或企业需求
- 需求满足率

不同商品订单不会互相撮合。

### 工厂

首批提供六类工厂：

| 工厂 | 配方 |
|---|---|
| 农场 | 无原料 → 粮食 |
| 矿场 | 无原料 → 铁矿石 |
| 面粉厂 | 粮食 → 面粉 |
| 钢铁厂 | 铁矿石 → 钢材 |
| 食品厂 | 面粉 → 食品 |
| 机械厂 | 钢材 → 机械 |

玩家持有工厂数量不设上限，不存在设施槽位或购买工厂时的槽位检查。同一玩家同时只能施工一座工厂，这是施工节奏限制，不是资产数量限制。

### 手动控制与生产计划

- 工厂施工完成后保持停止状态。
- 工厂必须由玩家手动启动。
- 玩家可以手动停止运行中的工厂。
- 资金不足、原料不足、内部产成品已满或挂牌时停止生产。
- 阻塞条件解除后不会自动重启。
- 每座工厂支持持续生产和定量生产。
- 定量计划达到目标后自动停止，不允许超产。
- 修改计划前必须先停止工厂。
- 离线前处于运行状态的工厂按服务器时间批量结算。

## 市场与订单

商品使用限价订单簿：

1. 价格优先。
2. 同价时间优先。
3. 允许部分成交。
4. 未成交部分继续保留。
5. 未成交订单可以撤销。
6. 买单冻结资金，卖单冻结对应商品。
7. 成交由服务器原子更新双方资产、订单、成交和资产事件。

订单管理已经合入市场：

- 下单区域直接显示当前商品未完成订单。
- 玩家可以在当前商品订单区立即撤单。
- 市场下方显示全部商品的未完成订单。
- 市场显示冻结资金、冻结商品和工厂挂牌摘要。
- 市场保留完整成交记录。
- 导航不再提供独立“订单”页面。

工厂使用固定价格挂牌：

- 每座工厂是唯一资产。
- 数量固定为 1。
- 卖家设置价格。
- 买家资金足够即可购买，不检查设施槽位。
- 成交后直接转移原始工厂产权。
- 收购后的工厂保持停止状态，由买家手动启动。

## 资金与资产

“资金”页面统一展示：

- 可用货币与冻结货币
- 各商品可用库存与冻结库存
- 工厂及其内部产成品
- 正在出售的工厂
- 总资产与排行榜名次
- 货币发行与系统回收
- 资金、商品、工厂和生产的复合资产事件

总资产由服务器计算：

```text
总资产 =
可用资金
+ 冻结资金
+ Σ(各商品可用与冻结数量 × 对应参考价)
+ Σ(工厂系统估值 + 内部产成品估值)
```

玩家挂牌价不直接计入总资产。

### 复合资产事件

客户端状态新增 `assetEvents`。一次服务器事务只生成一条复合事件，可同时描述：

- 可用资金变化
- 冻结资金变化
- 商品可用与冻结库存变化
- 工厂产权或状态变化
- 生产原料、运营费和产成品变化
- 订单或成交来源 ID

旧 `ledger` 在 SQLite 读取层迁移为历史资产事件，不伪造旧记录中不存在的商品或工厂明细。

## 页面结构

```text
GameShell
├── DesktopSidebar / MobileBottomNavigation
├── StatusBar
├── OverviewPage
│   ├── WorkWidget
│   ├── MultiProductMarketSummary
│   ├── ProductionSummary
│   ├── WealthSummary
│   └── RecentActivity
├── MarketPage
│   ├── ProductSelector
│   ├── OrderEntry
│   ├── CurrentProductOpenOrders
│   ├── ProductOrderBook
│   ├── ProductPriceHistory
│   ├── AllOpenOrdersAndCancel
│   ├── TradeHistory
│   └── FacilityListings
├── ProductionPage
│   ├── FacilityTypeSelector
│   ├── BuildFacility
│   ├── ProductionPlan
│   ├── ManualStartStop
│   └── CollectAndList
├── AssetsPage
│   ├── FundsSummary
│   ├── AssetAllocation
│   ├── ProductInventoryAndValuation
│   ├── CurrencyFlow
│   └── AssetEvents
├── LeaderboardPage
└── SettingsPage
```

正式导航固定为：

```text
概览｜市场｜生产｜资金｜排行｜设置
```

## 服务器权威边界

服务器负责：

- 工作收益和冷却
- 玩家资金与所有商品库存
- 冻结资金与冻结商品
- 工厂产权、施工、配方和生产
- 持续与定量生产计划
- 手动启动、停止和阻塞状态
- 多商品订单撮合和撤单
- 工厂即时产权交割
- 人口与企业需求订单
- 各商品参考价和工厂估值
- 总资产与排行榜
- 成交记录与复合资产事件
- 旧世界状态和旧流水迁移

客户端负责：

- 页面展示和用户输入
- 倒计时和进度视觉
- 盘口、价格曲线和筛选
- 不改变正式状态的预测与分析

浏览器本地存储、客户端时间和客户端计算不能改变正式资金、库存、工厂、生产计划、订单、产权或资产事件。

## 数据与部署

- 游戏 API：`127.0.0.1:3002`
- 账号服务：`127.0.0.1:3001`
- 数据库：`/var/lib/riversoft-economy/economy.sqlite`
- systemd：`riversoft-economy-api.service`
- 网页目录：`/var/www/game/economy`
- API 目录：`/var/www/game/economy-api`
- 客户端状态版本：6
- 世界状态版本：3

迁移在 SQLite 读取层执行：

- 旧单商品状态迁移为六商品目录中的粮食状态。
- `facilitySlots` 删除，不转化为其他限制。
- 旧 `ledger` 迁移为带 `legacy` 标记的资产事件。
- 迁移可重复执行，不清空资金、库存、工厂、订单或成交。

## 本地开发

```bash
npm install
npm run dev
```

完整检查：

```bash
npm run build
```

`npm run build` 包含：

- UI、产业和市场资产信息架构检查
- 液态玻璃状态栏检查
- Nginx 配置测试
- 服务端语法检查
- 服务端领域测试
- TypeScript 检查
- Vite 生产构建

## 2 核 2G 约束

- 工厂按批量周期结算，不逐秒模拟工人或机器。
- 每次处理工厂有安全周期上限。
- 长期离线生产写聚合资产事件，不为每个周期写一条记录。
- 每名玩家最多 10 笔未完成订单。
- 商品盘口只展示有限深度。
- 挂牌、历史订单、成交和资产事件限制保存及展示数量。
- 图表、排行榜和公开统计允许降低刷新频率。
- 服务器资源不足时，资金、商品、原料、产出、计划、订单、产权和资产事件正确性不能降级。

## 设计文档

- `docs/INDUSTRY_AND_PRODUCTION_DESIGN.md`：多商品、工厂目录、生产计划、手动控制、市场和迁移基线
- `docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md`：订单合入市场、资金资产事件和页面职责基线
- `docs/WEB_MULTIPLAYER_GAME_DESIGN.md`：整体产品与功能设计
- `docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`：服务器权威架构与生产部署
- `docs/UI_DESIGN_SYSTEM.md`：颜色、控件、布局和响应式设计系统
- `docs/LIQUID_GLASS_CHROME_DESIGN.md`：桌面与移动端液态玻璃应用外壳
- `docs/DEPLOYMENT_PRIVILEGES.md`：生产部署权限
- `docs/CLICK_CURRENCY_ECONOMY_DESIGN.md`：工作货币与冷却
- `docs/FACTORY_ASSET_MARKET_DESIGN.md`：早期设施资产市场专题
- `docs/POPULATION_CONSUMPTION_DESIGN.md`：需求模型专题
- `docs/SERVER_CAPACITY_DESIGN.md`：2 核 2G 容量与降级设计
- `docs/CLIENT_COMPUTATION_DESIGN.md`：客户端计算与服务器权威分工

涉及订单页面归属、撤单、成交展示、资金流水和资产事件时，以 `docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md` 为最高专题基线。不得恢复独立订单页面或客户端权威流水。
