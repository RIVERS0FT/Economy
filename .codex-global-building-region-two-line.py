from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8', newline='\n')


def replace_once(text, old, new, path):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one occurrence, got {count}: {old[:120]!r}')
    return text.replace(old, new, 1)


def sub_once(text, pattern, repl, path, flags=0):
    updated, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{path}: regex expected one occurrence, got {count}: {pattern[:120]!r}')
    return updated


# Region rows mirror the global two-line interaction model, without adding artwork or production icons.
path = 'src/pages/GlobalBuildingsPage.tsx'
text = read(path)
text = replace_once(
    text,
    "  const [pendingQuickFacilityTypeIds, setPendingQuickFacilityTypeIds] = useState<Set<string>>(() => new Set());\n",
    "  const [pendingQuickFacilityTypeIds, setPendingQuickFacilityTypeIds] = useState<Set<string>>(() => new Set());\n  const [pendingRegionQuickKeys, setPendingRegionQuickKeys] = useState<Set<string>>(() => new Set());\n",
    path,
)
old_region_return = """      return [{\n        province,\n        catalogIndex,\n        count,\n        statusCode: group.status,\n        status: facilityStatusLabel(group.status),\n        profitPerMinute: presentation.profitPerMinute,\n        profitTone: presentation.tone,\n        profitValue: presentation.visibleValue,\n        profitAccessibleValue: presentation.accessibleValue,\n        profitDetail: presentation.detail,\n      }];\n"""
new_region_return = """      const completedTechnologyIds = new Set(game.research?.completedTechnologyIds ?? []);\n      const productionMethodGroup = recipeState.productionMethodGroup;\n      const methodOptions = productionMethodGroup?.methods.filter((method) => (\n        requiredTechnologyIdsForMethod(method).every((technologyId) => completedTechnologyIds.has(technologyId))\n        && Boolean(productionRecipeVariantId(\n          selectedGlobalFacility,\n          recipeState.selectedBaseRecipeId,\n          method.id,\n        ))\n      )) ?? [];\n      const currentProductId = recipeState.activeBaseRecipe.output.productId;\n      const currentProductName = game.products.find((product) => product.id === currentProductId)?.name\n        ?? recipeState.activeBaseRecipe.name;\n      const currentMethodName = recipeState.activeProductionMethod?.name\n        ?? productionMethodGroup?.methods.find((method) => method.id === recipeState.selectedProductionMethodId)?.name\n        ?? '标准生产';\n\n      return [{\n        province,\n        catalogIndex,\n        count,\n        statusCode: group.status,\n        status: facilityStatusLabel(group.status),\n        profitPerMinute: presentation.profitPerMinute,\n        profitTone: presentation.tone,\n        profitValue: presentation.visibleValue,\n        profitAccessibleValue: presentation.accessibleValue,\n        profitDetail: presentation.detail,\n        quickProduction: {\n          baseRecipeId: recipeState.selectedBaseRecipeId,\n          productName: currentProductName,\n          methodId: recipeState.selectedProductionMethodId,\n          methodName: currentMethodName,\n          productOptions: recipeState.recipes.map((recipe) => ({\n            id: recipe.id,\n            name: game.products.find((product) => product.id === recipe.output.productId)?.name ?? recipe.name,\n          })),\n          methodOptions: methodOptions.map((method) => ({ id: method.id, name: method.name })),\n        },\n      }];\n"""
text = replace_once(text, old_region_return, new_region_return, path)
text = replace_once(
    text,
    "    game.provinceMarkets,\n    provinces,\n    selectedGlobalFacility,\n",
    "    game.provinceMarkets,\n    game.research?.completedTechnologyIds,\n    provinces,\n    selectedGlobalFacility,\n",
    path,
)
insert_before_active = """  const applyRegionalQuickProduction = async (\n    row: (typeof facilityProvinceRows)[number],\n    target: 'product' | 'method',\n    nextValue: string,\n  ) => {\n    const type = selectedGlobalFacility;\n    const quick = row.quickProduction;\n    if (!type || !quick || !nextValue || !model.setFacilityRecipes) return;\n    const pendingKey = `${row.province.id}:${type.id}`;\n    if (pendingRegionQuickKeys.has(pendingKey)) return;\n    if (target === 'product' && quick.baseRecipeId === nextValue) return;\n    if (target === 'method' && quick.methodId === nextValue) return;\n\n    const recipeId = target === 'product'\n      ? productionRecipeVariantId(type, nextValue, quick.methodId)\n        ?? productionRecipeVariantId(type, nextValue, 'standard')\n      : productionRecipeVariantId(type, quick.baseRecipeId, nextValue as FacilityProductionMethodId);\n    if (!recipeId) {\n      model.notify('当前生产配置无法应用到该地区');\n      return;\n    }\n\n    setPendingRegionQuickKeys((current) => new Set(current).add(pendingKey));\n    try {\n      const result = await model.setFacilityRecipes([{\n        provinceId: row.province.id,\n        facilityTypeId: type.id,\n        recipeId,\n      }]);\n      model.notify(result.message);\n    } finally {\n      setPendingRegionQuickKeys((current) => {\n        const nextPending = new Set(current);\n        nextPending.delete(pendingKey);\n        return nextPending;\n      });\n    }\n  };\n\n"""
text = replace_once(text, "  if (activeProvince) {\n", insert_before_active + "  if (activeProvince) {\n", path)
region_pattern = r'''                    <button\n                      type="button"\n                      className="entity-list-row global-facility-region-row"[\s\S]*?                    </button>'''
region_replacement = '''                    <div\n                      className="entity-list-row global-facility-region-row"\n                      data-province-id={row.province.id}\n                      data-quick-production-row="true"\n                    >\n                      <button\n                        type="button"\n                        className="global-facility-region-row__open"\n                        data-ui-interactive="surface"\n                        aria-label={`打开${row.province.name}${selectedGlobalFacility.name}工厂详情，单厂利润每分钟：${row.profitAccessibleValue}，拥有 ${formatNumber(row.count)} 座，${row.status}`}\n                        title={row.profitDetail}\n                        onClick={() => openRegionalFacility(row.province.id)}\n                      >\n                        <span className="global-facility-region-row__identity">\n                          <strong>{row.province.name}</strong>\n                        </span>\n                        <strong\n                          className={`entity-list-value global-facility-region-row__profit is-${row.profitTone}`}\n                          title={row.profitDetail}\n                        >\n                          {row.profitValue}\n                        </strong>\n                        <strong className="global-facility-region-row__metric">{<CompactNumber value={row.count} />}</strong>\n                        <strong className="global-facility-region-row__status">{row.status}</strong>\n                        <span className="global-facility-region-row__chevron" aria-hidden="true">\n                          <ChevronIcon direction="right" />\n                        </span>\n                      </button>\n                      <span className="global-facility-region-row__quick-controls" aria-label={`${row.province.name}${selectedGlobalFacility.name}生产配置`}>\n                        <span className="global-facility-region-row__quick-selector" data-quick-production="product">\n                          <RichSelectInput\n                            label="生产产物"\n                            fieldClassName="global-facility-region-row__quick-field"\n                            variant="default"\n                            value={row.quickProduction.baseRecipeId}\n                            options={row.quickProduction.productOptions.map((option) => ({\n                              value: option.id,\n                              label: option.name,\n                            }))}\n                            disabled={row.quickProduction.productOptions.length < 2 || pendingRegionQuickKeys.has(`${row.province.id}:${selectedGlobalFacility.id}`)}\n                            aria-label={`${row.province.name}${selectedGlobalFacility.name}生产产物：${row.quickProduction.productName}`}\n                            onValueChange={(value) => void applyRegionalQuickProduction(row, 'product', value)}\n                          />\n                        </span>\n                        <span className="global-facility-region-row__quick-selector" data-quick-production="method">\n                          <RichSelectInput\n                            label="作业制度"\n                            fieldClassName="global-facility-region-row__quick-field"\n                            variant="default"\n                            value={row.quickProduction.methodId}\n                            options={row.quickProduction.methodOptions.map((option) => ({\n                              value: option.id,\n                              label: option.name,\n                            }))}\n                            disabled={row.quickProduction.methodOptions.length < 2 || pendingRegionQuickKeys.has(`${row.province.id}:${selectedGlobalFacility.id}`)}\n                            aria-label={`${row.province.name}${selectedGlobalFacility.name}作业制度：${row.quickProduction.methodName}`}\n                            onValueChange={(value) => void applyRegionalQuickProduction(row, 'method', value)}\n                          />\n                        </span>\n                      </span>\n                    </div>'''
text = sub_once(text, region_pattern, region_replacement, path, flags=re.S)
write(path, text)


