from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one replacement, found {count}: {old[:120]!r}')
    write(path, content.replace(old, new, 1))


def replace_between(path: str, start: str, end: str, replacement: str) -> None:
    content = read(path)
    start_index = content.find(start)
    if start_index < 0:
        raise SystemExit(f'{path}: missing start marker: {start!r}')
    end_index = content.find(end, start_index + len(start))
    if end_index < 0:
        raise SystemExit(f'{path}: missing end marker: {end!r}')
    write(path, content[:start_index] + replacement + content[end_index:])


# Merge recipe and production-method controls into one responsive settings section.
detail_path = 'src/pages/production/ProductionFacilityDetail.tsx'
replace_between(
    detail_path,
    '  return (\n    <>\n      <div className="facility-recipe-section">',
    '      <FacilityProductionFormula',
    r'''  return (
    <>
      <section className="facility-production-settings">
        <div className="facility-production-settings-heading">
          <strong>生产设置</strong>
          {recipeState.pendingRecipe ? (
            <small className="facility-recipe-status" aria-live="polite">
              下一周期切换为：{recipeState.pendingBaseRecipe?.name ?? recipeState.pendingRecipe.name}
              {' · '}
              {recipeState.pendingProductionMethod?.name ?? '标准生产'}
            </small>
          ) : null}
        </div>

        <div className="facility-production-settings-grid">
          <SelectInput
            label="生产配方"
            aria-label={`${type.name}生产配方`}
            value={recipeState.selectedBaseRecipeId}
            disabled={group.count < 1 || recipeState.recipes.length === 0}
            onChange={(event) => {
              selectConfiguration(event.target.value, recipeState.selectedProductionMethodId);
            }}
          >
            {recipeState.recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.name}
              </option>
            ))}
          </SelectInput>

          {recipeState.productionMethodGroup ? (
            <SelectInput
              label={recipeState.productionMethodGroup.name}
              aria-label={`${type.name}生产方式`}
              value={recipeState.selectedProductionMethodId}
              disabled={group.count < 1}
              onChange={(event) => {
                selectConfiguration(
                  recipeState.selectedBaseRecipeId,
                  event.target.value as FacilityProductionMethodId,
                );
              }}
            >
              {recipeState.productionMethodGroup.methods.map((method) => {
                const plan = method.plansByRecipeId[recipeState.selectedBaseRecipeId];
                return (
                  <option value={method.id} key={method.id} disabled={!plan}>
                    {method.name}
                  </option>
                );
              })}
            </SelectInput>
          ) : null}
        </div>

        {selectedMethod && selectedPlan ? (
          <div className="facility-production-method-summary" aria-live="polite">
            <span>
              {formatDuration(selectedPlan.cycleMs)} · 产出 {formatNumber(selectedPlan.output.quantity)} · 成本 {formatNumber(selectedPlan.operatingCost)}
            </span>
            <small>{selectedMethod.description}</small>
          </div>
        ) : null}
      </section>

''',
)


