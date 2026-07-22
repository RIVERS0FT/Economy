from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, got {count}: {old[:100]!r}')
    write(path, text.replace(old, new, 1))


def replace_regex(path, pattern, replacement, flags=re.S):
    text = read(path)
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{path}: regex expected one match, got {count}: {pattern[:100]!r}')
    write(path, next_text)


versioned = [
    'docs/README.md',
    'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
    'docs/WAREHOUSE_EXPANSION_DESIGN.md',
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
]
for path in versioned:
    text = read(path)
    text = text.replace('> 更新时间：2026-07-21', '> 更新时间：2026-07-22')
    text = text.replace('> 更新时间：2026-07-20', '> 更新时间：2026-07-22')
    text = text.replace('> 客户端状态版本：15', '> 客户端状态版本：16')
    text = text.replace('> 世界状态版本：13', '> 世界状态版本：14')
    text = text.replace('> 市场需求模型版本：6', '> 市场需求模型版本：7')
    write(path, text)

# Root README: replace version and core economic rules without adding a parallel legacy section.
path = 'README.md'
text = read(path)
text = text.replace('- 客户端状态版本：`15`', '- 客户端状态版本：`16`')
text = text.replace('- 世界状态版本：`13`', '- 世界状态版本：`14`')
text = text.replace('- 市场需求模型版本：`6`', '- 市场需求模型版本：`7`')
text = text.replace(
    '- 食品市场基础预算为 3,000／5 分钟，家庭消费市场基础预算为 2,700／5 分钟；预算按近 7 天经济活跃玩家平方根增长，最多 6 倍，只使用玩家之间的真实成交活跃度和上一完整周期服务得分调整；没有活跃玩家时不发布新的消费需求订单。',
    '- 消费需求由基础人口、技术人口和专业人口三个真实账户提供资金；每类人口根据收入、储蓄和消费状态计算五分钟预算，不再按活跃玩家数量、库存价值或成交活跃度发行预算。'
)
text = text.replace(
    '- 每组消费需求周期预算中 70% 用于最终消费的直接需求，30% 用于沿正式配方反向推导的派生流动性；上一周期全部实际成交、成交延迟与积压在新周期开始时统一结算，未成交需求最多保留两个周期且按 35% 衰减，新预算按 50%／30%／20% 发布三档买盘，不再固定阶梯追价。',
    '- 三类人口使用真实余额和冻结资金；每类人口周期预算中 70% 用于最终消费的直接需求，30% 用于沿正式配方反向推导的派生流动性。人口订单成交只转移已有货币，部分成交退回价差，撤单释放剩余冻结资金，人口消费成交不再发行普通货币。'
)
text = text.replace(
    '- 新世界首次状态处理和模型 3 升级通过 `marketDemand.modelVersion = 4` 初始化消费需求与双边市场储备；模型 5 升级到 6 时删除旧系统商品订单、释放储备冻结资金和库存，并按周期末结算、三档需求曲线、双向供需压力和严格非交叉规则重建系统盘口，玩家订单和玩家资产保持不变，世界版本继续保持 13。',
    '- 市场需求模型 7 撤销旧的无资金消费订单并建立三类人口真实钱包；迁移启动资金只执行一次。双边市场储备继续使用既有真实资金与库存，玩家订单和玩家资产保持不变，世界版本为 14。'
)
text = text.replace(
    '- 商品初始参考价、生产数量、周期秒数和周期成本全部保持整数；参考分钟利润按工厂复杂度固定为 C1=1、C2=3、C3=6、C4=9、C5=12、C6=15、C7=18。',
    '- 商品初始参考价、生产数量、周期秒数和周期成本全部保持整数；周期成本就是完整周期的运营就业工资总额，参考分钟利润按工厂复杂度固定为 C1=1、C2=3、C3=6、C4=6、C5=8、C6=10、C7=12。'
)
text = text.replace(
    '- 玩家通过统一订单簿卖出商品或工厂时，按单张卖单累计成交总额收取 1% 手续费，向上取整且最低为 1；买方仍支付成交总额，卖方获得扣费后净额，手续费由系统回收。卖给消费需求或市场储备买单同样收费；从市场储备卖单买入时玩家不是卖方，拍卖仍不收取该手续费。',
    '- 玩家通过统一订单簿卖出商品或工厂时，按单张卖单累计成交总额精确收取 1% 手续费，使用向下取整的累计差额且不设最低手续费；手续费按基础人口 20%、技术人口 60%、专业人口 20% 形成市场服务就业收入。'
)
text = text.replace(
    '- 共享仓库允许无限扩容；当前等级 `L` 的容量增量为 `250 + 50 × (L - 1)`，扩容费用为 `150 + ceil((当前实际总容量 - 500) × 0.6)`，费用由服务器按实际容量计算。',
    '- 共享仓库允许无限扩容；当前等级 `L` 的容量增量为 `250 + 50 × (L - 1)`，扩容费用为 `150 + ceil((当前实际总容量 - 500) × 0.6)`，费用按基础人口 50%、技术人口 40%、专业人口 10% 形成仓储建设就业收入。'
)
anchor = '- 工作冷却固定为 3 秒，不随连续工作次数增加。'
addition = '''- 工作冷却固定为 3 秒，不随连续工作次数增加；每次有效点击继续直接发行新普通货币，不读取通胀、全服货币量或玩家资产。\n- 商店兑换继续按固定汇率直接发行普通货币，不使用有限准备金；礼品码和管理员发放也按各自规则记录发行。系统不设置人口侧货币回收、余额衰减、发行总量上限或自动通胀控制。\n- 玩家支付的生产周期成本、工厂建造费、仓库扩容费和市场卖出手续费全部转为人口就业收入。建造业不区分工厂复杂度，固定按基础人口 60%／技术人口 30%／专业人口 10% 分配；生产运营岗位按 C1～C7 复杂度分配。\n- 市场页面不得增加人口经济区域；管理员“概况”内增加只读人口经济区域，展示三类人口钱包、就业来源、施工托管、生产复杂度工资和货币发行统计。'''
if anchor not in text:
    raise RuntimeError('README work anchor missing')