# Region row geometry: same two-line height and equal inset as global, but no artwork/visual icon slots.
path = 'src/styles/global-operation-pages.css'
text = read(path)
region_css = r'''

/* Global facility region rows mirror the two-line production layout without artwork. */
.entity-list-row.global-facility-region-row {
  --entity-list-row-height: 96px;
  --global-facility-region-main-row-size: 44px;
  --global-facility-region-quick-size: 28px;
  --global-facility-region-row-gap: 4px;
  grid-template-rows: var(--global-facility-region-main-row-size) var(--global-facility-region-quick-size);
  align-content: center;
  align-items: center;
  row-gap: var(--global-facility-region-row-gap);
  padding: var(--entity-list-inline-padding);
  padding-block: var(--entity-list-inline-padding);
  padding-inline: var(--entity-list-inline-padding);
  overflow: visible;
}

.global-facility-region-row__open {
  --ui-interactive-hover-background: var(--color-surface-hover);
  --ui-interactive-hover-transform: none;
  --ui-interactive-active-transform: none;
  grid-column: 1 / -1;
  grid-row: 1;
  z-index: 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--entity-list-columns);
  align-items: center;
  gap: var(--entity-list-gap);
  border: 0;
  border-radius: calc(var(--radius-control) - .15rem);
  padding: 0;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.global-facility-region-row__identity,
.global-facility-region-row__profit,
.global-facility-region-row__metric,
.global-facility-region-row__status,
.global-facility-region-row__chevron {
  min-width: 0;
  pointer-events: none;
}

.global-facility-region-row__quick-controls {
  grid-column: 1 / -2;
  grid-row: 2;
  z-index: 3;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: .35rem;
}

.global-facility-region-row__quick-selector {
  flex: 1 1 0;
  width: 0;
  min-width: 0;
  max-width: 8rem;
  height: var(--global-facility-region-quick-size);
}

.global-facility-region-row__quick-field,
.global-facility-region-row__quick-field > .ui-rich-select {
  width: 100%;
  min-width: 0;
  height: var(--global-facility-region-quick-size);
  min-height: 0;
  display: block;
}

.global-facility-region-row__quick-field {
  gap: 0;
}

.global-facility-region-row__quick-field > .ui-form-field__label {
  display: none;
}

.global-facility-region-row__quick-selector .ui-rich-select__trigger {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: var(--global-facility-region-quick-size);
  min-height: var(--global-facility-region-quick-size);
  max-height: var(--global-facility-region-quick-size);
  gap: .3rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-control);
  padding: .1rem .42rem;
  background: color-mix(in srgb, var(--color-surface-inset) 82%, transparent);
  font-size: var(--font-size-xs);
}

.global-facility-region-row__quick-selector .ui-rich-select__value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-facility-region-row__quick-selector .ui-rich-select__trigger:disabled {
  opacity: 1;
  cursor: default;
}

@container (max-width: 620px) {
  .entity-list-row.global-facility-region-row {
    --entity-list-row-height: 88px;
    --global-facility-region-main-row-size: 44px;
    --global-facility-region-quick-size: 26px;
    --global-facility-region-row-gap: 2px;
  }

  .global-facility-region-row__quick-controls {
    gap: .25rem;
  }

  .global-facility-region-row__quick-selector {
    max-width: 7rem;
  }
}

@container (max-width: 360px) {
  .entity-list-row.global-facility-region-row {
    --entity-list-row-height: 84px;
    --global-facility-region-main-row-size: 44px;
    --global-facility-region-quick-size: 24px;
    --global-facility-region-row-gap: 1px;
  }

  .global-facility-region-row__quick-controls {
    gap: .18rem;
  }

  .global-facility-region-row__quick-selector {
    max-width: 6rem;
  }

  .global-facility-region-row__quick-selector .ui-rich-select__trigger {
    padding-inline: .28rem;
    font-size: .625rem;
  }
}
'''
if '/* Global facility region rows mirror the two-line production layout without artwork. */' in text:
    raise SystemExit(f'{path}: region two-line CSS already exists')