# Make formula, progress, and profit one production-settlement surface.
formula_component_path = 'src/components/facilities/FacilityProductionFormula.tsx'
replace_between(
    formula_component_path,
    '  return (\n    <>\n      <div className="facility-production-formula" role="group" aria-label={description}>',
    '\n  );\n}',
    r'''  return (
    <section className="facility-production-formula" role="group" aria-label={description}>
      <div className="facility-production-formula-heading">
        <strong>生产结算</strong>
        <div className="facility-formula-scope" aria-hidden="true">{scope.label}</div>
      </div>
      <div className="facility-formula-visual" aria-hidden="true">
        <div className="facility-formula-top">
          <div className="facility-formula-input">
            {inputs.length > 0 ? (
              <RecipeItems
                items={inputs}
                productNames={productNames}
                inventories={inventories}
                multiplier={scope.count}
                showInventory
                groupClassName="facility-formula-input-group"
                itemClassName="facility-formula-input-item"
              />
            ) : <span className="facility-formula-empty">无</span>}
          </div>

          <div className="facility-formula-center">
            <span className="facility-formula-meta-unit">
              <CycleIcon className="facility-formula-meta-icon" />
              <span>{formatDuration(type.cycleMs)}</span>
            </span>
            <span className="facility-formula-meta-divider">·</span>
            <span className="facility-formula-meta-unit">
              <CreditsIcon className="facility-formula-meta-icon" />
              <span>{formatCurrency(type.operatingCost * scope.count)}</span>
            </span>
          </div>

          <div className="facility-formula-output">
            <RecipeItems
              items={outputs}
              productNames={productNames}
              inventories={inventories}
              multiplier={scope.count}
              groupClassName="facility-formula-output-group"
              itemClassName="facility-formula-output-item"
            />
          </div>
        </div>

        <div className="facility-formula-progress">
          <FacilityGroupProgress group={group} type={type} now={now} />
        </div>
      </div>

      <FacilityRecipeProfitAnalysis
        type={profitType}
        scopeCount={profitScope.physicalCount}
        scopeLabel={profitScopeLabel}
        staffingRateBps={profitScope.staffingRateBps}
        products={products}
        inventories={inventories}
      />
    </section>''',
)


# Remove nested-card styling and define the responsive settings layout.
group_css_path = 'src/styles/facility-group-card-grid.css'
replace_once(
    group_css_path,
    r'''.facility-staffing-summary {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: var(--facility-card-inner-gap);
  background: var(--color-surface-inset);
}
''',
    r'''.facility-staffing-summary {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  padding-inline: var(--space-1);
}
''',
)
replace_between(
    group_css_path,
    '.facility-recipe-section {',
    '.facility-production-formula {',
    r'''.facility-production-settings {
  min-width: 0;
  display: grid;
  gap: var(--facility-card-inner-gap);
  border-top: 1px solid var(--color-divider);
  padding-top: var(--space-2);
}

.facility-production-settings-heading {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.facility-production-settings-heading strong {
  flex: 0 0 auto;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.facility-recipe-status {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.facility-production-settings-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: var(--space-2);
}

.facility-production-settings-grid > * {
  min-width: 0;
}

.facility-production-settings select {
  min-height: var(--control-height-compact);
}

.facility-production-settings select:disabled {
  opacity: 0.72;
  color: var(--color-text-secondary);
}

''',
)
replace_once(
    group_css_path,
    '@container (max-width: 519px) {\n  .facility-formula-top {',
    '@container (max-width: 479px) {\n  .facility-production-settings-grid {\n    grid-template-columns: minmax(0, 1fr);\n  }\n}\n\n@container (max-width: 519px) {\n  .facility-formula-top {',
)

write(
    'src/styles/production-methods.css',
    r'''.facility-production-method-summary {
  min-width: 0;
  display: grid;
  gap: 0.2rem;
  padding-inline: var(--space-1);
}

.facility-production-method-summary span {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
  font-variant-numeric: tabular-nums;
}

.facility-production-method-summary small {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}
''',
)

formula_css_path = 'src/styles/facility-production-formula.css'
replace_once(
    formula_css_path,
    r'''.facility-production-formula {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: var(--space-2);
  background: var(--color-surface-inset);
}
''',
    r'''.facility-production-formula {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: var(--space-2);
  background: var(--color-surface-inset);
}

.facility-production-formula-heading {
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.facility-production-formula-heading strong {
  flex: 0 0 auto;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-tight);
  white-space: nowrap;
}
''',
)
replace_once(
    formula_css_path,
    r'''@media (min-width: 961px) {
  .facility-group-card {
    grid-template-rows: auto minmax(112px, auto) minmax(0, 1fr) auto;
  }
}

''',
    '',
)

