from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA = '50908210733c9cbff24ad81c9a396a2ce2758bd3'
SOURCE_ROOT = f'https://raw.githubusercontent.com/RIVERS0FT/Economy/{SOURCE_SHA}'

COPY_PATHS = [
    'scripts/verify-asset-auctions.mjs',
    'scripts/verify-authoritative-countdowns.mjs',
    'scripts/verify-navigation-badges.mjs',
    'server/src/asset-auctions.js',
    'server/test/asset-auctions.test.js',
    'src/auctions/types.ts',
    'src/components/shell/GameShell.tsx',
    'src/hooks/useNavigationBadges.ts',
    'src/navigation/navigationBadges.ts',
    'src/pages/AuctionPage.tsx',
    'src/styles/asset-auctions.css',
]


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    return source.replace(old, new, 1)


for path in COPY_PATHS:
    with urlopen(f'{SOURCE_ROOT}/{path}', timeout=30) as response:
        content = response.read().decode('utf-8')
    (ROOT / path).write_text(content, encoding='utf-8')

# Reapply auction authority to the latest main document, preserving the contract and production changes.
doc_path = ROOT / 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
doc = doc_path.read_text(encoding='utf-8')
doc = replace_once(
    doc,
    '| 拍卖 | `auction` | `AuctionPage` | 商品与工厂资产包竞价及结算结果 |',
    '| 拍卖 | `auction` | `AuctionPage` | 商品与工厂资产包发布及进行中竞价 |',
    'auction responsibility row',
)
auction_intro = '页面主标题固定为“拍卖”。发布区使用资产包编辑器，而不是只能选择单一类型的提交表单。玩家可以在商品／工厂分段选择器间切换并连续加入资产；切换类型不得清空已加入项目。单项拍卖也是只有一项的资产包，规范化后最多 20 项。同种商品或工厂重复加入时合并数量，两种类型都必须使用可编辑的正整数数量草稿。\n\n'
auction_rules = (
    auction_intro
    + '桌面拍卖工作区固定为左右两列：左列“发起拍卖”承载完整资产包编辑器、参数、费用预览与发布操作，右列“正在进行的拍卖”承载所有开放拍卖；内容宽度不足时按“发起拍卖／正在进行的拍卖”顺序降为单列，不得增加两列独立滚动区。玩家页不展示已成交、流拍、取消或结算异常等已结束拍卖；服务器结算、SQLite 审计和管理员诊断仍完整保留。\n\n'
    + '进行中拍卖固定按关注级别排序：玩家已出价但当前不是最高竞买人的“被超价”最先，本次进入拍卖页时尚未读过的“新增”其次，其他已读拍卖最后；同时满足新增与被超价时只归入被超价。每组内部按 `latestBidAt ?? createdAt` 降序，再按拍卖 ID 稳定排序。被超价使用明确危险状态文字，新增使用明确成功状态文字，已读不显示标签；颜色不得成为唯一表达。打开拍卖页只清除导航中的新拍卖角标，本次访问捕获的新增标签必须保留到离开页面，停留期间新出现的拍卖也加入本次访问新增集合。服务器只下发玩家维度的 `isOutbid` 布尔值，不得为排序或标签下发完整出价数组、竞买人 ID、真实姓名或内部参与者映射。\n\n'
)
doc = replace_once(doc, auction_intro, auction_rules, 'auction layout rules')
doc = replace_once(
    doc,
    '页面标题区不得重复显示与分区标题相同的进行中数量；零场不是警告状态。“进行中的拍卖”空状态不得再嵌套第二层 `Panel`。',
    '页面标题区不得重复显示与右列分区标题相同的进行中数量；零场不是警告状态。“正在进行的拍卖”空状态不得再嵌套第二层 `Panel`。',
    'auction section heading rule',
)
doc = replace_once(
    doc,
    '最近结束区域必须始终存在，没有记录时显示紧凑空状态，不能直接删除整个区域；成交结果对卖方显示成交手续费与实际到账，流拍结果区分无人出价、未达保留价、卖方取消和结算异常。',
    '玩家拍卖页不得渲染最近结束或历史结算区域；成交手续费、实际到账、无人出价、未达保留价、卖方取消和结算异常继续由服务器结算、权威审计与管理员诊断记录，不得为了隐藏玩家历史而删除或缩减结算数据。',
    'ended auction visibility rule',
)
doc = replace_once(
    doc,
    '“发布资产包拍卖”和“最近结束”属于拍卖页同一背景上的一级 `Panel`，必须复用统一卡片内容内边距：大于 `720px` 时四边为 `16px`，不大于 `720px` 时四边为 `12px`。资产包编辑器中的“添加资产”和“拍卖资产包”使用相同内边距，并按自然内容高度顶部对齐，不得依赖网格默认拉伸制造大面积空白。',
    '左列“发起拍卖”使用拍卖页一级 `Panel`，右列“正在进行的拍卖”使用同一页面背景上的独立分区并由每场拍卖卡承担 `Panel` 语义。发起拍卖卡必须复用统一卡片内容内边距：大于 `720px` 时四边为 `16px`，不大于 `720px` 时四边为 `12px`。资产包编辑器中的“添加资产”和“拍卖资产包”使用相同内边距，并按自然内容高度顶部对齐，不得依赖网格默认拉伸制造大面积空白。',
    'auction primary surface rule',
)
doc = replace_once(
    doc,
    '| 商品与工厂资产包发布、竞价和结算结果 | 拍卖 |',
    '| 商品与工厂资产包发布和进行中竞价 | 拍卖 |',
    'auction module responsibility',
)
doc_path.write_text(doc, encoding='utf-8')

# Reapply the auction page assertions to the latest main verifier, preserving contract assertions.
verifier_path = ROOT / 'scripts/verify-page-content.mjs'
verifier = verifier_path.read_text(encoding='utf-8')
anchor = "for (const text of ['collectible', 'Collectible', '藏品']) forbidText('src/pages/AuctionPage.tsx', text);"
addition = (
    anchor
    + "\nfor (const text of ['asset-auction-workspace', '发起拍卖', '正在进行的拍卖', 'auctionAttentionPriority', '被超价', '新增']) requireText('src/pages/AuctionPage.tsx', text);"
    + "\nfor (const text of ['closedAuctions', '最近结束']) forbidText('src/pages/AuctionPage.tsx', text);"
)
verifier = replace_once(verifier, anchor, addition, 'auction page assertions')
verifier = replace_once(
    verifier,
    "  '| 拍卖 | `auction` | `AuctionPage` | 商品与工厂资产包竞价及结算结果 |',",
    "  '| 拍卖 | `auction` | `AuctionPage` | 商品与工厂资产包发布及进行中竞价 |',",
    'auction design responsibility assertion',
)
verifier_path.write_text(verifier, encoding='utf-8')

Path(__file__).unlink()
workflow = ROOT / '.github/workflows/codex-replay-auction-on-main.yml'
if workflow.exists():
    workflow.unlink()

print('auction changes replayed on latest main')