text = text.rstrip() + region_css + '\n'
write(path, text)


# Design authority updates.
path = 'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md'
text = read(path)
text = replace_once(text, '桌面约 `52×52`', '桌面约 `72×72`', path)
text = replace_once(
    text,
    '地区工厂列表仍保持共享单行高度。',
    '地区工厂列表同步登记为相同的两行高度例外，但不得加入工厂插画、商品图标或作业制度图标；第一行继续使用“地区｜利润／分钟｜拥有｜状态｜Chevron”共享列并负责进入地区工厂详情，第二行只使用纯文字“生产产物／作业制度”下拉选择器。',
    path,
)
text = replace_once(
    text,
    '地区行再切换经营州并复用现有 `BuildingsPage` 工厂详情',
    '地区条目第一行再切换经营州并复用现有 `BuildingsPage` 工厂详情；第二行生产设置只修改该州当前同类工厂集群，不触发页面下钻',
    path,
)
write(path, text)

path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
text = read(path)
text = replace_once(
    text,
    '完整生产配置仍在地区详情。',
    '完整生产配置仍在地区详情。进入工厂地区列表后，每个地区条目同步分为上下两行：第一行保留地区数据并进入详情，第二行提供只作用于该州工厂集群的纯文字生产产物与作业制度下拉；地区条目不增加任何工厂插画或生产配置图标。',
    path,
)
write(path, text)