write(
    'src/styles/facility-recipe-profit-analysis.css',
    r'''.facility-average-profit {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  border-top: 1px solid var(--color-divider);
  padding-top: var(--space-2);
}

.facility-average-profit__copy {
  min-width: 0;
  display: grid;
  gap: 0.1rem;
}

.facility-average-profit__copy strong {
  overflow: hidden;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.facility-average-profit__copy small {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.facility-average-profit__value {
  flex: 0 0 auto;
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  font-weight: 750;
  line-height: var(--line-height-tight);
  white-space: nowrap;
}

.facility-average-profit.is-positive .facility-average-profit__value {
  color: var(--color-success);
}

.facility-average-profit.is-negative .facility-average-profit__value {
  color: var(--color-danger);
}

@container (max-width: 360px) {
  .facility-average-profit {
    gap: var(--space-1);
  }

  .facility-average-profit__copy small {
    font-size: 0.68rem;
  }
}
''',
)


# Browser regression: verify the merged structure and computed card geometry.
browser_path = 'tests/browser/production-methods.spec.ts'
replace_once(
    browser_path,
    "    await expect(detail).toContainText('作业制度');\n",
    "    await expect(detail).toContainText('生产设置');\n    await expect(detail).toContainText('作业制度');\n    await expect(detail).toContainText('生产结算');\n",
)
replace_once(
    browser_path,
    "    const methodSelect = detail.getByRole('combobox', { name: '机械工厂生产方式' });\n",
    "    const recipeSelect = detail.getByRole('combobox', { name: '机械工厂生产配方' });\n    const methodSelect = detail.getByRole('combobox', { name: '机械工厂生产方式' });\n",
)
replace_once(
    browser_path,
    "    await expect(methodSelect).toHaveCount(1);\n",
    "    await expect(recipeSelect).toHaveCount(1);\n    await expect(methodSelect).toHaveCount(1);\n",
)
replace_once(
    browser_path,
    "    await expect(summary).toContainText('高速生产');\n",
    "    await expect(summary.locator('strong')).toHaveCount(0);\n    await expect(summary).not.toContainText('高速生产');\n",
)
replace_once(
    browser_path,
    "    await expect(summary).toContainText('缩短周期并提高成本');\n\n",
    r'''    await expect(summary).toContainText('缩短周期并提高成本');

    const settings = detail.locator('.facility-production-settings');
    await expect(settings.locator('.facility-production-settings-grid')).toHaveCount(1);
    expect(await settings.locator('.facility-production-settings-grid').evaluate((element) => (
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
    ))).toBe(2);
    await expect(detail.locator('.facility-recipe-section')).toHaveCount(0);
    await expect(detail.locator('.facility-production-method-section')).toHaveCount(0);

    const staffingStyle = await detail.locator('.facility-staffing-summary').evaluate((element) => {
      const style = getComputedStyle(element);
      return { borderTopWidth: style.borderTopWidth, borderRadius: style.borderRadius };
    });
    expect(staffingStyle.borderTopWidth).toBe('0px');
    expect(staffingStyle.borderRadius).toBe('0px');

    const settlement = detail.locator('.facility-production-formula');
    const profit = settlement.locator('.facility-average-profit');
    await expect(profit).toHaveCount(1);
    const profitStyle = await profit.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        borderTopWidth: style.borderTopWidth,
        borderLeftWidth: style.borderLeftWidth,
        borderRadius: style.borderRadius,
      };
    });
    expect(profitStyle.borderTopWidth).not.toBe('0px');
    expect(profitStyle.borderLeftWidth).toBe('0px');
    expect(profitStyle.borderRadius).toBe('0px');

''',
)