text = text.replace(anchor, addition, 1)
write(path, text)

# Product/gameplay: authoritative issuance, employment transfers, funded demand, model preferences and no inflation controls.
replace_regex(
    'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
    r'## 4\. 普通货币来源与回收\n.*?\n## 5\. 消费需求、市场储备与价格传导',
    '''## 4. 普通货币发行、就业转移与开放式扩张\n\n普通货币发行来源：\n\n1. 玩家每次有效工作点击；\n2. 商店以宝石或正式兑换资产兑换普通货币；\n3. 礼品码奖励；\n4. 管理员明确发放与版本迁移一次性发放。\n\n工作每次有效点击继续直接发行新普通货币，只受服务器 3 秒冷却、幂等键和正常接口校验约束；不得根据玩家资产、价格指数、全服货币量或通胀状态降低奖励。商店兑换普通货币继续直接发行新货币，不使用有限准备金、每日发行额度或动态汇率。\n\n以下费用不再是系统回收，必须完整转为人口就业收入：\n\n- 工厂完整生产周期成本：按工厂 C1～C7 复杂度岗位结构分配；\n- 工厂建造费：建造业不区分复杂度，固定按基础人口 60%、技术人口 30%、专业人口 10% 分配，并按施工进度释放；\n- 共享仓库扩容费：固定按基础人口 50%、技术人口 40%、专业人口 10% 分配；\n- 统一订单簿玩家卖出手续费：按累计成交额精确收取 1%，不设最低手续费，固定按基础人口 20%、技术人口 60%、专业人口 20% 分配。\n\n生产、建设、扩容、手续费、玩家交易、市场储备交易和人口消费都只转移已有普通货币。人口消费不得增加 `populationIssued`，卖方获得人口真实冻结资金；生产和服务就业使用 `income`／`transferred` 统计，不得记为 `issued`。\n\n系统不设置人口侧货币回收、人口税、公共服务扣款、余额衰减、储蓄过期、货币总量上限或自动通胀控制。持续货币扩张属于正式设计结果；服务器只负责区分发行和转移、保证整数安全、幂等与资金一致。历史 `populationIssued` 和 `systemSinks` 只保留旧世界审计，模型 7 上线后的上述行为不得继续增加它们。\n\n## 5. 消费需求、市场储备与价格传导'''
)
replace_regex(
    'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
    r'### 5\.1 定义与兼容边界\n.*?\n### 5\.3 周期末服务结算与需求曲线',
    '''### 5.1 三类人口账户与兼容边界\n\n商品订单只允许玩家订单、消费需求订单和市场储备订单。消费需求固定分为 `food` 食品市场和 `household` 家庭消费市场，只创建买单并在成交后消费商品；市场储备继续使用独立真实资金池和商品库存，同时创建商品买单与卖单。\n\n人口经济固定包含三个服务器权威账户：\n\n| 人口模型 | 经济角色 | 正常食品／家庭预算 | 边际消费倾向 | 目标储蓄 | 超额储蓄释放 |\n|---|---|---:|---:|---:|---:|\n| 基础人口 `basic` | 普通劳动、生产操作、施工和物流 | 78%／22% | 95% | 0.5 个收入周期 | 每周期 5% |\n| 技术人口 `skilled` | 熟练工、设备操作、维修和商业服务 | 58%／42% | 85% | 1.5 个收入周期 | 每周期 3% |\n| 专业人口 `professional` | 工程、研发、专业管理和高级服务 | 38%／62% | 72% | 3 个收入周期 | 每周期 2% |\n\n每类账户保存 `credits`、`frozenCredits`、按来源待结算收入、收入 EMA、近期峰值、连续无收入周期、消费状态和累计收入／消费。人口资金不会过期、衰减或被系统回收。\n\n持久化继续使用 `ownerType = 'population'` 作为消费需求与市场储备兼容标识。消费订单内部增加 `populationModelId` 和 `fundingPool = direct | derived`；普通玩家 API 必须连同 `ownerType`、`ownerName`、`demandGroupId`、`demandTier` 一并删除这些字段，市场页面不得显示人口来源。\n\n### 5.2 真实预算、冻结资金与消费状态\n\n每五分钟先把生产、建造、仓储和市场服务待结算收入转入对应人口钱包，再按每类人口独立计算可消费预算：\n\n```text\n目标储蓄 = 收入 EMA × 目标储蓄周期\n基础消费 = 收入 EMA × 边际消费倾向\n超额储蓄释放 = max(0, 可用资金 - 目标储蓄) × 释放比例\n周期预算 = min(可用资金, 基础消费 + 超额储蓄释放)\n```\n\n预算只控制消费速度，不删除或回收余额。单周期预算最多上涨 15%、下降 20%。预算按该模型的食品／家庭比例分组后，每组固定拆分为 70% 直接最终需求与 30% 派生流动性。直接和派生订单都必须先从所属人口 `credits` 转入 `frozenCredits`；成交按 maker price 支出并退回限价差额，撤单或订单缩量释放未成交冻结资金。任何人口新增订单的已提交金额不得超过其真实可用余额。\n\n人口消费状态按 `incomeEma / recentPeakIncome` 判断：不低于 75% 为正常，35%～75% 为谨慎，低于 35% 或连续两个周期没有收入为生存。模型身份不会互相转换；收入下降只改变食品／家庭比例和类别偏好。谨慎状态降低家居和耐用品，生存状态将电子产品与家电份额降为 0，优先主食、蛋白质、纸品和基础穿着。\n\n### 5.3 周期末服务结算与需求曲线'''
)
replace_regex(
    'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
    r'食品市场：\n.*?\n同一商品可以出现在多个类别',
    '''各人口模型在正常状态下的类别份额：\n\n| 人口 | 主食 | 蛋白质 | 新鲜与饮品 | 便利食品 |\n|---|---:|---:|---:|---:|\n| 基础人口 | 50% | 25% | 10% | 15% |\n| 技术人口 | 35% | 30% | 15% | 20% |\n| 专业人口 | 20% | 30% | 25% | 25% |\n\n| 人口 | 家居 | 穿着 | 日用消耗 | 耐用消费 |\n|---|---:|---:|---:|---:|\n| 基础人口 | 20% | 35% | 35% | 10% |\n| 技术人口 | 25% | 25% | 25% | 25% |\n| 专业人口 | 20% | 20% | 10% | 50% |\n\n食品类别商品保持主食（小麦、水稻、面粉、食品）、蛋白质（肉、蛋、奶、鱼类）、新鲜与饮品（水果、奶、饮料）、便利食品（食品、预制餐）；家庭类别保持家居（家具）、穿着（服装）、日用消耗（纸品）、耐用消费（电子产品、家电）。类别内部继续按相对有效价格、可购性和替代弹性分配。\n\n同一商品可以出现在多个类别'''
)
text = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md')
text = text.replace('替代品总预算保持不变，一种商品涨价只能重新分配同一预算，不能扩大系统发行。', '替代品总预算保持不变，一种商品涨价只能重新分配同一人口钱包预算，不能创造货币。')
text = text.replace('派生流动性只使用本组 30% 预算。直接需求与派生需求当期新增买单之和不得超过本组总预算；新增商品和工厂不得自动提高食品市场 3,000 或家庭消费市场 2,700 的基础预算。', '派生流动性只使用每类人口在本组预算中的 30%。直接需求与派生需求当期新增买单之和不得超过该人口真实预算；新增商品、工厂、库存、玩家数量或成交活跃度不得自动创造消费资金。')
text = text.replace('模型 4 首次初始化时，食品市场和家庭消费市场分别获得等于自身基础周期预算的 3,000 与 2,700 储备资金。', '市场储备历史初始化时，食品市场和家庭消费市场分别获得 3,000 与 2,700 的一次性储备资金。')
text = text.replace('模型 5 只迁移和继续使用现有储备资产', '后续模型只迁移和继续使用现有储备资产')
text = text.replace('模型 5 升级到 6', '模型 6 升级到 7')
text = text.replace('marketDemand.modelVersion = 6', 'marketDemand.modelVersion = 7')
write('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', text)