path = 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md'
text = read(path)
text = replace_once(
    text,
    '客户端下拉候选必须先按已完成科技与正式变体存在性过滤，服务器仍逐州执行科技、配方和生产状态校验；',
    '客户端下拉候选必须先按已完成科技与正式变体存在性过滤，服务器仍逐州执行科技、配方和生产状态校验；工厂地区列表第二行的纯文字下拉只提交该地区一个现有集群，产物切换继续尽量保留当前作业制度并在组合不存在时回退 `standard`，制度切换继续保留当前基础配方；',
    path,
)
write(path, text)

path = 'docs/UI_DESIGN_SYSTEM.md'
text = read(path)
ui_anchor = '第二行两个图标复用 `production-config` 富内容选择器并只在工作区顶层显示候选列表，不得行内展开。'
ui_replacement = ui_anchor + ' 工厂地区列表 `.global-facility-region-row` 同步登记为约 `96px / 88px / 84px` 的两行高度例外，第一行仍使用共享表头列并独占下钻交互，第二行使用无视觉图标的纯文字 `RichSelectInput`；地区条目不得增加 `FacilityIcon`、`ProductArtwork` 或作业制度图标，四边内边距同样统一复用 `--entity-list-inline-padding`。'
text = replace_once(text, ui_anchor, ui_replacement, path)
write(path, text)

