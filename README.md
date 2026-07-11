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
-> 调整产业链和资产组合
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

## 市场

商品使用限价订单簿：

1. 价格优先。
2. 同价时间优先。
3. 允许部分成交。
4. 未成交部分继续保留。
5. 未成交订单可以撤销。
6. 买单冻结资金，卖单冻结对应商品。
7. 成交由服务器原子更新双方资产、订单、成交和流水。

工厂使用固定价格挂牌：

- 每座工厂是唯一资产。
- 数量固定为 1。
- 卖家设置价格。
- 买家资金足够即可购买，不检查设施槽位。
- 成交后直接转移原始工厂产权。
- 收购后的工厂保持停止状态，由买家手动启动。

## 玩家资产

所有资产直接归属于玩家：

- 可用货币与冻结货币
- 各商品可用库存与冻结库存
- 工厂及其内部产成品
- 正在出售的工厂
- 当前订单与历史订单
- 成交、资金、商品和产权流水
- 总资产与排行榜名次

总资产由服务器计算：

```text
总资产 =
可用资金
+ 冻结资金
+ Σ(各商品可用与冻结数量 × 对应参考价)
+ Σ(工厂系统估值 + 内部产成品估值)
```

玩家挂牌价不直接计入总资产。

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
│   ├── ProductOrderBook
│   ├── ProductPriceHistory
│   └── FacilityListings
├── ProductionPage
│   ├── FacilityTypeSelector
│   ├── BuildFacility
│   ├── ProductionPlan
│   ├── ManualStartStop
│   └── CollectAndList
├── AssetsPage
├── LeaderboardPage
├── RecordsPage
└── SettingsPage
```

## 服务器权威边界

服务器负责：

- 工作收益和冷却
- 玩家资金与所有商品库存
- 冻结资金与冻结商品
- 工厂产权、施工、配方和生产
- 持续与定量生产计划
- 手动启动、停止和阻塞状态
- 多商品订单撮合
- 工厂即时产权交割
- 人口与企业需求订单
- 各商品参考价和工厂估值
- 总资产与排行榜
- 成交与资产流水
- 旧世界状态迁移

客户端负责：

- 页面展示和用户输入
- 倒计时和进度视觉
- 盘口、价格曲线和筛选
- 不改变正式状态的预测与分析

浏览器本地存储、客户端时间和客户端计算不能改变正式资金、库存、工厂、生产计划、订单或产权。

## 数据与部署

- 游戏 API：`127.0.0.1:3002`
- 账号服务：`127.0.0.1:3001`
- 数据库：`/var/lib/riversoft-economy/economy.sqlite`
- systemd：`riversoft-economy-api.service`
- 网页目录：`/var/www/game/economy`
- API 目录：`/var/www/game/economy-api`
- 客户端状态版本：5
- 世界状态版本：2

旧版单商品状态会在 SQLite 读取层迁移：

- 基础商品映射为粮食
- 旧库存映射到粮食库存
- 旧订单增加 `productId: grain`
- 旧基础设施映射为农场
- 旧运行状态和设施 ID 保留
- `facilitySlots` 删除，不转化为其他限制

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

- UI 与产业架构检查
- Nginx 配置测试
- 服务端语法检查
- 服务端领域测试
- TypeScript 检查
- Vite 生产构建

## 2 核 2G 约束

- 工厂按批量周期结算，不逐秒模拟工人或机器。
- 每次处理工厂有安全周期上限。
- 长期离线生产写聚合流水，不为每个周期写一条记录。
- 每名玩家最多 10 笔未完成订单。
- 商品盘口只展示有限深度。
- 挂牌、历史订单和流水限制保存及展示数量。
- 图表、排行榜和公开统计允许降低刷新频率。
- 服务器资源不足时，资金、商品、原料、产出、计划、订单和产权正确性不能降级。

## 设计文档

- `docs/INDUSTRY_AND_PRODUCTION_DESIGN.md`：多商品、工厂目录、生产计划、手动控制、市场和迁移基线
- `docs/WEB_MULTIPLAYER_GAME_DESIGN.md`：整体产品与功能设计
- `docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`：服务器权威架构与生产部署
- `docs/UI_DESIGN_SYSTEM.md`：颜色、控件、布局和响应式设计系统
- `docs/DEPLOYMENT_PRIVILEGES.md`：生产部署权限
- `docs/CLICK_CURRENCY_ECONOMY_DESIGN.md`：工作货币与冷却
- `docs/FACTORY_ASSET_MARKET_DESIGN.md`：早期设施资产市场专题
- `docs/POPULATION_CONSUMPTION_DESIGN.md`：需求模型专题
- `docs/SERVER_CAPACITY_DESIGN.md`：2 核 2G 容量与降级设计
- `docs/CLIENT_COMPUTATION_DESIGN.md`：客户端计算与服务器权威分工

涉及生产、商品、工厂、配方和市场维度时，以 `docs/INDUSTRY_AND_PRODUCTION_DESIGN.md` 为最高专题基线。旧文档中的单商品、单设施和设施槽位规则均视为历史记录，不得用于回退当前实现。
