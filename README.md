# Economy

Economy 是一款网页端多人在线经济模拟、产业经营与统一资产交易游戏。

- 项目：`RIVERS0FT/Economy`
- 生产网页：`https://game.riversoft.top/economy/`
- 管理员页面：`https://game.riversoft.top/economy/admin`
- 客户端状态版本：`10`
- 世界状态版本：`6`

## 当前核心循环

```text
工作获得基础资金
→ 建设同类型工厂数量
→ 设置统一生产计划并开启工厂集群
→ 产成品直接进入共享仓库
→ 在统一资产订单簿交易商品和工厂
→ 调整产业链、库存与资金
→ 提升服务器计算的总资产和排行榜名次
```

## 当前关键规则

- 当前目录共 12 种商品和 12 种工厂类型。
- 新产业链包括 `木材 → 木板 → 家具` 和 `原油 → 塑料 → 电子产品`。
- 工厂按 `facilityTypeId + count` 保存，不存在单座工厂实例、实例 ID、内部仓库或领取产成品。
- 同类型工厂共用运行意图、三种顶层状态、进度、生产计划和周期结算。
- 工厂异常时保留开启意图；资金、原料、仓库或计划条件恢复后，从新的完整周期自动恢复。
- 商品和工厂共用统一限价订单结构，支持价格优先、同价时间优先、部分成交、撤单和禁止自成交。
- 工厂运行中可以提交卖单；冻结数量立即退出当前参与数量，并停止产生商品和运营成本。
- 商品和工厂估值均使用最高非本人有效买入价；没有非本人买单时估值为 0。
- 工作冷却固定为 10 秒，不随连续工作次数增加。
- 共享仓库只显示可用或冻结数量大于零的商品，并复用统一商品 SVG 图标。
- 服务器只保存权威经济状态；玩家活动和成交展示日志保存在当前浏览器。

## 页面

```text
概览｜市场｜生产｜资产｜排行｜设置
```

- 概览：工作、行情、生产与财富摘要。
- 市场：商品和工厂统一下单、5+5 单列订单簿、撤单与本地成交。
- 生产：共享仓库、建设任务和工厂类型集群。
- 资产：现金、商品和工厂资产汇总，以及当前浏览器中的资产变化记录。
- 排行：服务器总资产排行榜。
- 设置：玩家资料、偏好、礼品兑换、退出与重置。

## 权威设计文档

完整索引见 `docs/README.md`。修改规则时必须更新对应权威文档和验证脚本，不得通过新增平行文档覆盖现行规则。

| 主题 | 权威文档 |
|---|---|
| 产品定位、工作、货币与需求 | `docs/PRODUCT_AND_GAMEPLAY_DESIGN.md` |
| 商品目录、工厂集群与生产 | `docs/INDUSTRY_AND_PRODUCTION_DESIGN.md` |
| 商品与工厂统一订单簿 | `docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` |
| 共享仓库和扩容 | `docs/WAREHOUSE_EXPANSION_DESIGN.md` |
| 页面内容与导航职责 | `docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` |
| UI 组件与响应式系统 | `docs/UI_DESIGN_SYSTEM.md` |
| 状态栏与移动底栏玻璃外壳 | `docs/LIQUID_GLASS_CHROME_DESIGN.md` |
| 服务器、API、容量与部署 | `docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md` |
| 浏览器本地活动日志 | `docs/LOCAL_ACTIVITY_LOG_DESIGN.md` |
| 礼品码与管理员后台 | `docs/GIFT_CODE_AND_ADMIN_DESIGN.md` |

## 数据与部署

- 游戏 API：`127.0.0.1:3002`
- 主页账号服务：`127.0.0.1:3001`
- 数据库：`/var/lib/riversoft-economy/economy.sqlite`
- systemd：`riversoft-economy-api.service`
- 网页目录：`/var/www/game/economy`
- API 目录：`/var/www/game/economy-api`

## 本地开发与完整检查

```bash
npm install
npm run dev
npm run build
```

`npm run build` 会执行页面职责、UI 架构、产业目录、统一资产市场、液态玻璃、仓库、工厂集群、Nginx、服务器测试、TypeScript 和 Vite 生产构建检查。
