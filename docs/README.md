# Economy 设计文档索引

> 状态：当前文档入口  
> 适用项目：`RIVERS0FT/Economy`  
> 更新时间：2026-07-12  
> 客户端状态版本：10  
> 世界状态版本：6

本目录只保留当前设计。旧规则不归档在 `docs/`，也不得以“补充说明”“V2/V3”或新专题文档的形式继续并行存在。

## 权威文档

| 文档 | 唯一职责 |
|---|---|
| `PRODUCT_AND_GAMEPLAY_DESIGN.md` | 产品定位、核心循环、工作冷却、货币来源回收、需求与排行榜目标 |
| `INDUSTRY_AND_PRODUCTION_DESIGN.md` | 12 种商品、12 种工厂、工厂集群、生产周期、三态、自动恢复和状态迁移 |
| `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` | 商品和工厂统一限价订单、冻结、撮合、成交价、估值和资产统计 |
| `WAREHOUSE_EXPANSION_DESIGN.md` | 共享仓库占用、买单预占、扩容和生产空间约束 |
| `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` | 六个正式页面、模块唯一归属和页面防回退规则 |
| `UI_DESIGN_SYSTEM.md` | 设计令牌、共享组件、中文界面、响应式与可访问性 |
| `LIQUID_GLASS_CHROME_DESIGN.md` | 桌面与移动端状态栏、移动底栏和玻璃外壳 |
| `SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md` | 服务器权威边界、API、SQLite、容量限制、Nginx、systemd 和部署 |
| `LOCAL_ACTIVITY_LOG_DESIGN.md` | 浏览器本地快照、资产事件和权威逐笔成交记录 |
| `GIFT_CODE_AND_ADMIN_DESIGN.md` | 礼品兑换、管理员权限和后台范围 |

## 修改规则

1. 一个规则只能有一个权威归属。
2. 跨主题内容只引用权威文档，不复制完整规则。
3. 修改状态版本、世界版本、API、路径、端口或部署权限时，必须同步更新本文档、根 `README.md` 和对应验证脚本。
4. 删除或替换设计时直接修改权威文档，不新建旧版本归档。
5. 代码与文档冲突时不得默认以较新的文件名为准；应核对当前类型、服务器实现、测试和构建检查并立即消除冲突。
6. 未更新设计文档和防回退检查的规则变更不应合并。
