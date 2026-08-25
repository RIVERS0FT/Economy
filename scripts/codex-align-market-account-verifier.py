from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    source = p.read_text(encoding='utf-8')
    if old not in source:
        raise SystemExit(f'{path}: expected block not found')
    p.write_text(source.replace(old, new, 1), encoding='utf-8')

replace_once(
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
    '移动端“我的订单与成交”使用“挂单／成交”切换；桌面端不显示该账户视图切换。布局变化不得改变五档深度、撮合、冻结、手续费或订单限制。',
    '“我的订单与成交”在桌面与移动端统一按“已有订单在上、本地成交在下”的单列顺序同时显示，不渲染“挂单／成交”账户视图切换，也不得通过断点隐藏其中一项。布局变化不得改变五档深度、撮合、冻结、手续费或订单限制。',
)

replace_once(
    'src/styles/market-desktop-cleanup.css',
    '''@media (min-width: 721px) {\n  .market-page-surface .market-account-view-switch,\n  .market-page-surface .market-trade-section-heading small {\n    display: none !important;\n  }\n}\n''',
    '''@media (min-width: 721px) {\n  .market-page-surface .market-trade-section-heading small {\n    display: none !important;\n  }\n}\n''',
)

path = Path('scripts/verify-market-desktop-cleanup.mjs')
source = path.read_text(encoding='utf-8')
source = source.replace("  '.market-page-surface .market-account-view-switch',\n", '')
source = source.replace(
    '''for (const text of [\n  'className="market-account-view-switch ui-segmented"',\n  '<small>实时五档 · 点击填价</small>',\n]) {\n  requireText(marketPage, text, `现有市场 DOM 不得删除：${text}`);\n}\n''',
    '''requireText(marketPage, '<small>实时五档 · 点击填价</small>', '订单簿辅助文案 DOM 必须继续存在以供桌面精简规则处理。');\nforbidText(marketPage, 'market-account-view-switch', '订单与成交必须同时纵向显示，不得恢复账户视图切换 DOM。');\nrequireText(marketPage, '<section>', '本人订单区必须保留普通 section。');\nrequireText(marketPage, '<section className="local-trades-section">', '本地成交区必须与订单区同时存在。');\n''',
)
source = source.replace(
    "requireText(design, '桌面端不显示该账户视图切换', '权威设计必须保留桌面账户区域精简。');",
    "requireText(design, '已有订单在上、本地成交在下', '权威设计必须记录订单与成交全端纵向同时显示。');\nrequireText(design, '不渲染“挂单／成交”账户视图切换', '权威设计必须记录账户视图切换退役。');",
)
source = source.replace(
    "requireText(browserSpec, \"name: '成交'\", '浏览器测试必须验证移动端挂单／成交切换仍存在。');",
    "requireText(browserSpec, \"locator('.market-account-view-switch')).toHaveCount(0)\", '浏览器测试必须验证账户视图切换不存在。');\nrequireText(browserSpec, \"locator('.market-account-grid > section')\", '浏览器测试必须覆盖订单与成交同时存在。');",
)
path.write_text(source, encoding='utf-8')

path = Path('tests/browser/market-desktop-cleanup.spec.ts')
source = path.read_text(encoding='utf-8')
source = source.replace("  await expect(page.locator('.market-account-view-switch')).toBeHidden();", "  await expect(page.locator('.market-account-view-switch')).toHaveCount(0);")
source = source.replace(
    "  await expect(page.getByRole('button', { name: '挂单', exact: true })).toBeVisible();\n  await expect(page.getByRole('button', { name: '成交', exact: true })).toBeVisible();\n",
    "  await expect(page.locator('.market-account-view-switch')).toHaveCount(0);\n  const accountSections = page.locator('.market-account-grid > section');\n  await expect(accountSections).toHaveCount(2);\n  await expect(accountSections.nth(0)).toContainText('已有订单');\n  await expect(accountSections.nth(1)).toContainText('本地成交');\n  const ordersBox = await accountSections.nth(0).boundingBox();\n  const tradesBox = await accountSections.nth(1).boundingBox();\n  expect(ordersBox).not.toBeNull();\n  expect(tradesBox).not.toBeNull();\n  expect(tradesBox!.y).toBeGreaterThan(ordersBox!.y + ordersBox!.height - 2);\n",
)
path.write_text(source, encoding='utf-8')