path = 'docs/PRIMARY_SURFACE_INSET_DESIGN.md'
text = read(path)
text = replace_once(
    text,
    '点击工厂后出现的地区工厂列表仍保持“地区｜利润／分钟｜拥有｜状态”的共享单行结构。',
    '点击工厂后出现的地区工厂列表继续保持“地区｜利润／分钟｜拥有｜状态”的第一行共享列，但条目同步改为两行结构：第一行负责地区详情下钻，第二行承载纯文字生产产物与作业制度下拉，不加入任何工厂插画或生产配置图标。',
    path,
)
text = replace_once(
    text,
    '一级全局工厂目录只允许按已登记例外把条目高度／跨行工厂插画／第二行方形图标收紧到约 `70px / 46px / 26px`，极窄 `360px` 及以下进一步收紧到约 `68px / 42px / 24px`；地区工厂列表继续使用共享单行密度。',
    '一级全局工厂目录按已登记例外把条目高度／跨行工厂插画／第二行方形图标收紧到约 `88px / 68px / 26px`，极窄 `360px` 及以下进一步收紧到约 `84px / 66px / 24px`；地区工厂列表同步使用约 `88px / 84px` 的两行高度，但第二行只显示纯文字下拉并保持无图标。',
    path,
)
text = replace_once(
    text,
    '工厂类型下的地区工厂列表继续保持共享单行密度。',
    '工厂类型下的地区工厂列表同步保持两行密度、第一行下钻与第二行无图标纯文字生产下拉。',
    path,
)
text = replace_once(
    text,
    '一级全局工厂目录条目必须保持约 `68～76px` 的登记两行高度',
    '一级全局工厂目录和地区工厂列表条目必须保持约 `84～96px` 的登记两行高度',
    path,
)
write(path, text)


# Static anti-regression rules.
path = 'scripts/verify-page-content.mjs'
text = read(path)
text = replace_once(
    text,
    "  '地区行再切换经营州并复用现有 `BuildingsPage` 工厂详情',",
    "  '地区条目第一行再切换经营州并复用现有 `BuildingsPage` 工厂详情；第二行生产设置只修改该州当前同类工厂集群，不触发页面下钻',\n  '地区工厂列表同步登记为相同的两行高度例外',\n  '第二行只使用纯文字“生产产物／作业制度”下拉选择器',",
    path,
)
text = replace_once(
    text,
    "    'className=\"entity-list-row global-facility-region-row\"',\n",
    "    'className=\"entity-list-row global-facility-region-row\"',\n    'className=\"global-facility-region-row__open\"',\n    'className=\"global-facility-region-row__quick-controls\"',\n    \"onValueChange={(value) => void applyRegionalQuickProduction(row, 'product', value)}\",\n    \"onValueChange={(value) => void applyRegionalQuickProduction(row, 'method', value)}\",\n",
    path,
)
text = replace_once(text, "  '--global-facility-catalog-artwork-size: 52px;',", "  '--global-facility-catalog-artwork-size: 72px;',", path)
text = replace_once(
    text,
    "  '.global-facility-catalog-row__quick-selector',\n",
    "  '.global-facility-catalog-row__quick-selector',\n  '/* Global facility region rows mirror the two-line production layout without artwork. */',\n  '.global-facility-region-row__quick-controls {',\n  '.global-facility-region-row__quick-selector .ui-rich-select__trigger {',\n  '--global-facility-region-main-row-size: 44px;',\n",
    path,
)
write(path, text)

path = 'scripts/verify-primary-surface-insets.mjs'
text = read(path)
text = replace_once(
    text,
    "    '点击工厂后出现的地区工厂列表仍保持“地区｜利润／分钟｜拥有｜状态”的共享单行结构',",
    "    '点击工厂后出现的地区工厂列表继续保持“地区｜利润／分钟｜拥有｜状态”的第一行共享列，但条目同步改为两行结构',",
    path,
)
text = replace_once(
    text,
    "    '极窄 `360px` 及以下进一步收紧到约 `68px / 42px / 24px`',",
    "    '极窄 `360px` 及以下进一步收紧到约 `84px / 66px / 24px`',",
    path,
)
text = replace_once(
    text,
    "    '一级全局工厂目录条目必须保持约 `68～76px` 的登记两行高度',",
    "    '一级全局工厂目录和地区工厂列表条目必须保持约 `84～96px` 的登记两行高度',",
    path,
)
text = replace_once(text, "    'expect(row.height).toBeGreaterThanOrEqual(66);',", "    'expect(row.height).toBeGreaterThanOrEqual(82);',", path)
text = replace_once(text, "    'expect(row.height).toBeLessThanOrEqual(80);',", "    'expect(row.height).toBeLessThanOrEqual(98);',", path)
text = replace_once(text, "    'expect(row.height).toBeLessThanOrEqual(58);',", "    \"page.locator('.global-facility-region-row__quick-controls')\",", path)
text = replace_once(
    text,
    "    '.global-facility-region-row__profit,',\n",
    "    '.global-facility-region-row__profit,',\n    '.global-facility-region-row__open {',\n    '.global-facility-region-row__quick-controls {',\n",
    path,
)
write(path, text)


