from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one occurrence, found {count}: {old[:80]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def replace_all(path, old, new, minimum=1):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f'{path}: expected at least {minimum} occurrences, found {count}: {old!r}')
    p.write_text(text.replace(old, new), encoding='utf-8')


product = 'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md'
replace_once(product, '> 更新时间：2026-08-06', '> 更新时间：2026-08-07')
replace_once(
    product,
    '新玩家同时一次性获得 **4 木材与 2 铁矿石**作为首座 C1 工厂建造材料包。即时建设上线迁移时，仅对没有任何工厂资产或施工承诺且尚未领取过材料包的既有玩家补发一次；不得重复发放，也不得把材料包计为货币发行或就业收入。',
    '新玩家不再获得首座工厂建造材料包。农场与果园按正式产业目录只消耗建造资金，其余工厂继续按目录同时消耗资金与正式商品建造材料；即时建设、批量数量和原子扣除规则以 `INDUSTRY_AND_PRODUCTION_DESIGN.md` 为准。既有玩家历史库存不因材料包退役而回收或改写。',
)
replace_once(
    product,
    '''## 4.1 C1-C7 产业研发

玩家研发等级固定为 C1-C7 的顺序最高复杂度准入。新玩家初始掌握 C1；C2-C7 依次消耗普通货币并经过服务器权威时间完成，费用与时间分别为 C2 300／5m、C3 700／20m、C4 1,200／45m、C5 2,400／1h 30m、C6 4,200／3h、C7 6,700／6h。同时只能研发一级，只能选择下一级，开始后不可取消、不可排队、不可用宝石加速。

研发费用不销毁：启动时从玩家可用资金一次性扣除并进入研发就业托管，按进度以基础人口 10%、技术人口 40%、专业人口 50% 释放；累计释放记入玩家 `researchPayroll` 与人口 `researchIncome`。研发等级本身不计入资产、排行榜或贷款抵押价值，不改变正式工厂的产量、周期、成本、配方、作业制度、满员率或仓库容量。''',
    '''## 4.1 C1-C7 产业科技研发

C1-C7 只表示产业难度阶段，不再作为整级工厂准入包。服务器权威科技目录固定为 24 个产业节点；新玩家初始掌握“基础种植”和“基础养殖”，其余科技按真实产业链前置关系解锁。玩家满足前置科技后可以选择产业方向，不要求先完成同阶段全部科技；每座正式工厂必须且只能映射一个所需科技，具体准入与迁移规则以 `INDUSTRY_AND_PRODUCTION_DESIGN.md` 为准。

玩家同时只能进行一项研发，不能排队或跳过前置科技。研发费用、基础时长和解锁范围读取服务器科技目录；启动时从玩家可用资金一次性扣除研发费并进入就业托管，按进度以基础人口 10%、技术人口 40%、专业人口 50% 释放，累计释放记入玩家 `researchPayroll` 与人口 `researchIncome`。科技本身不计入资产、排行榜或贷款抵押价值，也不改变正式工厂的产量、周期、成本、配方、作业制度、满员率或仓库容量。

当前唯一进行中的研发允许按 `GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md` 使用宝石加速：每次 1 宝石减少 30 分钟，剩余不足 30 分钟时立即完成；加速不得跳过前置科技、创建队列或减少研发就业收入。旧 `unlockedComplexity` 只保留连续完成阶段的兼容与展示语义，不得恢复整级研发或以复杂度字段替代具体科技准入。''',
)

page = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
replace_once(page, '> 更新时间：2026-08-06', '> 更新时间：2026-08-07')
replace_once(page, '| 概览 | `home` | `OverviewPage` | 工作、基础教程当前步骤和经营摘要 |', '| 概览 | `home` | `OverviewPage` | 工作、经营成长线当前步骤和经营摘要 |')
replace_once(page, '| 设置 | `settings` | `SettingsPage` | 资料、偏好、基础教程控制、礼品和退出 |', '| 设置 | `settings` | `SettingsPage` | 资料、偏好、经营成长线控制、礼品和退出 |')
replace_once(page, '## 11. 设置与基础教程', '## 11. 设置与经营成长线')
replace_once(page, '### 11.1 客户端本轮教程', '### 11.1 客户端经营成长线')
replace_once(
    page,
    '''基础教程固定为六步：工作、建设工厂、启动工厂、完成生产、提交商品卖单、完成商品出售。新玩家默认自动开启；教程功能上线前世界中已存在的玩家通过一次性迁移默认记为完成，但仍可在设置页无限次点击“重新开始教程”。不区分演习和测试模式，每次重开都删除旧的客户端本轮状态并要求六步重新执行。

教程步骤、当前目标、设施与商品上下文、基线和本轮独立统计只保存在按玩家 ID 与教程版本隔离的浏览器 `localStorage`。教程不得读取或根据 `stats.workClicks`、`stats.producedGoods`、`stats.soldGoods` 等玩家全局累计统计自动完成。教程完成后必须清除本轮步骤、统计、设施 ID、商品 ID、订单基线和运行 ID；服务器只保留当前教程版本是否已经完成，不保存步骤、重开次数或教程统计。

按钮型步骤由客户端在发出原有游戏请求前直接推进：点击工作、提交建设、点击启动和提交商品卖单均不等待服务器确认。教程判断不参与经济结果，请求失败时服务器资产保持原规则；教程不得发奖励、修改资金、库存、工厂、订单、排行榜或经济统计。生产步骤只比较本轮启动设施的 `lifetimeOutput` 与启动时基线；成交步骤只观察本轮提交卖单前不存在的新自有商品卖单是否出现 fill 或剩余数量下降。两项观察复用正式状态刷新，不得增加教程专用轮询。

设置页显示当前教程状态；隐藏只改变本地显示并保留当前进度，“显示基础教程”恢复当前轮次；“重新开始教程”只清除并新建客户端轮次、回到概览，不清除服务器完成记录和任何经济状态。首次完整完成时客户端调用一次幂等完成接口；已经完成过的玩家重复完成不再产生服务器写入。本地完成写入失败时只保留轻量待补记标记，并在下次进入时重试。

服务器使用独立表 `economy_tutorial_completions` 保存 `user_id`、`completed_version` 和 `completed_at`，通过 `GET /api/game/tutorial` 每次游戏会话读取一次，通过 `POST /api/game/tutorial/complete` 首次完成时幂等写入一次。该字段不得加入每 5 秒游戏状态分区，不得在状态轮询、隐藏、显示、重开或每一步推进时写数据库。一次性迁移标记为 `game_tutorial_completion_migration_version`，只把迁移发生时世界中已经存在的玩家记为完成；迁移后的新玩家保持未完成。''',
    '''经营成长线固定为十步：工作、建设工厂、启动工厂、完成生产、提交商品卖单、完成商品出售、开始一项产业科技研发、查看合同、完成一次银行存款、查看排行榜。前六步建立“生产—交易”基础循环，后四步把玩家继续引导到产业选择、长期协作、资产配置和四榜竞争；不得新增第十一个一级页面或独立任务资产。新玩家默认自动开启；成长线版本升级前世界中已存在的玩家通过一次性迁移默认记为完成，但仍可在设置页无限次点击“重新开始成长线”。每次重开都删除旧的客户端本轮状态并要求十步重新执行。

成长线步骤、当前目标、设施与商品上下文、基线和本轮独立统计只保存在按玩家 ID 与成长线版本隔离的浏览器 `localStorage`。成长线不得读取或根据 `stats.workClicks`、`stats.producedGoods`、`stats.soldGoods` 等玩家全局累计统计自动完成。成长线完成后必须清除本轮步骤、统计、设施 ID、商品 ID、订单基线和运行 ID；服务器只保留当前成长线版本是否已经完成，不保存步骤、重开次数或成长线统计。技术存储键、API 路由与 SQLite 表继续沿用 `tutorial` 标识，不仅为展示名称新增兼容迁移。

需要原有服务器写操作的步骤只在对应请求返回 `result.ok = true` 后推进：工作、建设、启动、商品卖单、开始研发和银行存款的失败请求均不得形成成长进度。生产步骤只比较本轮启动设施的 `lifetimeOutput` 与启动时基线；成交步骤只观察本轮成功提交卖单前不存在的新自有商品卖单是否出现 fill 或剩余数量下降。查看合同和查看排行榜只根据当前正式 `TabId` 是否实际进入对应页面推进，不要求存在公开合同、成交合同或特定排名，避免把新玩家成长线绑定到其他玩家供给。生产、成交和页面观察全部复用正式状态刷新与现有页面状态，不得增加成长线专用轮询。

设置页显示当前成长线状态；隐藏只改变本地显示并保留当前进度，“显示经营成长线”恢复当前轮次；“重新开始成长线”只清除并新建客户端轮次、回到概览，不清除服务器完成记录和任何经济状态。成长线不发放资金、商品、工厂、宝石、排行榜分数或其他经济奖励。首次完整完成时客户端调用一次幂等完成接口；已经完成过的玩家重复完成不再产生服务器写入。本地完成写入失败时只保留轻量待补记标记，并在下次进入时重试。

服务器使用独立表 `economy_tutorial_completions` 保存 `user_id`、`completed_version` 和 `completed_at`，通过 `GET /api/game/tutorial` 每次游戏会话读取一次，通过 `POST /api/game/tutorial/complete` 首次完成时幂等写入一次。该字段不得加入每 5 秒游戏状态分区，不得在状态轮询、隐藏、显示、重开或每一步推进时写数据库。一次性迁移标记继续为 `game_tutorial_completion_migration_version`：每次成长线版本提高时，只把迁移发生时世界中已经存在的玩家提升为当前完成版本；迁移后的新玩家保持未完成。''',
)
replace_once(
    page,
    '- 让工作、建设、启动或商品卖单步骤等待服务器确认后才推进，或让历史生产和历史订单自动完成本轮步骤；',
    '- 让工作、建设、启动、商品卖单、研发或银行存款步骤在服务器返回成功前推进，或让失败请求形成成长进度；让历史生产和历史订单自动完成本轮步骤；',
)
replace_all(page, '基础教程', '经营成长线', minimum=2)

server = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
replace_once(server, '按教程版本／玩家 ID 隔离的客户端本轮教程状态', '按成长线版本／玩家 ID 隔离的客户端经营成长线状态')

replace_once(
    'tests/browser/runtime-harness.tsx',
    "  totalSteps: 6,\n  statusLabel: '已完成当前版本教程',",
    "  totalSteps: 10,\n  statusLabel: '已完成当前版本经营成长线',",
)
replace_once(
    'tests/browser/runtime-harness.tsx',
    '  recordSellOrderSubmit: () => {},\n};',
    '  recordSellOrderSubmit: () => {},\n  recordResearchStart: () => {},\n  recordBankDeposit: () => {},\n};',
)

replace_once('scripts/verify-overview-content.mjs', "'基础教程显示时'", "'经营成长线显示时'")
replace_once(
    'scripts/verify-page-content.mjs',
    '| 设置 | `settings` | `SettingsPage` | 资料、偏好、基础教程控制、礼品和退出 |',
    '| 设置 | `settings` | `SettingsPage` | 资料、偏好、经营成长线控制、礼品和退出 |',
)
replace_once(
    'scripts/verify-email-registration.mjs',
    '| 设置 | `settings` | `SettingsPage` | 资料、偏好、基础教程控制、礼品和退出 |',
    '| 设置 | `settings` | `SettingsPage` | 资料、偏好、经营成长线控制、礼品和退出 |',
)

product_text = Path(product).read_text(encoding='utf-8')
page_text = Path(page).read_text(encoding='utf-8')
if '不可用宝石加速' in product_text:
    raise SystemExit('PRODUCT_AND_GAMEPLAY_DESIGN.md still contains obsolete no-gem research rule')
if '4 木材与 2 铁矿石' in product_text:
    raise SystemExit('PRODUCT_AND_GAMEPLAY_DESIGN.md still contains retired starter material pack')
if '固定为十步' not in page_text:
    raise SystemExit('PAGE_CONTENT_AND_NAVIGATION_DESIGN.md missing ten-step operating growth line')
