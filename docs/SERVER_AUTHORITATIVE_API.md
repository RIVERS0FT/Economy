# Economy 服务器权威游戏 API

> 状态：首个可部署实现  
> 服务端口：`127.0.0.1:3002`  
> 公网前缀：`/economy-api/game/`

## 1. 权威边界

服务器负责并持久化：

- 玩家可用和冻结资金
- 玩家可用和冻结商品库存
- 生产设施产权、施工、运行、暂停和领取
- 商品订单创建、冻结、撤销、价格时间优先撮合和成交结算
- 设施挂牌、撤销、购买和产权交割
- 成交记录、资产流水、市场参考价和排行榜
- 工作冷却与收入
- 人口需求和基础市场流动性

浏览器只保留：

- 当前页面、输入框、筛选条件和刷新频率
- 倒计时显示
- 图表、盘口聚合、资产占比和收益预测

浏览器本地状态不能修改正式经济结果。旧版 `localStorage` 经济数据不会上传到服务器，因为客户端数据不可信。

## 2. 请求流程

```text
浏览器操作
→ /economy-api/game/*
→ Nginx 转发到 127.0.0.1:3002
→ 游戏 API 使用 Cookie 向 127.0.0.1:3001/api/me 验证账号
→ SQLite BEGIN IMMEDIATE
→ 校验、撮合、结算、流水和排行榜快照
→ COMMIT
→ 返回新的完整玩家状态
```

所有修改请求必须带 `Idempotency-Key`。同一账号重复提交同一幂等键时，服务器返回第一次的响应，不会重复扣款、生产或成交。

## 3. API

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/economy-api/game/state` | 获取服务器正式状态 |
| POST | `/economy-api/game/work` | 工作 |
| POST | `/economy-api/game/facilities` | 建造设施 |
| POST | `/economy-api/game/facilities/:id/start` | 启动生产 |
| POST | `/economy-api/game/facilities/:id/pause` | 暂停生产 |
| POST | `/economy-api/game/facilities/:id/collect` | 领取商品 |
| POST | `/economy-api/game/facilities/:id/list` | 挂牌设施 |
| POST | `/economy-api/game/facility-listings/:id/cancel` | 撤销设施挂牌 |
| POST | `/economy-api/game/facility-listings/:id/buy` | 收购设施 |
| POST | `/economy-api/game/orders` | 创建商品订单 |
| POST | `/economy-api/game/orders/:id/cancel` | 撤销商品订单 |
| PATCH | `/economy-api/game/profile` | 修改玩家昵称 |
| POST | `/economy-api/game/reset` | 重置当前玩家经济状态 |

修改操作统一返回：

```json
{
  "result": {
    "ok": true,
    "message": "操作结果"
  },
  "state": {
    "version": 4
  }
}
```

## 4. 存储与一致性

首发实现使用 Node.js `node:sqlite` 和单一世界状态事务：

- 数据库文件默认位于 `/var/lib/riversoft-economy/economy.sqlite`
- SQLite 使用 WAL 和 `synchronous=NORMAL`
- 所有修改使用 `BEGIN IMMEDIATE`
- 世界状态、玩家资产、订单和产权在同一事务中更新
- 幂等响应与世界状态在同一事务中写入
- 单节点只运行一个游戏 API 进程

该方案优先保证 2 核 2G 首发环境中的资产一致性。扩展到多进程或多服务器前，应将世界状态拆为规范化表并引入跨进程事务与消息分发。

## 5. 部署

服务要求 Node.js `22.16.0` 或更高版本。

主分支部署流程会：

1. 构建网页并运行服务端测试。
2. 上传静态网页到 `/var/www/game/economy/`。
3. 上传服务端到 `/var/www/game/economy-api/`。
4. 安装并重启 `riversoft-economy-api.service`。
5. 配置 Nginx：账号路由到 3001，游戏路由到 3002。
6. 验证服务健康、静态页面、账号代理和未登录 401。

## 6. 安全规则

- 只接受来自正式游戏站点的同源请求。
- 使用主页账号 Cookie 验证用户，不接受客户端自报用户编号。
- 所有价格、数量、余额、库存、设施状态和订单归属都由服务器重新校验。
- 工作冷却、施工和生产使用服务器时间。
- 商品撮合禁止同账号自成交。
- 每个账号最多 10 笔未完成订单。
- 创建和撤销订单合计限制为每分钟 30 次。
- 请求体限制为 16 KB。
- 客户端只显示服务器返回的正式结果。
