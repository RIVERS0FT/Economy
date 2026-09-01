from pathlib import Path

path = Path('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md')
text = path.read_text()

def replace(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'missing {label}')
    text = text.replace(old, new, 1)

replace(
    '- 三类合同领域：长期商品供货、玩家抵押借贷、工厂使用权租赁，以及对应托管、抵押、保证金、宽限期、周期结算与追加式合同审计；',
    '- 三类合同领域：地区化商品供货（含旧批次兼容）、玩家抵押借贷、工厂使用权租赁，以及对应当日额度托管／旧批次托管、抵押、保证金、旧兼容宽限、周期／到期结算与追加式合同审计；',
    'authority contract list',
)
replace(
    '- `contract-runtime-index.js`：合同 ID、公开／进行中数量、参与者集合、采购方下一批仓库预占和最近到期时间的事务内派生索引；',
    '- `contract-runtime-index.js`：旧有限批次／市场储备合同的合同 ID、公开／进行中数量、参与者集合、采购方下一批仓库预占和最近到期时间的事务内派生索引；每日额度合同不建立“下一批”仓库预占；',
    'runtime index registry',
)
replace(
    '每次合同处理、合同动作或合同客户端序列化只能对 `productionContracts` 建立一次 `contract-runtime-index.js` 派生索引；采购方下一批仓库预占、公开合同数量、参与者进行中合同数量和合同 ID 查询必须读取该索引，不得在每份合同容量检查中再次遍历全部合同或建立第二个运行索引。合同进入或离开 `active` 状态、完成批次、过期、取消或终止时必须同步刷新索引计数；同一工作世界的合同数组引用、长度和末项未变化时必须复用同一索引，避免仓库、合同与调度查询重复线性构建。索引不进入世界 JSON、客户端分区、分区哈希或 SQLite，事务回滚后直接丢弃。',
    '旧有限批次／市场储备合同的处理、动作或客户端序列化只能对旧合同视图建立一次 `contract-runtime-index.js` 派生索引；采购方下一批仓库预占、旧公开合同数量、旧参与者进行中合同数量和合同 ID 查询必须读取该索引，不得在每份旧合同容量检查中再次遍历全部合同。旧合同进入或离开 `active` 状态、完成批次、过期、取消或终止时必须同步刷新索引计数；索引不进入世界 JSON、客户端分区、分区哈希或 SQLite，事务回滚后直接丢弃。每日额度商品合同由 `daily-supply-contracts.js` 的地区＋商品＋参与方条件直接派生当日额度和托管状态，不得伪造“下一批仓库预占”，也不得为了兼容旧索引重复建立第二个全合同索引。',
    'legacy index paragraph',
)
replace(
    '合同审计必须同时区分新每日额度事件与旧兼容事件。每日额度合同覆盖发布、承接、议价、自动准备／补款设置变化、手动准备／补款、每次真实部分交付、北京时间跨日释放与重置、当前日结束申请、有限合同到期、立即违约终止和保证金赔付；交付事件必须记录真实 `lastDeliveryQuantity / lastDeliveryGross / lastDeliveryFee`，不得把每日上限伪装成实际交付量。',
    '合同审计必须同时区分新每日额度事件与旧兼容事件。每日额度合同的追加式审计覆盖发布、承接、议价、自动准备／补款设置变化、手动准备／补款、每次真实部分交付、当前日结束申请、有限合同到期、立即违约终止和保证金赔付；北京时间跨日的未用额度释放与重置属于权威状态推进，当前不伪造独立审计事件。交付事件必须记录真实 `lastDeliveryQuantity / lastDeliveryGross / lastDeliveryFee`，不得把每日上限伪装成实际交付量。',
    'daily audit truth',
)

path.write_text(text)