# Industry catalog and employment rules.
path = 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md'
text = read(path)
text = text.replace('正式梯度固定为 C1=1、C2=3、C3=6、C4=9、C5=12、C6=15、C7=18。复杂度不得改变市场需求预算。', '正式梯度固定为 C1=1、C2=3、C3=6、C4=6、C5=8、C6=10、C7=12。复杂度决定生产运营就业结构，但不得直接创造市场需求预算。')
for old, new in [
    ('| 塑料 (`plastic`) | 30 | 2 原油 → 1 塑料 | 40 秒 | 6 | 9 |', '| 塑料 (`plastic`) | 30 | 2 原油 → 1 塑料 | 40 秒 | 8 | 6 |'),
    ('| 饮料 (`beverage`) | 18 | 1 砂糖 + 1 奶 → 2 饮料；或 2 水果 + 1 砂糖 → 2 饮料 | 60 秒 | 11；或 6 | 9 |', '| 饮料 (`beverage`) | 18 | 1 砂糖 + 1 奶 → 2 饮料；或 2 水果 + 1 砂糖 → 2 饮料 | 60 秒 | 14；或 9 | 6 |'),
    ('| 家具 (`furniture`) | 24 | 2 木板 → 2 家具 | 60 秒 | 5 | 9 |', '| 家具 (`furniture`) | 24 | 2 木板 → 2 家具 | 60 秒 | 8 | 6 |'),
    ('| 服装 (`clothing`) | 55 | 2 纺织品 → 1 服装 | 60 秒 | 6 | 9 |', '| 服装 (`clothing`) | 55 | 2 纺织品 → 1 服装 | 60 秒 | 9 | 6 |'),
    ('| 机械 (`machinery`) | 76 | 2 钢材 → 1 机械 | 60 秒 | 6 | 12 |', '| 机械 (`machinery`) | 76 | 2 钢材 → 1 机械 | 60 秒 | 10 | 8 |'),
    ('| 电子产品 (`electronics`) | 84 | 1 塑料 + 1 铜材 → 1 电子产品 | 60 秒 | 10 | 15 |', '| 电子产品 (`electronics`) | 84 | 1 塑料 + 1 铜材 → 1 电子产品 | 60 秒 | 15 | 10 |'),
    ('| 家电 (`appliance`) | 92 | 1 机械 + 1 电子产品 → 2 家电 | 60 秒 | 6 | 18 |', '| 家电 (`appliance`) | 92 | 1 机械 + 1 电子产品 → 2 家电 | 60 秒 | 12 | 12 |'),
    ('| 参考分钟利润 | 1 | 3 | 6 | 9 | 12 | 15 | 18 |', '| 参考分钟利润 | 1 | 3 | 6 | 6 | 8 | 10 | 12 |'),
]:
    if old not in text:
        raise RuntimeError(f'industry missing: {old}')
    text = text.replace(old, new)
