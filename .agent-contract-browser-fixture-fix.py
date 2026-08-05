from pathlib import Path


def replace(path, old, new, count=1):
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if text.count(old) != count:
        raise SystemExit(f'expected {count} anchor(s) in {path}: {old[:120]!r}, found {text.count(old)}')
    file.write_text(text.replace(old, new, count), encoding='utf-8', newline='\n')

harness = Path('tests/browser/runtime-harness.tsx')
text = harness.read_text(encoding='utf-8')
replacements = [
    ("          id: 'contract-active',\n          publisherId: 456,", "          id: 'contract-active',\n          kind: 'supply',\n          publisherSide: 'supplier',\n          publisherId: 456,"),
    ("          id: 'contract-active-normal',\n          publisherId: 654,", "          id: 'contract-active-normal',\n          kind: 'supply',\n          publisherSide: 'supplier',\n          publisherId: 654,"),
    ("          id: 'contract-open',\n          publisherId: 789,", "          id: 'contract-open',\n          kind: 'supply',\n          publisherSide: 'buyer',\n          publisherId: 789,"),
    ("          id: 'contract-history',\n          publisherId: 123,", "          id: 'contract-history',\n          kind: 'supply',\n          publisherSide: 'buyer',\n          publisherId: 123,"),
]
for old, new in replacements:
    if text.count(old) != 1:
        raise SystemExit(f'expected one fixture anchor: {old!r}, found {text.count(old)}')
    text = text.replace(old, new, 1)
harness.write_text(text, encoding='utf-8', newline='\n')

replace(
    'tests/browser/contract-layout.spec.ts',
    "  await expect(page.locator('.contract-direction-switch')).toBeVisible();\n"
    "  await expect(page.getByRole('button', { name: '我长期采购', exact: true })).toHaveAttribute('aria-pressed', 'true');",
    "  await expect(page.locator('.contract-type-grid')).toBeVisible();\n"
    "  await expect(page.locator('.contract-type-option')).toHaveCount(6);\n"
    "  const purchaseType = page.locator('.contract-type-option').filter({ hasText: '采购合同' });\n"
    "  await expect(purchaseType).toHaveCount(1);\n"
    "  await expect(purchaseType).toHaveAttribute('aria-pressed', 'true');",
)

replace(
    'scripts/verify-contract-layout.mjs',
    "  '作为 `PageLayout` 自动生成的 `.ui-page-stack` 直接子元素',\n]) requireText(designPath, text);",
    "  '作为 `PageLayout` 自动生成的 `.ui-page-stack` 直接子元素',\n"
    "  '发布面板必须先展示六种类型',\n"
    "  '移动端六类入口至少两列且不得横向溢出',\n"
    "]) requireText(designPath, text);",
)
replace(
    'scripts/verify-contract-layout.mjs',
    "  'toHaveClass(/contract-card--attention/)',\n]) requireText(browserTestPath, text);",
    "  'toHaveClass(/contract-card--attention/)',\n"
    "  \"page.locator('.contract-type-option')\",\n"
    "  \"hasText: '采购合同'\",\n"
    "]) requireText(browserTestPath, text);",
)
replace(
    'scripts/verify-contract-layout.mjs',
    "  \"id: 'contract-active-normal'\",\n]) requireText(harnessPath, text);",
    "  \"id: 'contract-active-normal'\",\n"
    "  \"kind: 'supply'\",\n"
    "  \"publisherSide: 'supplier'\",\n"
    "]) requireText(harnessPath, text);",
)

replace(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '> 更新时间：2026-08-04',
    '> 更新时间：2026-08-05',
)
replace(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '合同只允许服务器正式商品和普通货币。不得加入工厂所有权、工厂出租、单座工厂实例、指定配方、对方工厂启停控制、其他资产类型或自由文本。发布方向分为“我长期采购”和“我长期供应”，条款包含商品、每批数量、单位价格、交付周期、总批次和首次交付延迟；合同标题由服务器按条款生成。',
    '合同只允许商品合作、玩家抵押借贷和工厂使用权租赁三个正式领域。商品合作只使用服务器正式商品和普通货币；玩家借贷只使用普通货币本金、固定总利率和数量化工厂抵押；工厂租赁只转移 `facilityTypeId + quantity` 的临时生产使用权。不得加入工厂所有权转移、单座工厂实例、指定配方、对方工厂启停控制、三类领域之外的其他资产或自由文本。发布面板固定先展示供应合同、采购合同、放贷合同、贷款合同、出租合同和租赁合同六种入口，再显示所属领域条款与风险预览；合同标题由服务器权威条款生成。',
)
replace(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '- 在合同中加入其他资产类型、工厂转移、工厂出租、自由文本或对方配方控制；',
    '- 在合同中加入三类正式领域之外的其他资产类型、工厂所有权转移、单座工厂实例、自由文本或对方配方控制，或让租赁获得超出数量化生产使用权的控制；',
)
