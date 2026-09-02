# Economy

<div align="center">
  <img src="https://riversoft.top/logo.svg" width="88" height="88" alt="RIVERSOFT">

  <p><strong>网页端多人在线经济模拟、产业经营与市场交易游戏。</strong></p>
  <p>建设工厂、组织产业链，在持续演化的多人经济中配置资产、竞争与合作。</p>

  <p>
    <a href="https://game.riversoft.top/economy/"><strong>开始游戏</strong></a>
    ·
    <a href="https://game.riversoft.top/economy/admin">管理员页面</a>
    ·
    <a href="docs/README.md">设计文档</a>
  </p>
</div>

<p align="center">
  <a href="https://github.com/RIVERS0FT/Economy/actions/workflows/ci.yml">
    <img alt="Economy CI" src="https://github.com/RIVERS0FT/Economy/actions/workflows/ci.yml/badge.svg">
  </a>
  <img alt="Node.js 24.4.0" src="https://img.shields.io/badge/Node.js-24.4.0-339933?logo=nodedotjs&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827">
  <img alt="TypeScript 7" src="https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white">
</p>

## 项目简介

Economy 是一款以生产、交易和资产配置为核心的多人在线经济模拟游戏。玩家在州级经营区域中建设和运营工厂、管理本地库存与现金流、参与市场交易，并通过研发、合同、银行、运输、拍卖和其他经营系统扩展策略。

市场与最终资产变化由服务器权威确认。客户端负责交互与展示，不自行决定资金、库存、订单、合同或生产结算结果。

游戏中的普通货币、宝石、商品、工厂、积分和价格均为虚构内容，不对应真实货币、证券或商品。

## 核心能力

- **产业经营**：建设工厂、选择生产方式、组织上下游产业链并调整经营结构。
- **地区经济**：以美国本土州级区域作为经营上下文，市场、库存、工厂和运输均具有明确地区语义。
- **多人市场**：通过服务器权威订单、撮合、成交和资产流转形成持续变化的玩家经济。
- **长期经营系统**：提供研发、合同、银行、运输、拍卖、排行榜和商店等扩展玩法。
- **服务器权威**：重要经济写入与最终状态由服务器验证并发布，客户端状态按权威协议同步。
- **多端界面**：支持桌面和移动浏览器，并保留 Tauri 桌面应用外壳。

这里仅介绍稳定的项目能力。具体金额、费率、数量、周期、算法、协议字段、页面几何、迁移和部署约束不在本 README 维护，统一从 [设计文档索引](docs/README.md) 路由到唯一权威 DESIGN。

## 在线入口

| 入口 | 地址 | 用途 |
|---|---|---|
| 游戏网页 | <https://game.riversoft.top/economy/> | 登录并进入正式游戏 |
| 管理员页面 | <https://game.riversoft.top/economy/admin> | 运营、审计与管理 |
| RIVERSOFT 主页 | <https://riversoft.top/> | 项目主页与统一账号入口 |
| 设计文档 | [docs/README.md](docs/README.md) | 查找规则的唯一 DESIGN owner |
| 协作规则 | [AGENTS.md](AGENTS.md) | 仓库修改、验证和交付流程 |

## 技术栈

| 层级 | 技术 |
|---|---|
| Web 客户端 | React 19、TypeScript 7、Vite 8、Tailwind CSS 4 |
| 数据可视化 | Apache ECharts 6 |
| 桌面外壳 | Tauri 2 |
| 游戏服务 | Node.js 24.4.0、服务器权威 HTTP API |
| 数据存储 | SQLite |
| 测试与验证 | Node.js Test Runner、Playwright、项目专项防回退脚本 |
| 发布与运行 | GitHub Actions、Nginx、systemd |

具体状态协议、持久化结构、服务拓扑和生产部署约束属于服务器权威设计，不在根 README 重复维护。

## 本地开发

### 环境要求

- Node.js 24.4.0
- 与仓库 `package-lock.json` 匹配的 npm
- 运行浏览器测试时需要 Chromium 及其系统依赖

### 启动前端

```bash
git clone https://github.com/RIVERS0FT/Economy.git
cd Economy
npm ci
npm run dev
```

开发入口默认位于 `<http://localhost:1420/economy/>`。只进行界面开发时，可以使用仓库提供的本地预览入口；完整账号和权威游戏流程需要对应本地服务。具体服务结构与 API 约束参见 [服务器架构与部署设计](docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md)。

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动本地开发环境 |
| `npm run typecheck` | 执行 TypeScript 类型检查 |
| `npm run build` | 执行正式构建与仓库验证 |
| `npm run test:browser` | 执行 Playwright 浏览器回归 |
| `npm run stress:smoke` | 执行短时压力冒烟测试 |
| `npm run preview` | 本地预览生产构建结果 |

首次运行浏览器测试前按 Playwright 要求准备 Chromium：

```bash
npx playwright install --with-deps chromium
npm run test:browser
```

## 项目结构

```text
Economy/
├── src/          # React 客户端、页面、组件、样式与游戏资源
├── server/       # 服务器权威领域逻辑、HTTP API、SQLite 与服务器测试
├── shared/       # 客户端与服务器共享数据和纯函数
├── docs/         # 当前有效的权威设计文档与索引
├── scripts/      # 构建、验证、生成、诊断和部署脚本
├── tests/        # 浏览器回归与压力测试
├── deploy/       # 生产运行配置
├── src-tauri/    # Tauri 桌面应用配置
└── .github/      # CI、部署、诊断和维护工作流
```

## 文档边界

仓库文档采用明确层级：

- [AGENTS.md](AGENTS.md) 只规定协作、验证和交付流程。
- 本 `README.md` 只负责项目公开入口、稳定高层能力和开发导航。
- [docs/README.md](docs/README.md) 只负责设计文档索引、内容边界和规则路由。
- `docs/*_DESIGN.md` 才保存实际业务、交互、架构或部署规则；一条语义规则只有一个 DESIGN owner。
- 代码与正式数据文件保存运行时常量和真实实现；测试与 verifier 负责防止实现偏离设计。

如果某条说明会因为产品参数、算法、接口、布局或部署实现改变而需要同步修改，它通常不属于根 README，应放到相应权威 DESIGN 或代码中。

## 设计文档入口

- [设计文档索引与规则路由](docs/README.md)
- [产品与玩法设计](docs/PRODUCT_AND_GAMEPLAY_DESIGN.md)
- [产业与生产设计](docs/INDUSTRY_AND_PRODUCTION_DESIGN.md)
- [统一资产订单簿设计](docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md)
- [页面内容与导航设计](docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md)
- [UI 设计系统](docs/UI_DESIGN_SYSTEM.md)
- [服务器架构与部署设计](docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md)
- [CI 执行设计](docs/CI_EXECUTION_DESIGN.md)

## 开发与交付

开始修改前先阅读 [AGENTS.md](AGENTS.md) 和 [docs/README.md](docs/README.md)，再按任务范围核对对应 DESIGN、实现、测试和验证脚本。

Pull Request 由 [Economy CI](.github/workflows/ci.yml) 验证。修改压缩合并到 `main` 后，[部署工作流](.github/workflows/deploy.yml) 从已验证源码重新构建、执行浏览器门禁、部署正式环境并进行线上验收。部署过程的服务器路径、权限、备份、发布顺序和验收细节只在服务器与 CI 权威设计及工作流实现中维护。