text = text.replace('乳制饮料、果汁饮料和家具的周期成本分别固定为 11、6、5，不得回退到 10、5、4。', '乳制饮料、果汁饮料和家具的周期成本分别固定为 14、9、8；机械、电子产品和家电分别固定为 10、15、12。周期成本不得与人口工资分离成第二套参数。')
insert = '''\n### 2.1 周期成本与人口运营就业\n\n每个完整成功周期的运营就业工资总额严格等于当前配方周期成本乘 `participatingCount`。资金、原料、仓库或运行条件任一不满足时，不扣周期成本、不产生工资、不产出商品。\n\n| 复杂度 | 基础人口 | 技术人口 | 专业人口 |\n|---|---:|---:|---:|\n| C1 | 90% | 9% | 1% |\n| C2 | 78% | 20% | 2% |\n| C3 | 55% | 40% | 5% |\n| C4 | 30% | 60% | 10% |\n| C5 | 18% | 55% | 27% |\n| C6 | 10% | 40% | 50% |\n| C7 | 5% | 25% | 70% |\n\n整数工资使用最大余数法分配，三类人口新增收入之和必须精确等于玩家实际支付的周期成本。\n\n### 2.2 建造业就业\n\n工厂复杂度只决定建造费总额、施工时间和建成后的运营岗位，不改变建造业就业比例。所有工厂建造费固定按基础人口 60%、技术人口 30%、专业人口 10% 分配。玩家开工时一次性支付并进入施工就业托管，服务器按 `floor(建造费 × 已施工时间 ÷ 总施工时间)` 逐步释放，完成时释放全部整数余数。模型 7 上线前已经支付的施工费不得追溯补发。\n'''
anchor = '\n完整产业链：'
if anchor not in text:
    raise RuntimeError('industry chain anchor missing')