# Browser coverage: region first-line navigation, second-line dropdowns, no icons, and new two-line geometry.
path = 'tests/browser/global-operation-pages.spec.ts'
text = read(path)
old_region_assertions = """  expect(facilityRowHeight).toBeGreaterThan(regionalFacilityRowHeight);\n  expect(facilityRowHeight).toBeGreaterThanOrEqual(68);\n  expect(Math.max(...marketRowHeights)).toBeLessThan(regionalFacilityRowHeight);\n  await expect(regionalFacilityRow.locator('.global-facility-region-row__profit')).toBeVisible();\n  await expect(regionalFacilityRow).toHaveAttribute('aria-label', /单厂利润每分钟/);\n  const regionalProvinceId = await regionalFacilityRow.getAttribute('data-province-id');\n  expect(regionalProvinceId).toBeTruthy();\n  await regionalFacilityRow.click();\n"""
new_region_assertions = """  expect(Math.abs(facilityRowHeight - regionalFacilityRowHeight)).toBeLessThanOrEqual(1);\n  expect(facilityRowHeight).toBeGreaterThanOrEqual(84);\n  expect(regionalFacilityRowHeight).toBeGreaterThanOrEqual(84);\n  expect(Math.max(...marketRowHeights)).toBeLessThan(regionalFacilityRowHeight);\n  await expect(regionalFacilityRow.locator('.global-facility-region-row__profit')).toBeVisible();\n  const regionOpenButton = regionalFacilityRow.locator('.global-facility-region-row__open');\n  await expect(regionOpenButton).toHaveAttribute('aria-label', /单厂利润每分钟/);\n  const regionQuickProduct = regionalFacilityRow.locator('[data-quick-production="product"]');\n  const regionQuickMethod = regionalFacilityRow.locator('[data-quick-production="method"]');\n  await expect(regionQuickProduct).toHaveCount(1);\n  await expect(regionQuickMethod).toHaveCount(1);\n  await expect(regionalFacilityRow.locator('.global-facility-region-row__artwork')).toHaveCount(0);\n  await expect(regionalFacilityRow.locator('.global-facility-region-row__quick-controls .ui-rich-select__visual')).toHaveCount(0);\n  const regionProductSelect = regionQuickProduct.getByRole('combobox');\n  if (await regionProductSelect.isEnabled()) {\n    await regionProductSelect.click();\n    await expect(page.getByRole('listbox')).toBeVisible();\n    expect(await page.getByRole('option').count()).toBeGreaterThan(1);\n    await page.keyboard.press('Escape');\n    await expect(page.getByRole('listbox')).toHaveCount(0);\n    await expect(page.getByRole('heading', { name: firstFacilityName!, exact: true })).toBeVisible();\n  }\n  const regionalProvinceId = await regionalFacilityRow.getAttribute('data-province-id');\n  expect(regionalProvinceId).toBeTruthy();\n  await regionOpenButton.click();\n"""
text = replace_once(text, old_region_assertions, new_region_assertions, path)
write(path, text)

path = 'tests/browser/player-page-geometry.spec.ts'
text = read(path)
text = replace_once(text, '        expect(row.height).toBeGreaterThanOrEqual(66);', '        expect(row.height).toBeGreaterThanOrEqual(82);', path)
text = replace_once(text, '        expect(row.height).toBeLessThanOrEqual(80);', '        expect(row.height).toBeLessThanOrEqual(98);', path)
text = replace_once(
    text,
    '        expect(row.height).toBeLessThanOrEqual(58);',
    '        expect(row.height).toBeGreaterThanOrEqual(82);\n        expect(row.height).toBeLessThanOrEqual(98);',
    path,
)
write(path, text)

