from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1))


replace_once(
    'src/components/facilities/FacilityProductionFormula.tsx',
    '            {index > 0 ? <span className="facility-formula-separator">+</span> : null}\n',
    '',
)

replace_once(
    'src/styles/facility-production-formula.css',
    '/* Factory production settlement: icon-first material rows, two-line input metadata, and flow progress. */',
    '/* Factory production settlement: icon-first material rows, compact operation metadata, and flow progress. */',
)
replace_once(
    'src/styles/facility-production-formula.css',
    '  grid-area: auto;\n  display: inline-flex;',
    '  grid-area: auto;\n  justify-self: start;\n  display: inline-flex;',
)
replace_once(
    'src/styles/facility-production-formula.css',
    '''.facility-formula-separator {
  align-self: center;
  color: color-mix(in srgb, var(--color-warning) 72%, var(--color-text-muted));
  font-size: var(--font-size-sm);
  font-weight: 800;
  text-shadow: 0 1px color-mix(in srgb, var(--color-bg-deep) 82%, transparent);
}

''',
    '',
)
replace_once(
    'src/styles/facility-production-formula.css',
    '''
  .facility-formula-meta {
    width: 100%;
  }
''',
    '',
)

replace_once(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    '- 集群生产公式支持无输入、单输入、多输入和单输出；客户端必须逐项渲染并显示 `+` 分隔。',
    '- 集群生产公式支持无输入、单输入、多输入和单输出；客户端必须逐项渲染，多项物资只使用独立物资槽与间距分隔，不显示 `+` 或其他连接字符。',
)
replace_once(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    '- 时间与成本固定放在投入与产出下方的同一条操作数据带，中间使用竖向分隔线；周期不乘工厂数量，不得显示总工时，也不得恢复输入输出之间的独立中列、上下两行排列或横向分隔线。生产结算内部网格唯一归属 `src/styles/facility-production-formula.css`，`facility-group-card-grid.css` 不得定义任何 `.facility-formula-*` 的 `grid-area`、隐式轨道或容器查询。',
    '- 时间与成本固定放在投入与产出下方的同一条操作数据带，中间使用竖向分隔线；操作数据带按内容宽度左对齐且最大不超过结算容器，移动端不得拉伸为全宽。周期不乘工厂数量，不得显示总工时，也不得恢复输入输出之间的独立中列、上下两行排列或横向分隔线。生产结算内部网格唯一归属 `src/styles/facility-production-formula.css`，`facility-group-card-grid.css` 不得定义任何 `.facility-formula-*` 的 `grid-area`、隐式轨道或容器查询。',
)

replace_once(
    'docs/UI_DESIGN_SYSTEM.md',
    '- 工厂生产公式固定采用双列顶层布局：左侧为输入组合区，右侧为输出区；输入与输出物资槽顶部对齐，输入组合区内先显示投入物资槽，再在其下同一行显示时间与成本，中间使用竖向分隔线。多输入或多输出内部允许换行，时间与成本不得回到输入输出之间的独立中列。公式、操作数据带、进度和单厂平均利润共同组成一张“生产结算”卡，利润行只使用顶部分隔线，不得拥有独立外框、圆角或背景。',
    '- 工厂生产公式固定采用双列顶层布局：左侧为输入组合区，右侧为输出区；输入与输出物资槽顶部对齐。时间与成本位于双列物资区下方的同一条操作数据带，中间使用竖向分隔线；多输入或多输出内部允许换行，时间与成本不得回到输入输出之间的独立中列。公式、操作数据带、进度和单厂平均利润共同组成一张“生产结算”卡，利润行只使用顶部分隔线，不得拥有独立外框、圆角或背景。',
)
replace_once(
    'docs/UI_DESIGN_SYSTEM.md',
    '- 输入和输出项目统一使用“商品图片、生产数量、仓库 Icon、当前可用库存”的单行结构，多项目之间使用独立 `+` 元素；输入与输出均显示当前可用库存，输出库存不得改成预计入库后的预测值。商品位置只能调用 `ProductArtwork` 加载 128px PNG，不得渲染 `ProductIcon` SVG；仓库等功能语义继续使用统一功能 Icon，不得在生产详情中手写 SVG 标记。',
    '- 输入和输出项目统一使用“商品图片、生产数量、仓库 Icon、当前可用库存”的单行结构；多项物资只通过独立物资槽与间距分隔，不显示 `+` 或其他连接字符。输入与输出均显示当前可用库存，输出库存不得改成预计入库后的预测值。商品位置只能调用 `ProductArtwork` 加载 128px PNG，不得渲染 `ProductIcon` SVG；仓库等功能语义继续使用统一功能 Icon，不得在生产详情中手写 SVG 标记。',
)
replace_once(
    'docs/UI_DESIGN_SYSTEM.md',
    '- 输入侧周期成本仪表只显示时间 Icon、周期数值、成本 Icon 和集群成本数值，不显示可见的“周期”或“运行成本”标签；时间和成本固定在同一行，中间使用 `border-left` 形成竖向分隔线，不得恢复上下两行或横向分隔符。生产结算内部布局只能由 `facility-production-formula.css` 定义，工厂主从布局样式不得写入生产公式的 `grid-area` 或专属容器查询。',
    '- 生产结算操作数据带只显示时间 Icon、周期数值、成本 Icon 和集群成本数值，不显示可见的“周期”或“运行成本”标签；时间和成本固定在同一行，中间使用 `border-left` 形成竖向分隔线。操作数据带使用 `width: fit-content`、`max-width: 100%` 与左对齐，移动端不得拉伸为全宽，也不得恢复上下两行或横向分隔符。生产结算内部布局只能由 `facility-production-formula.css` 定义，工厂主从布局样式不得写入生产公式的 `grid-area` 或专属容器查询。',
)
replace_once(
    'docs/UI_DESIGN_SYSTEM.md',
    '- 窄容器允许输入侧物资槽、周期成本仪表与输出槽在各自列内换行；顶层仍保持输入侧／输出双列，不得造成页面横向滚动。',
    '- 窄容器允许输入与输出物资槽在各自列内换行；操作数据带保持内容宽度并可在自身内部收缩，顶层仍保持输入侧／输出双列，不得造成页面横向滚动。',
)