text = text.replace(anchor, insert + anchor, 1)
text = text.replace('### 2.1 建造复杂度、施工时间与系统价值', '### 2.3 建造复杂度、施工时间与系统价值')
write(path, text)

# Warehouse employment.
path = 'docs/WAREHOUSE_EXPANSION_DESIGN.md'
text = read(path)
text = text.replace('- 扩容费用由系统回收并计入 `stats.systemSinks`。', '- 扩容费用不再回收，完整转入人口就业：基础人口 50%、技术人口 40%、专业人口 10%。')
text = text.replace('本次定价规则切换不补收或退还历史扩容费用，不修改已有等级、容量、库存和订单；新公式只影响上线后的下一次扩容。', '本次定价与就业规则切换不补收、退还或追溯分配历史扩容费用，不修改已有等级、容量、库存和订单；模型 7 上线后的每次扩容费在同一事务转入人口待结算收入。')
write(path, text)

# Order-book internal funded fields and exact fee employment.
path = 'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md'
text = read(path)
text = text.replace("  demandCycleId?: number;\n", "  demandCycleId?: number;\n  populationModelId?: 'basic' | 'skilled' | 'professional';\n  fundingPool?: 'direct' | 'derived';\n")
text = text.replace('消费需求订单不冻结玩家资金；当期新增订单受服务器周期预算约束，按规则保留的旧订单属于此前周期已提交预算。', '消费需求订单不冻结玩家资金，但必须从所属 `populationModelId` 的真实人口可用余额转入冻结资金；直接与派生资金池通过 `fundingPool` 标记。成交退回限价与 maker price 的差额，撤单或缩量释放未成交冻结资金。')
text = text.replace('资产适配器只允许负责自身业务结算与行情记录：商品适配器转移玩家库存、消费需求预算和市场储备资产；', '资产适配器只允许负责自身业务结算与行情记录：商品适配器转移玩家库存、真实人口冻结资金和市场储备资产；')
old_fee = '''手续费按单张卖单自规则启用后的累计成交总额计算，而不是对每条 fill 重复应用最低值：\n\n```text\n累计应收手续费 = max(1, ceil(累计成交总额 × 1%))\n本次 fill 手续费 = 累计应收手续费 - 此前累计已收手续费\n本次卖方实收 = 本次成交总额 - 本次 fill 手续费\n```\n\n累计成交总额为 0 时手续费为 0。成交额 1～100 的单张卖单累计手续费为 1，101～200 为 2；同一卖单拆成 30、30、40 三次成交时只在第一笔收取 1，再成交 1 时补收 1。每张新卖单独立应用最低手续费，撤销未成交部分不收费。\n\n`fill.total` 始终保持成交总额，卖方 fill 的 `fee` 表示本笔增量手续费，`netTotal` 表示本笔实际到账；买方公开 fill 的 `fee` 为 0，`netTotal` 等于 `total`。兼容统计字段 `populationIssued` 继续记录市场需求成交总额，手续费进入卖方 `stats.systemSinks`，因此净货币变化等于发行总额减手续费。\n\n上线迁移不得追收既有成交：旧卖单第一次发生新成交时，已有 fill 统一标记 `fee = 0`、`netTotal = total`，累计字段从 0 开始，只对启用后的新 fill 收费。服务器必须在同一成交事务完成扣费、fill 标记和系统回收，重复序列化、幂等重试或状态轮询不得重复扣费。'''
new_fee = '''手续费按单张卖单自规则启用后的累计成交总额精确计算，不设置最低手续费：\n\n```text\n累计应收手续费 = floor(累计成交总额 × 1%)\n本次 fill 手续费 = 累计应收手续费 - 此前累计已收手续费\n本次卖方实收 = 本次成交总额 - 本次 fill 手续费\n```\n\n累计成交额不足 100 时手续费为 0；累计达到 100 时收取 1，达到 200 时累计收取 2。拆单或部分成交不能改变同一卖单的累计费率。\n\n`fill.total` 始终保持成交总额，卖方 fill 的 `fee` 表示本笔增量手续费，`netTotal` 表示本笔实际到账。手续费不再进入 `systemSinks`，而是按基础人口 20%、技术人口 60%、专业人口 20% 转入市场服务待结算收入。人口消费成交从真实人口冻结资金支付，禁止增加 `populationIssued`。\n\n上线迁移不得追收既有成交：旧卖单第一次发生新成交时，已有 fill 保留原值，V2 累计字段从 0 开始，只对启用后的新 fill 收费。服务器必须在同一成交事务完成扣费、就业转移和 fill 标记，幂等重试或状态轮询不得重复扣费。'''
if old_fee not in text:
    raise RuntimeError('order book fee block missing')