path = 'tests/browser/all-pages-preview.spec.ts'
text = read(path)
old_region_fixture = '''            <button class="entity-list-row global-facility-region-row" type="button">\n              <span class="global-facility-region-row__identity"><strong>测试地区</strong></span>\n              <strong class="entity-list-value global-facility-region-row__profit is-positive">1</strong>\n              <strong class="global-facility-region-row__metric">1</strong>\n              <strong class="global-facility-region-row__status">运行中</strong>\n              <span class="global-facility-region-row__chevron"><svg class="game-icon"></svg></span>\n            </button>'''
new_region_fixture = '''            <div class="entity-list-row global-facility-region-row">\n              <button class="global-facility-region-row__open" type="button">\n                <span class="global-facility-region-row__identity"><strong>测试地区</strong></span>\n                <strong class="entity-list-value global-facility-region-row__profit is-positive">1</strong>\n                <strong class="global-facility-region-row__metric">1</strong>\n                <strong class="global-facility-region-row__status">运行中</strong>\n                <span class="global-facility-region-row__chevron"><svg class="game-icon"></svg></span>\n              </button>\n              <span class="global-facility-region-row__quick-controls">\n                <span class="global-facility-region-row__quick-selector" data-quick-production="product"><span class="ui-rich-select"><button class="ui-rich-select__trigger" type="button"><span class="ui-rich-select__value">测试产物</span><span class="ui-rich-select__chevron"></span></button></span></span>\n                <span class="global-facility-region-row__quick-selector" data-quick-production="method"><span class="ui-rich-select"><button class="ui-rich-select__trigger" type="button"><span class="ui-rich-select__value">测试制度</span><span class="ui-rich-select__chevron"></span></button></span></span>\n              </span>\n            </div>'''
text = replace_once(text, old_region_fixture, new_region_fixture, path)
text = replace_once(
    text,
    "      expect(String(facilitySamples[0][key]), 'global facility catalog keeps the registered two-line height').not.toBe(String(facilitySamples[1][key]));",
    "      expect(new Set(facilitySamples.map((sample) => String(sample[key]))).size, 'facility two-line heights should match').toBe(1);",
    path,
)
text = replace_once(
    text,
    "  expect(facilitySamples[0].paddingTop).toBe(facilitySamples[0].paddingLeft);\n",
    "  expect(facilitySamples[0].paddingTop).toBe(facilitySamples[0].paddingLeft);\n  expect(facilitySamples[1].paddingTop).toBe(facilitySamples[1].paddingRight);\n  expect(facilitySamples[1].paddingTop).toBe(facilitySamples[1].paddingBottom);\n  expect(facilitySamples[1].paddingTop).toBe(facilitySamples[1].paddingLeft);\n",
    path,
)
old_density_branch = """    if (densityKeys.has(key)) {\n      expect(new Set(marketSamples.map((sample) => String(sample[key]))).size, `${key} should match inside commodity lists`).toBe(1);\n      expect(String(marketSamples[0][key]), `${key} should keep the commodity density exception`).not.toBe(String(facilitySamples[1][key]));\n      continue;\n    }\n"""
new_density_branch = """    if (densityKeys.has(key)) {\n      expect(new Set(marketSamples.map((sample) => String(sample[key]))).size, `${key} should match inside commodity lists`).toBe(1);\n      expect(new Set(facilitySamples.map((sample) => String(sample[key]))).size, `${key} should match inside facility two-line lists`).toBe(1);\n      expect(String(marketSamples[0][key]), `${key} should keep the commodity density exception`).not.toBe(String(facilitySamples[0][key]));\n      continue;\n    }\n"""
text = replace_once(text, old_density_branch, new_density_branch, path)
write(path, text)

print('Applied regional building two-line production controls and geometry updates')