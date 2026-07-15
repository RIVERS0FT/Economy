# Economy 设计文档索引

> 状态：当前文档入口  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-15
> 客户端状态版本：11  
> 世界状态版本：7

本目录只保留当前设计。旧规则不归档在 `docs/`，也不得以“补充说明”“V2/V3”或新专题文档的形式继续并行存在。

## 权威文档

| 文档 | 唯一职责 |
|---|---|
| `PRODUCT_AND_GAMEPLAY_DESIGN.md` | 产品定位、核心循环、工作冷却、货币来源回收、需求与排行榜目标 |
| `INDUSTRY_AND_PRODUCTION_DESIGN.md` | 12 种商品、12 种工厂、工厂集群、生产周期、三态、自动恢复、定量关停和生产页面结构 |
| `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` | 商品和工厂统一限价订单、冻结、撮合、成交价、估值和资产统计 |
| `WAREHOUSE_EXPANSION_DESIGN.md` | 共享仓库占用、买单预占、无限扩容、商品卡和生产空间约束 |
| `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` | 八个正式页面、藏品与拍卖、资产导航、模块唯一归属和页面防回退规则 |
| `UI_DESIGN_SYSTEM.md` | 设计令牌、共享组件、统一 SVG 图标、中文界面、响应式、移动触摸反馈与可访问性 |
| `LIQUID_GLASS_CHROME_DESIGN.md` | 桌面与移动端状态栏、移动底栏和玻璃外壳 |
| `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md` | 服务器权威边界、API、SQLite、容量限制、Nginx、systemd 和部署 |
| `LOCAL_ACTIVITY_LOG_DESIGN.md` | 浏览器本地快照、资产事件和权威逐笔成交记录 |
| `GIFT_CODE_AND_ADMIN_DESIGN.md` | 单个与最多 50,000 个批量礼品码、TXT 明文导出、礼品兑换、芝加哥艺术博物馆藏品导入、唯一归属、竞价拍卖、管理员权限和后台范围 |

## 修改规则

1. 一个规则只能有一个权威归属。
2. 跨主题内容只引用权威文档，不复制完整规则。
3. 修改状态版本、世界版本、API、路径、端口或部署权限时，必须同步更新本文档、根 `README.md` 和对应验证脚本。
4. 删除或替换设计时直接修改权威文档，不新建旧版本归档。
5. 新的功能规则必须合并进现有权威文档，不得重新创建已删除文档或追加独立 V2/V3 章节。
6. 代码与文档冲突时不得默认以较新的文件名为准；应核对当前类型、服务器实现、测试和构建检查并立即消除冲突。
7. `scripts/verify-document-authority.mjs` 必须检查权威文件、版本号和禁止文件名；不得为了合并临时绕过或删除该检查。
8. 未更新设计文档和防回退检查的规则变更不应合并。
9. 移动端触控元素必须关闭浏览器原生蓝色 tap highlight，同时保留 `:focus-visible` 键盘焦点；实现统一放在 `src/styles/mobile-interaction.css`，并由 `scripts/verify-mobile-touch-feedback.mjs` 防回退。
10. 状态轮询修订号、响应防倒退、动作／轮询互斥、空闲读取不写库、默认刷新间隔和游戏 JSON 压缩属于服务器容量规则；必须同步更新 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并通过 `scripts/verify-state-delivery-capacity.mjs` 防回退。
11. 主页账号认证缓存的分级 TTL、Cookie 摘要、并发合并、错误策略和 LRU 上限属于安全与容量规则；必须同步更新 `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`，并通过 `scripts/verify-authentication-cache.mjs` 防回退。