text = text.replace(old_fee, new_fee)
privacy = '''\n### 1.1 人口资金字段隐私\n\n`populationModelId` 与 `fundingPool` 只用于服务器持久化、冻结和结算。集中式公开订单序列化必须删除这两个字段，并继续删除所有订单来源、需求组和角色字段；普通玩家、本地成交记录和市场页面不得判断订单属于哪类人口。\n'''
text = text.replace('\n## 2. 下单与冻结', privacy + '\n## 2. 下单与冻结', 1)
write(path, text)

# Documentation index responsibilities and anti-regression rule.
path = 'docs/README.md'
text = read(path)
text = text.replace('产品定位、核心循环、工作冷却、普通货币与宝石、邀请奖励、商店兑换、货币来源回收、需求与排行榜目标', '产品定位、核心循环、工作冷却、普通货币与宝石、直接货币发行、人口就业收入、三类人口真实钱包、消费需求与排行榜目标')
text = text.replace('31 种商品、21 种工厂、整数经济数值、参考利润、持续生产、通用工厂配方、生产周期、三态、自动恢复和生产页面结构', '31 种商品、21 种工厂、整数经济数值、参考利润、周期成本工资、生产复杂度岗位结构、固定建造业岗位结构、持续生产、三态和自动恢复')
text = text.replace('统一订单簿玩家卖出手续费、按卖单累计部分成交、最低手续费、人口需求成交、匿名 `fee/netTotal`、系统回收和拍卖豁免属于', '统一订单簿玩家卖出手续费、按卖单累计精确 1%、人口真实冻结资金、匿名 `fee/netTotal`、市场服务就业和拍卖豁免属于')
text = text.replace('消费需求订单、周期末成交结算、玩家成交活跃度、三档需求曲线、双向供需压力、库存与资金守恒的双边市场储备、活跃玩家动态预算、生产链双向滞后价格传导和迁移清理属于', '消费需求订单、三类人口真实钱包、就业收入、真实冻结资金、周期末成交结算、三档需求曲线、双向供需压力、库存与资金守恒的双边市场储备、生产链双向滞后价格传导和迁移清理属于')
text = text.replace('商店固定汇率、单向兑换、兑换幂等与独立页面属于', '商店固定汇率、单向兑换、直接货币发行、兑换幂等与独立页面属于')
marker = '30. '
new_rule = '30. 人口就业收入、三类人口真实钱包、生产复杂度岗位结构、固定建造业岗位结构、施工托管、仓储与市场服务就业、人口消费不得发行、工作与商店兑换直接发行、不设置人口回收或通胀控制属于产品、产业、订单簿、仓库、管理员与服务器共同规则；必须同步更新对应文档、测试和人口经济验证。\n'
if new_rule not in text:
    text += '\n' + new_rule