# Record the non-regression layout rules in the authoritative documents.
industry_path = 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md'
replace_once(
    industry_path,
    '- 详情显示工厂名称和总数量、运行开关、完整状态、“运行中／下一周期加入／冻结中／抵押中”四列摘要、紧凑满员率状态、生产配方、集群生产公式、生产进度、单厂平均利润／分钟和市场入口。满员率不得替换或扩成第五项数量摘要。',
    '- 详情显示工厂名称和总数量、运行开关、完整状态、“运行中／下一周期加入／冻结中／抵押中”四列摘要、紧凑满员率状态、生产设置、生产结算和市场入口。生产设置包含生产配方与作业制度；生产结算包含集群生产公式、生产进度和单厂平均利润／分钟。满员率不得替换或扩成第五项数量摘要。',
)
replace_once(
    industry_path,
    '- 紧凑满员率状态位于四项数量摘要与配方之间，显示当前百分比、运行恢复或停止／异常下降方向、进度条，以及对应周期的物理数量、锁定或预计满员率和整数等效数量；桌面详情与移动 Bottom Sheet 共用同一组件，不新增独立卡片层级或滚动容器。',
    '- 紧凑满员率状态位于四项数量摘要与生产设置之间，显示当前百分比、运行恢复或停止／异常下降方向、进度条，以及对应周期的物理数量、锁定或预计满员率和整数等效数量；桌面详情与移动 Bottom Sheet 共用同一组件，必须使用无独立边框、圆角和背景的状态带，不新增卡片层级或滚动容器。\n- 生产配方与作业制度必须合并为同一个“生产设置”区；详情容器宽度大于 `479px` 时两个统一下拉框并排，不大于 `479px` 时单列排列。作业制度摘要只显示周期、产出、成本和说明，不得在下拉框下重复当前制度名称。',
)
replace_once(
    industry_path,
    '- 生产进度条是公式容器最后一个可见元素；进度条下方不得显示当前周期、恢复运行、产出、成本或其他说明文字。单厂平均利润行是公式后的独立同级区域，不得塞入进度条容器。',
    '- 生产公式与单厂平均利润共同属于同一个“生产结算”容器。生产进度条是公式视觉区最后一个可见元素；进度条下方不得显示当前周期、恢复运行、产出、成本或其他说明文字。单厂平均利润行必须位于结算容器内的分隔线之后，不得拥有独立外框、圆角、背景或形成第二张卡。',
)
replace_once(
    industry_path,
    '- 悬浮框使用“固定头部／唯一 `ScrollArea` 正文／固定底部操作区”三段结构。头部包含拖动把手、同一行内的标题与状态、运行开关和下一行三项数量摘要，不包含顶部关闭按钮；正文只包含配方、公式、进度和单厂平均利润行；底部只包含市场入口。`src/styles/facility-detail-sheet.css` 是移动悬浮框布局、拖动反馈和固定头尾的最终 CSS 权威。',
    '- 悬浮框使用“固定头部／唯一 `ScrollArea` 正文／固定底部操作区”三段结构。头部包含拖动把手、同一行内的标题与状态、运行开关和下一行三项数量摘要，不包含顶部关闭按钮；正文只包含生产设置与生产结算，生产结算内部依次包含公式、进度和单厂平均利润行；底部只包含市场入口。`src/styles/facility-detail-sheet.css` 是移动悬浮框布局、拖动反馈和固定头尾的最终 CSS 权威。',
)
replace_once(
    industry_path,
    '- 把完整状态从工厂名称同行拆成独立状态行或移回右侧操作区；',
    '- 把完整状态从工厂名称同行拆成独立状态行或移回右侧操作区；\n- 为满员率恢复独立边框／圆角／背景卡片，把生产配方与作业制度拆成两个卡片区，重复显示当前制度名称，或让单厂平均利润重新形成独立卡片；',
)

ui_path = 'docs/UI_DESIGN_SYSTEM.md'
replace_once(
    ui_path,
    '- 工厂生产公式固定采用三列顶层布局：输入在左、周期成本在中、输出在右；多输入或多输出内部允许换行，中列保持视觉居中。',
    '- 紧凑满员率状态必须使用无独立边框、圆角和背景的状态带，保留百分比、方向、进度条和周期产能说明，不得在详情卡内部再形成卡片。\n- 生产配方与作业制度使用同一个“生产设置”区和统一 `SelectInput`；容器宽度大于 `479px` 时双列，不大于 `479px` 时单列。作业制度摘要不得重复显示下拉框已经选中的制度名称。\n- 工厂生产公式固定采用三列顶层布局：输入在左、周期成本在中、输出在右；多输入或多输出内部允许换行，中列保持视觉居中。公式、进度和单厂平均利润共同组成一张“生产结算”卡，利润行只使用顶部分隔线，不得拥有独立外框、圆角或背景。',
)


