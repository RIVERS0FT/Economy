# Economy

Economy 是一款多人联机虚拟市场策略游戏。玩家通过点击产生劳动力，使用劳动力兑换货物，再将货物投入市场出售以获得游戏内金融货币。

游戏不围绕资源争夺，不需要创建房间，也不需要玩家列表。玩家启动客户端后直接进入统一的共享市场大厅。

所有劳动力、货物、点数、行情和交易均为游戏内虚拟设定。

## 技术栈

本项目沿用 `RIVERS0FT/TheGenius` 的技术路线：

- Tauri 2.x
- Rust
- React
- TypeScript
- Vite
- Zustand
- CSS / Tailwind 风格样式
- Browser Web Audio API
- WebSocket 多人同步
- Steamworks SDK
- Steam Inventory Service

## 核心循环

```text
点击 -> 劳动力 -> 货物 -> 市场出售 -> 金融货币
```

第一版最小可玩目标：

1. 点击产生劳动力。
2. 劳动力兑换食品包。
3. 食品包出售获得金融货币。
4. 金融货币升级工作席位。
5. 工作席位提升点击效率。

## 当前设计决策

- 游戏名称：Economy
- 核心玩法：虚拟市场策略
- 不需要创建房间
- 不需要玩家列表
- 点击不直接产出金融货币
- 点击产出劳动力
- 劳动力用于兑换货物
- 货物可以在市场出售以获得金融货币
- 玩家状态接入 Steam Inventory Service
- 实时市场价格和订单簿由服务器维护

## 开发

```bash
npm install
npm run dev
```

## Tauri 桌面模式

```bash
npm run tauri dev
```

## 构建

```bash
npm run tauri build
```