write(path, text)

# Admin overview only; no sixth section and no controls.
path = 'docs/GIFT_CODE_AND_ADMIN_DESIGN.md'
text = read(path)
text = text.replace('本次属于加法迁移，不提高世界版本 13 或客户端状态版本 15。', '资产包结构继续兼容；当前世界版本统一为 14，客户端状态版本为 16。')
text = text.replace('- 世界概况；', '- 世界概况，并在概况内部提供只读“人口经济”区域；')
admin_rule = '''\n### 5.1 人口经济概况\n\n管理员导航仍固定为五分区，不新增“人口经济”第六分区。人口经济区域位于“概况”现有世界指标下方，只读展示：三类人口可用／冻结／待结算资金、收入状态、食品／家庭预算、施工就业托管、生产／建造／仓储／市场服务累计收入、C1～C7 生产工资和工作／商店兑换／礼品／迁移发行统计。\n\n后台不得提供修改人口余额、就业比例、消费状态、工作发行、商店发行或通胀控制的按钮。管理员刷新复用现有概况接口和刷新按钮，不增加独立轮询。市场页面不得复用或展示该区域。\n'''
if '### 5.1 人口经济概况' not in text:
    text = text.replace('\n## 6.', admin_rule + '\n## 6.', 1)
write(path, text)