# Extend the existing production-detail authority gate.
verify_path = 'scripts/verify-unified-factory-recipes-grid.mjs'
replace_once(verify_path, "  '<strong>生产配置</strong>',", "  '<strong>生产设置</strong>',")
replace_once(
    verify_path,
    "  'className=\"facility-cluster-detail-shell\"',\n",
    "  'className=\"facility-cluster-detail-shell\"',\n  'className=\"facility-production-settings\"',\n  'className=\"facility-production-settings-grid\"',\n",
)
replace_once(
    verify_path,
    "const sheetCss = read('src/styles/facility-detail-sheet.css');\n",
    r'''const staffingRule = css.slice(
  css.indexOf('.facility-staffing-summary {'),
  css.indexOf('.facility-staffing-heading {'),
);
for (const forbidden of ['border:', 'border-radius:', 'background:'])
  assert.equal(staffingRule.includes(forbidden), false, `满员率状态不得恢复卡片外观: ${forbidden}`);

const settingsRule = css.slice(
  css.indexOf('.facility-production-settings {'),
  css.indexOf('.facility-production-formula {'),
);
for (const required of [
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  '@container (max-width: 479px)',
]) assert.equal(css.includes(required), true, `生产设置响应式布局缺少: ${required}`);
for (const forbidden of ['border-radius:', 'background:'])
  assert.equal(settingsRule.includes(forbidden), false, `生产设置不得恢复嵌套卡片: ${forbidden}`);

const settlementStart = formula.indexOf('<section className="facility-production-formula"');
const settlementEnd = formula.indexOf('</section>', settlementStart);
const profitIndex = formula.indexOf('<FacilityRecipeProfitAnalysis', settlementStart);
assert.equal(formula.includes('<strong>生产结算</strong>'), true, '生产公式缺少生产结算标题');
assert.equal(profitIndex > settlementStart && profitIndex < settlementEnd, true, '单厂利润必须位于生产结算容器内');

const profitCss = read('src/styles/facility-recipe-profit-analysis.css');
const profitRule = profitCss.slice(
  profitCss.indexOf('.facility-average-profit {'),
  profitCss.indexOf('.facility-average-profit__copy {'),
);
assert.equal(profitRule.includes('border-top:'), true, '单厂利润行必须保留结算分隔线');
for (const forbidden of ['border:', 'border-radius:', 'background:'])
  assert.equal(profitRule.includes(forbidden), false, `单厂利润行不得恢复独立卡片: ${forbidden}`);

const detailBodySource = detail.slice(
  detail.indexOf('export function FacilityClusterDetailBody'),
  detail.indexOf('export function FacilityMarketAction'),
);
for (const forbidden of [
  'facility-recipe-section',
  'facility-production-method-section',
  '<strong>{selectedMethod.name}</strong>',
]) assert.equal(detailBodySource.includes(forbidden), false, `生产设置不得恢复拆分结构: ${forbidden}`);

const sheetCss = read('src/styles/facility-detail-sheet.css');
''',
)
replace_once(
    verify_path,
    "  '公式不得使用总持有 `count` 作为生产乘数',\n",
    "  '公式不得使用总持有 `count` 作为生产乘数',\n  '生产配方与作业制度必须合并为同一个“生产设置”区',\n  '生产公式与单厂平均利润共同属于同一个“生产结算”容器',\n",
)
replace_once(
    verify_path,
    "      '卡片点击不保留选中态',\n",
    "      '卡片点击不保留选中态',\n      '紧凑满员率状态必须使用无独立边框、圆角和背景的状态带',\n      '生产配方与作业制度使用同一个“生产设置”区',\n      '公式、进度和单厂平均利润共同组成一张“生产结算”卡',\n",
)

print('production detail layout patch applied')