replace_once(
    'scripts/verify-production-settlement-layout.mjs',
    "  'facility-formula-center',\n]) assert.equal(formula.includes(forbidden), false, `生产结算不得包含: ${text}`);",
    "  'facility-formula-center',\n  'facility-formula-separator',\n]) assert.equal(formula.includes(forbidden), false, `生产结算不得包含: ${text}`);",
)
replace_once(
    'scripts/verify-production-settlement-layout.mjs',
    "  'grid-area: auto;',\n  '.facility-formula-meta-unit.is-cost {',",
    "  'grid-area: auto;',\n  'width: fit-content;',\n  'justify-self: start;',\n  '.facility-formula-meta-unit.is-cost {',",
)
replace_once(
    'scripts/verify-production-settlement-layout.mjs',
    "  'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);',\n]) assert.equal(formulaCss.includes(forbidden), false, `生产结算样式不得包含: ${forbidden}`);",
    "  'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);',\n  '.facility-formula-separator',\n  'width: 100%;',\n]) assert.equal(formulaCss.includes(forbidden), false, `生产结算样式不得包含: ${forbidden}`);",
)
replace_once(
    'scripts/verify-production-settlement-layout.mjs',
    "  \"settlement.locator('.product-artwork')\",\n  'expect(box.x + box.width).toBeLessThanOrEqual(width)',",
    "  \"settlement.locator('.product-artwork')\",\n  \"settlement.locator('.facility-formula-separator')\",\n  'expect(box.x + box.width).toBeLessThanOrEqual(width)',\n  'expect(metaBox.width).toBeLessThan(visualBox.width - 8)',",
)
replace_once(
    'scripts/verify-production-settlement-layout.mjs',
    "  '输入与输出均显示当前可用库存',\n]) assert.equal(uiDesign.includes(text) || industryDesign.includes(text), true, `权威设计缺少: ${text}`);",
    "  '输入与输出均显示当前可用库存',\n  '不显示 `+` 或其他连接字符',\n  '移动端不得拉伸为全宽',\n]) assert.equal(uiDesign.includes(text) || industryDesign.includes(text), true, `权威设计缺少: ${text}`);",
)

replace_once(
    'tests/browser/production-methods.spec.ts',
    "    await expect(materialRows).toHaveCount(2);\n    await expect(settlement.locator('.facility-formula-inventory')).toHaveCount(2);",
    "    await expect(materialRows).toHaveCount(2);\n    await expect(settlement.locator('.facility-formula-separator')).toHaveCount(0);\n    await expect(settlement.locator('.facility-formula-inventory')).toHaveCount(2);",
)
replace_once(
    'tests/browser/production-methods.spec.ts',
    "    const settlement = sheet.locator('.facility-production-formula');\n    const inputSlot = settlement.locator('.facility-formula-input .facility-formula-item-group').first();",
    "    const settlement = sheet.locator('.facility-production-formula');\n    const visual = settlement.locator('.facility-formula-visual');\n    const inputSlot = settlement.locator('.facility-formula-input .facility-formula-item-group').first();",
)
replace_once(
    'tests/browser/production-methods.spec.ts',
    "    const [inputBox, outputBox, metaBox, progressBox, cycleBox, costBox] = await Promise.all([\n      inputSlot.boundingBox(),",
    "    const [visualBox, inputBox, outputBox, metaBox, progressBox, cycleBox, costBox] = await Promise.all([\n      visual.boundingBox(),\n      inputSlot.boundingBox(),",
)
replace_once(
    'tests/browser/production-methods.spec.ts',
    "    expect(inputBox).not.toBeNull();\n    expect(outputBox).not.toBeNull();",
    "    expect(visualBox).not.toBeNull();\n    expect(inputBox).not.toBeNull();\n    expect(outputBox).not.toBeNull();",
)
replace_once(
    'tests/browser/production-methods.spec.ts',
    "    if (!inputBox || !outputBox || !metaBox || !progressBox || !cycleBox || !costBox) {\n      throw new Error(`移动生产结算几何不可用: ${width}px`);\n    }",
    "    if (!visualBox || !inputBox || !outputBox || !metaBox || !progressBox || !cycleBox || !costBox) {\n      throw new Error(`移动生产结算几何不可用: ${width}px`);\n    }",
)
replace_once(
    'tests/browser/production-methods.spec.ts',
    "    expect(metaBox.y).toBeGreaterThanOrEqual(Math.max(inputBox.y + inputBox.height, outputBox.y + outputBox.height) - 1);\n    expect(progressBox.y).toBeGreaterThanOrEqual(",
    "    expect(metaBox.y).toBeGreaterThanOrEqual(Math.max(inputBox.y + inputBox.height, outputBox.y + outputBox.height) - 1);\n    expect(Math.abs(metaBox.x - visualBox.x)).toBeLessThanOrEqual(1);\n    expect(metaBox.width).toBeLessThan(visualBox.width - 8);\n    expect(progressBox.y).toBeGreaterThanOrEqual(",
)