# Page responsibilities: market unchanged except exact fee wording; population only in admin overview.
path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
text = read(path)
text = text.replace('预计手续费（1%，最低 1）', '预计手续费（累计成交额的 1%）')
page_rule = '''\n### 市场与管理员人口经济边界\n\n市场页面不得增加人口经济区域、人口账户、就业来源、人口模型标签或资金池标签，只显示匿名订单深度、价格、玩家自己的订单与成交。管理员统一后台仍使用“概况／社区／藏品／礼品码／账号封禁”五分区，人口经济只放在管理员“概况”内部。\n'''
if '### 市场与管理员人口经济边界' not in text:
    text += page_rule
write(path, text)

# Server architecture: append single authoritative runtime section and neutralize stale model/version wording.
path = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
text = read(path)
text = text.replace('市场需求模型 5 升级到 6', '市场需求模型 6 升级到 7')
text = text.replace('marketDemand.modelVersion = 6', 'marketDemand.modelVersion = 7')
text = text.replace('世界版本 13', '世界版本 14')
server_rule = '''\n## 人口经济与货币事务\n\n`server/src/population-economy.js` 是三类人口钱包、整数就业分配、施工进度释放、收入 EMA、消费状态、真实人口订单冻结和管理员摘要的唯一实现。市场需求模型 7 必须遵守：\n\n- 工作每次有效点击和商店兑换继续直接发行普通货币，不使用准备金，也不根据通胀自动调整；\n- 生产周期成本、建造费、仓库扩容费和玩家卖出手续费只转移已有货币到人口；\n- 建造业固定 60%／30%／10%，不得读取工厂复杂度改变比例；生产岗位按 C1～C7 分配；\n- 人口消费不得发行普通货币，必须从真实 `credits` 转入 `frozenCredits` 后结算；\n- 不存在人口侧税费、回收、余额衰减、储蓄过期或货币总量控制；\n- `populationModelId` 和 `fundingPool` 必须由单一公开订单序列化函数删除；\n- 世界版本 14、客户端状态版本 16、市场需求模型 7 的迁移只执行一次人口启动发行，旧施工费不得追溯补发；\n- `issued` 只用于工作、兑换、礼品、管理员和迁移发行；就业与人口消费使用 `income`／`transferred` 统计。\n\n管理员 `/api/game/admin/summary` 在同一世界事务返回只读人口经济摘要；玩家市场状态不得包含管理员人口指标。\n'''
if '## 人口经济与货币事务' not in text:
    text += server_rule
write(path, text)

# Local log version already updated; ensure hidden population fields are explicitly forbidden.
path = 'docs/LOCAL_ACTIVITY_LOG_DESIGN.md'
text = read(path)
if 'populationModelId' not in text:
    text += '\n人口订单的 `populationModelId` 与 `fundingPool` 属于服务器私有字段，不得进入浏览器本地订单或成交快照。隐藏页面列但继续在 API 或 localStorage 中保留来源信息同样属于违规。\n'
write(path, text)

# Market fee verification text now points at exact fee and employment transfer.
path = 'scripts/verify-market-sell-fee.mjs'
text = read(path)
text = text.replace("['README.md', '按单张卖单累计成交总额收取 1% 手续费']", "['README.md', '按单张卖单累计成交总额精确收取 1% 手续费']")
text = text.replace("['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '玩家卖出手续费']", "['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '不设最低手续费']")
text = text.replace("['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '单张卖单自规则启用后的累计成交总额']", "['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '累计成交总额精确计算']")
write(path, text)

Path('scripts/apply-population-economy-v7-docs.py').unlink()
Path('.github/workflows/apply-population-economy-v7-docs.yml').unlink()
