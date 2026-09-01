from pathlib import Path

# 1. Regional drill-down is asynchronous: wait for the actual regional detail surface before reading hero facts.
p = Path('tests/browser/market-information-hierarchy.spec.ts')
text = p.read_text()
old = """  await regionalRow.click();
  const visibleHeroMetrics = await page.locator('.market-detail-hero__metric:visible small').allTextContents();
"""
new = """  await regionalRow.click();
  await expect(page.locator('.market-detail-surface')).toBeVisible();
  const visibleHeroMetrics = await page.locator('.market-detail-hero__metric:visible small').allTextContents();
"""
if old not in text:
    raise SystemExit('market information drill-down anchor not found')
text = text.replace(old, new, 1)
old = """  const accountPanel = page.locator('.market-account-panel');
  await expect(accountPanel).toBeVisible();
  await expect(accountPanel.getByText('资产', { exact: true })).toHaveCount(0);
"""
new = """  const accountPanel = page.locator('.market-account-panel');
  await expect(accountPanel).toBeVisible();
  const localTradesSection = accountPanel.locator('.local-trades-section');
  await expect(localTradesSection.getByText('资产', { exact: true })).toHaveCount(0);
"""
if old not in text:
    raise SystemExit('local trade asset-column browser anchor not found')
text = text.replace(old, new, 1)
p.write_text(text)

# 2. Disabled-stepper stability is a local layout invariant. Viewport y can change when browser focus/scroll ownership changes.
p = Path('tests/browser/market-order-entry-compact.spec.ts')
text = p.read_text()
helper_anchor = """async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}
"""
helper = helper_anchor + """
async function requireStepperBox(locator: Locator) {
  return locator.evaluate((element) => {
    const stepper = element.closest('.market-stepper');
    if (!(stepper instanceof HTMLElement)) throw new Error('market stepper parent is missing');
    const elementBox = element.getBoundingClientRect();
    const stepperBox = stepper.getBoundingClientRect();
    return {
      x: elementBox.x - stepperBox.x,
      y: elementBox.y - stepperBox.y,
      width: elementBox.width,
      height: elementBox.height,
    };
  });
}
"""
if helper_anchor not in text:
    raise SystemExit('market stepper helper anchor not found')
text = text.replace(helper_anchor, helper, 1)
text = text.replace('const increaseBefore = await requireBox(quantityIncrease);', 'const increaseBefore = await requireStepperBox(quantityIncrease);', 1)
text = text.replace('const increaseAfter = await requireBox(quantityIncrease);', 'const increaseAfter = await requireStepperBox(quantityIncrease);', 1)
text = text.replace('const decreaseBefore = await requireBox(quantityDecrease);', 'const decreaseBefore = await requireStepperBox(quantityDecrease);', 1)
text = text.replace('const decreaseAfter = await requireBox(quantityDecrease);', 'const decreaseAfter = await requireStepperBox(quantityDecrease);', 1)
p.write_text(text)

# 3. Record both regression rules in authoritative design docs.
p = Path('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md')
text = p.read_text()
stepper_anchor = '“最大”只是填入当前合法最大数量，不直接提交。'
stepper_rule = '步进按钮在达到最小值或最大值后进入禁用状态时，不得改变其相对共享输入框的嵌入位置与自身尺寸；浏览器几何回归必须以同一 `.market-stepper` 本地容器为坐标基准，避免把焦点转移或滚动所有权变化造成的视口坐标变化误判为控件布局移动。'
if stepper_rule not in text:
    if stepper_anchor not in text:
        raise SystemExit('order-book stepper design anchor not found')
    text = text.replace(stepper_anchor, stepper_anchor + stepper_rule, 1)
p.write_text(text)

p = Path('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md')
text = p.read_text()
detail_anchor = '不得为已删除的市场价、基准偏离、需求满足率、参考价、上轮需求或基本面条保留空白轨道。'
detail_rule = '从商品全局详情的地区行进入地区商品详情需要先完成权威经营地区切换和商品详情选择；切换未就绪时允许显示短暂占位，只有 `.market-detail-surface` 已实际挂载后才读取“24h 变化／可用库存”等详情事实。浏览器回归不得在点击地区行的同一事件循环立即快照详情 DOM。'
if detail_rule not in text:
    if detail_anchor not in text:
        raise SystemExit('market detail page design anchor not found')
    text = text.replace(detail_anchor, detail_anchor + detail_rule, 1)
p.write_text(text)

# 4. Lock the repaired synchronization, local-trade scope, and local-geometry semantics into static guards.
p = Path('scripts/verify-market-information-hierarchy.mjs')
text = p.read_text()
line = "requireText(hierarchyBrowserSpec, \"await expect(page.locator('.market-detail-surface')).toBeVisible();\", 'regional market browser waits for authoritative detail surface');"
if line not in text:
    marker = "const warehouseVerifier = read('scripts/verify-warehouse-expansion.mjs');"
    if marker not in text:
        raise SystemExit('market information verifier constant anchor missing')
    text = text.replace(marker, marker + '\n' + line, 1)
line = "requireText(hierarchyBrowserSpec, \"accountPanel.locator('.local-trades-section')\", 'local trade asset-column assertion stays scoped to local trades');"
if line not in text:
    marker = "requireText(hierarchyBrowserSpec, \"await expect(page.locator('.market-detail-surface')).toBeVisible();\", 'regional market browser waits for authoritative detail surface');"
    text = text.replace(marker, marker + '\n' + line, 1)
p.write_text(text)

p = Path('scripts/verify-market-order-entry-compact.mjs')
text = p.read_text()
if "'requireStepperBox'," not in text:
    marker = "'embedded market steppers keep stable geometry through press and disabled states',"
    if marker not in text:
        raise SystemExit('market order entry verifier browser marker missing')
    text = text.replace(marker, marker + "\n  'requireStepperBox',", 1)
if "以同一 `.market-stepper` 本地容器为坐标基准" not in text:
    marker = "  'wheelStep={0.01}',\n]) requireText(orderDesignPath, text);"
    replacement = "  'wheelStep={0.01}',\n  '以同一 `.market-stepper` 本地容器为坐标基准',\n]) requireText(orderDesignPath, text);"
    if marker not in text:
        raise SystemExit('market order design verifier anchor missing')
    text = text.replace(marker, replacement, 1)
p.write_text(text)
