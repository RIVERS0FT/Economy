from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8', newline='\n')


def replace_once(text, old, new, path):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one occurrence, got {count}: {old[:100]!r}')
    return text.replace(old, new, 1)


def sub_once(text, pattern, repl, path, flags=0):
    updated, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{path}: regex expected one occurrence, got {count}: {pattern[:100]!r}')
    return updated

# Shared RichSelect: mixed cross-region state must be able to re-select the displayed option to unify all regions.
path = 'src/components/ui/RichSelectInput.tsx'
text = read(path)
text = replace_once(text, "  variant = 'default',\n  'aria-label': ariaLabel,", "  variant = 'default',\n  notifyOnReselect = false,\n  'aria-label': ariaLabel,", path)
text = replace_once(text, "  variant?: RichSelectVariant;\n  'aria-label'?: string;", "  variant?: RichSelectVariant;\n  notifyOnReselect?: boolean;\n  'aria-label'?: string;", path)
text = replace_once(text, "    if (option.value !== value) onValueChange(option.value);", "    if (option.value !== value || notifyOnReselect) onValueChange(option.value);", path)
text = replace_once(text, "  }, [closeList, onValueChange, options, value]);", "  }, [closeList, notifyOnReselect, onValueChange, options, value]);", path)
write(path, text)

# Global buildings: first-row-only drilldown + real top-layer RichSelect controls.
path = 'src/pages/GlobalBuildingsPage.tsx'
text = read(path)
text = replace_once(
    text,
    "} from '../components/ui/EntityListHeader';\n",
    "} from '../components/ui/EntityListHeader';\nimport { RichSelectInput } from '../components/ui/RichSelectInput';\n",
    path,
)
text = sub_once(
    text,
    r"\nfunction nextCatalogOption<T extends \{ id: string \}>\(options: T\[], currentId: string\) \{\n  if \(options\.length < 2\) return options\[0\];\n  const index = options\.findIndex\(\(option\) => option\.id === currentId\);\n  return options\[\(index < 0 \? 0 : index \+ 1\) % options\.length\];\n\}\n",
    "\n",
    path,
)
old_function = """  const cycleQuickProduction = async (\n    row: (typeof facilityRows)[number],\n    target: 'product' | 'method',\n  ) => {\n    const quick = row.quickProduction;\n    const type = game.facilityTypes.find((candidate) => candidate.id === row.facilityTypeId);\n    if (!quick || !type || pendingQuickFacilityTypeIds.has(row.facilityTypeId)) return;\n\n    const next = target === 'product'\n      ? nextCatalogOption(quick.productOptions, quick.targets[0]?.baseRecipeId ?? quick.productOptions[0]?.id ?? '')\n      : nextCatalogOption(quick.methodOptions, quick.targets[0]?.methodId ?? quick.methodId);\n    if (!next) return;\n\n    const targets = quick.targets.flatMap((current) => {\n      const recipeId = target === 'product'\n        ? productionRecipeVariantId(type, next.id, current.methodId)\n          ?? productionRecipeVariantId(type, next.id, 'standard')\n        : productionRecipeVariantId(type, current.baseRecipeId, next.id as FacilityProductionMethodId);\n      return recipeId ? [{\n        provinceId: current.provinceId,\n        facilityTypeId: row.facilityTypeId,\n        recipeId,\n      }] : [];\n    });\n"""
new_function = """  const applyQuickProduction = async (\n    row: (typeof facilityRows)[number],\n    target: 'product' | 'method',\n    nextValue: string,\n  ) => {\n    const quick = row.quickProduction;\n    const type = game.facilityTypes.find((candidate) => candidate.id === row.facilityTypeId);\n    if (!quick || !type || !nextValue || pendingQuickFacilityTypeIds.has(row.facilityTypeId)) return;\n\n    const alreadyApplied = quick.targets.every((current) => (\n      target === 'product' ? current.baseRecipeId === nextValue : current.methodId === nextValue\n    ));\n    if (alreadyApplied) return;\n\n    const targets = quick.targets.flatMap((current) => {\n      const recipeId = target === 'product'\n        ? productionRecipeVariantId(type, nextValue, current.methodId)\n          ?? productionRecipeVariantId(type, nextValue, 'standard')\n        : productionRecipeVariantId(type, current.baseRecipeId, nextValue as FacilityProductionMethodId);\n      return recipeId ? [{\n        provinceId: current.provinceId,\n        facilityTypeId: row.facilityTypeId,\n        recipeId,\n      }] : [];\n    });\n"""
text = replace_once(text, old_function, new_function, path)
text = replace_once(text, "                      data-ui-interactive=\"surface\"\n                      data-quick-production-row", "                      data-quick-production-row", path)
row_pattern = r'''                      <button\n                        type="button"\n                        className="global-facility-catalog-row__open"[\s\S]*?                      <span className="global-facility-catalog-row__chevron" aria-hidden="true">\n                        <ChevronIcon direction="right" />\n                      </span>'''
row_replacement = '''                      <FacilityIcon\n                        facilityTypeId={row.facilityTypeId}\n                        className="global-facility-catalog-row__artwork"\n                      />\n                      <button\n                        type="button"\n                        className="global-facility-catalog-row__open"\n                        data-ui-interactive="surface"\n                        aria-label={`打开${row.name}地区工厂，拥有 ${formatNumber(row.totalCount)} 座，跨州单厂平均利润每分钟：${row.profitAccessibleValue}`}\n                        title={row.profitDetail}\n                        onClick={() => openGlobalFacility(row.facilityTypeId)}\n                      >\n                        <span className="global-facility-catalog-row__identity">\n                          <strong>{row.name}</strong>\n                        </span>\n                        <strong\n                          className={`entity-list-value global-facility-catalog-row__metric global-facility-catalog-row__profit is-${row.profitTone}`}\n                          title={row.profitDetail}\n                        >\n                          {row.profitValue}\n                        </strong>\n                        <strong className="global-facility-catalog-row__metric">{<CompactNumber value={row.totalCount} />}</strong>\n                        <span className="global-facility-catalog-row__chevron" aria-hidden="true">\n                          <ChevronIcon direction="right" />\n                        </span>\n                      </button>\n                      {row.quickProduction ? (\n                        <span className="global-facility-catalog-row__quick-controls" aria-label={`${row.name}生产配置`}>\n                          <span\n                            className="global-facility-catalog-row__quick-selector"\n                            data-quick-production="product"\n                            data-mixed={row.quickProduction.productMixed ? 'true' : undefined}\n                          >\n                            <RichSelectInput\n                              label="生产产物"\n                              fieldClassName="global-facility-catalog-row__quick-field"\n                              variant="production-config"\n                              value={row.quickProduction.targets[0]?.baseRecipeId ?? row.quickProduction.productOptions[0]?.id ?? ''}\n                              options={row.quickProduction.productOptions.map((option) => ({\n                                value: option.id,\n                                label: option.name,\n                                visual: <ProductArtwork productId={option.productId} />,\n                              }))}\n                              notifyOnReselect={row.quickProduction.productMixed}\n                              disabled={row.quickProduction.productOptions.length < 2 || pendingQuickFacilityTypeIds.has(row.facilityTypeId)}\n                              aria-label={`${row.name}生产产物：${row.quickProduction.productMixed ? '各地区不同，当前显示' : ''}${row.quickProduction.productName}`}\n                              onValueChange={(value) => void applyQuickProduction(row, 'product', value)}\n                            />\n                          </span>\n                          <span\n                            className="global-facility-catalog-row__quick-selector"\n                            data-quick-production="method"\n                            data-mixed={row.quickProduction.methodMixed ? 'true' : undefined}\n                          >\n                            <RichSelectInput\n                              label="作业制度"\n                              fieldClassName="global-facility-catalog-row__quick-field"\n                              variant="production-config"\n                              value={row.quickProduction.targets[0]?.methodId ?? row.quickProduction.methodId}\n                              options={row.quickProduction.methodOptions.map((option) => ({\n                                value: option.id,\n                                label: option.name,\n                                visual: <QuickProductionMethodIcon methodId={option.id as FacilityProductionMethodId} />,\n                              }))}\n                              notifyOnReselect={row.quickProduction.methodMixed}\n                              disabled={row.quickProduction.methodOptions.length < 2 || pendingQuickFacilityTypeIds.has(row.facilityTypeId)}\n                              aria-label={`${row.name}作业制度：${row.quickProduction.methodMixed ? '各地区不同，当前显示' : ''}${row.quickProduction.methodName}`}\n                              onValueChange={(value) => void applyQuickProduction(row, 'method', value)}\n                            />\n                          </span>\n                        </span>\n                      ) : null}'''
text = sub_once(text, row_pattern, row_replacement, path, flags=re.S)
write(path, text)

# Two-row geometry: equal four-side padding, first-row drilldown only, compact RichSelect triggers.
path = 'src/styles/global-operation-pages.css'
text = read(path)
pattern = r"/\* Global building catalog quick production: registered two-line row exception\. \*/[\s\S]*\Z"
replacement = r'''/* Global building catalog quick production: registered two-line row exception. */
.entity-list-row.global-facility-catalog-row {
  --entity-list-row-height: 76px;
  --global-facility-catalog-artwork-size: 52px;
  --global-facility-catalog-main-row-size: 28px;
  --global-facility-catalog-quick-size: 28px;
  --global-facility-catalog-row-gap: 4px;
  position: relative;
  grid-template-rows: var(--global-facility-catalog-main-row-size) var(--global-facility-catalog-quick-size);
  align-content: center;
  align-items: center;
  row-gap: var(--global-facility-catalog-row-gap);
  padding: var(--entity-list-inline-padding);
  overflow: visible;
}

.global-facility-catalog-row__artwork {
  position: absolute;
  z-index: 2;
  top: 50%;
  left: var(--entity-list-inline-padding);
  width: var(--global-facility-catalog-artwork-size);
  height: var(--global-facility-catalog-artwork-size);
  min-width: var(--global-facility-catalog-artwork-size);
  transform: translateY(-50%);
  pointer-events: none;
}

.global-facility-catalog-row__open {
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
  max-height: none;
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

.global-facility-catalog-row__identity {
  min-width: 0;
  display: flex;
  align-items: center;
  padding-left: calc(var(--global-facility-catalog-artwork-size) + .45rem);
  overflow: hidden;
  pointer-events: none;
}

.global-facility-catalog-row__identity > strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-facility-catalog-row__quick-controls {
  grid-column: 1;
  grid-row: 2;
  z-index: 3;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: .28rem;
  padding-left: calc(var(--global-facility-catalog-artwork-size) + .45rem);
}

.global-facility-catalog-row__quick-selector,
.global-facility-catalog-row__quick-field,
.global-facility-catalog-row__quick-field > .ui-rich-select {
  width: var(--global-facility-catalog-quick-size);
  min-width: var(--global-facility-catalog-quick-size);
  height: var(--global-facility-catalog-quick-size);
  min-height: 0;
  display: block;
}

.global-facility-catalog-row__quick-field {
  gap: 0;
}

.global-facility-catalog-row__quick-field > .ui-form-field__label {
  display: none;
}

.global-facility-catalog-row__quick-selector .ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger {
  width: var(--global-facility-catalog-quick-size);
  min-width: var(--global-facility-catalog-quick-size);
  max-width: var(--global-facility-catalog-quick-size);
  height: var(--global-facility-catalog-quick-size);
  min-height: var(--global-facility-catalog-quick-size);
  max-height: var(--global-facility-catalog-quick-size);
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-control);
  padding: 2px;
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--color-surface-inset) 82%, transparent);
}

.global-facility-catalog-row__quick-selector[data-mixed='true'] .ui-rich-select__trigger {
  border-style: dashed;
  opacity: .72;
}

.global-facility-catalog-row__quick-selector .ui-rich-select__trigger:disabled {
  opacity: 1;
  cursor: default;
}

.global-facility-catalog-row__quick-selector[data-mixed='true'] .ui-rich-select__trigger:disabled {
  opacity: .72;
}

.global-facility-catalog-row__quick-selector .ui-rich-select__trigger .ui-rich-select__visual,
.global-facility-catalog-row__quick-selector .ui-rich-select__trigger .product-artwork,
.global-facility-catalog-row__quick-selector .ui-rich-select__trigger .game-icon {
  width: 100%;
  height: 100%;
}

.global-facility-catalog-row__metric,
.global-facility-catalog-row__chevron {
  min-width: 0;
  pointer-events: none;
}

.global-facility-catalog-row__chevron {
  display: grid;
  place-items: center;
  color: var(--color-text-secondary);
}

@container (max-width: 620px) {
  .entity-list-row.global-facility-catalog-row {
    --entity-list-row-height: 70px;
    --global-facility-catalog-artwork-size: 46px;
    --global-facility-catalog-main-row-size: 28px;
    --global-facility-catalog-quick-size: 26px;
    --global-facility-catalog-row-gap: 2px;
  }

  .global-facility-catalog-row__identity,
  .global-facility-catalog-row__quick-controls {
    padding-left: calc(var(--global-facility-catalog-artwork-size) + .32rem);
  }

  .global-facility-catalog-row__quick-controls {
    gap: .2rem;
  }
}

@container (max-width: 360px) {
  .entity-list-row.global-facility-catalog-row {
    --entity-list-row-height: 68px;
    --global-facility-catalog-artwork-size: 42px;
    --global-facility-catalog-main-row-size: 27px;
    --global-facility-catalog-quick-size: 24px;
    --global-facility-catalog-row-gap: 1px;
  }

  .global-facility-catalog-row__identity,
  .global-facility-catalog-row__quick-controls {
    padding-left: calc(var(--global-facility-catalog-artwork-size) + .24rem);
  }
}
'''
text = sub_once(text, pattern, replacement, path, flags=re.S)
write(path, text)

# Authoritative design updates.
path = 'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md'
text = read(path)
old = '第二行只在工厂身份列内显示“当前生产产物”和“当前作业制度”两个方形图标，不得显示文字标题、字段名、状态胶囊、保存按钮、展开详情、下拉框或浮出的选择面板。点击任一图标按正式目录顺序循环到下一个当前已解锁且对该工厂有效的选项；没有第二个可用选项时图标保持只读。'
new = '第二行只在工厂身份列内显示“当前生产产物”和“当前作业制度”两个方形图标，不得显示文字标题、字段名、状态胶囊、保存按钮或行内展开详情。两个图标分别作为紧凑富内容下拉选择器的触发面；点击后只允许在工作区顶层浮出当前已解锁且对该工厂有效的候选，不得撑开条目、插入第三行或新增独立配置面板；没有第二个可用选项时图标保持只读。'
text = replace_once(text, old, new, path)
text = replace_once(
    text,
    '全局工厂条目的第一行原数据区域继续作为进入该工厂类型地区列表的主交互面；第二行两个生产图标只修改生产配置，不触发页面下钻。',
    '全局工厂条目只有第一行原数据区域作为进入该工厂类型地区列表的主交互面，地区下钻按钮不得覆盖第二行；第二行两个生产选择器只修改生产配置，不触发页面下钻。',
    path,
)
text = replace_once(
    text,
    '一级全局工厂目录是通用实体列表中明确登记的两行高度例外，地区工厂列表仍保持共享单行高度。',
    '一级全局工厂目录是通用实体列表中明确登记的两行高度例外，条目自身四边必须统一使用同一个共享列表横向内边距令牌，禁止分别设置上下与左右内边距；地区工厂列表仍保持共享单行高度。',
    path,
)
write(path, text)

path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
text = read(path)
text = replace_once(
    text,
    '唯一快捷写入口是一级工厂目录第二行的生产产物与作业制度两个图标：它们不展开额外内容，只把同一次选择逐州提交给当前玩家已解锁且实际持有该工厂的现有地区集群，不创建全国级生产状态；完整生产配置仍在地区详情。',
    '唯一快捷写入口是一级工厂目录第二行的生产产物与作业制度两个图标式富内容下拉选择器：触发器保留在第二行，候选列表只允许在工作区顶层浮出，不得在条目内部展开；选定后把同一次选择逐州提交给当前玩家已解锁且实际持有该工厂的现有地区集群，不创建全国级生产状态；完整生产配置仍在地区详情。',
    path,
)
write(path, text)

path = 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md'
text = read(path)
text = replace_once(
    text,
    '客户端循环项必须先按已完成科技与正式变体存在性过滤，服务器仍逐州执行科技、配方和生产状态校验；',
    '客户端下拉候选必须先按已完成科技与正式变体存在性过滤，服务器仍逐州执行科技、配方和生产状态校验；',
    path,
)
write(path, text)

path = 'docs/UI_DESIGN_SYSTEM.md'
text = read(path)
old = '一级全局建筑 `.global-facility-catalog-row` 为容纳第二行两个图标生产设置，登记为约 `76px / 70px / 68px` 的两行高度例外，第一行继续对齐共享表头，`FacilityIcon` 正方形插画跨两行，第二行只允许留在身份列。'
new = '一级全局建筑 `.global-facility-catalog-row` 为容纳第二行两个图标生产设置，登记为约 `76px / 70px / 68px` 的两行高度例外，第一行继续对齐共享表头，`FacilityIcon` 正方形插画跨两行，第二行只允许留在身份列；该条目四边内边距必须使用同一个共享列表横向内边距令牌，地区下钻主按钮只覆盖第一行，第二行两个图标复用 `production-config` 富内容选择器并只在工作区顶层显示候选列表，不得行内展开。'
text = replace_once(text, old, new, path)
write(path, text)

path = 'docs/PRIMARY_SURFACE_INSET_DESIGN.md'
text = read(path)
old = '一级建筑页只保留全局工厂目录，不再存在独立地区建筑卡片；全局工厂目录第一行继续保持“工厂｜平均利润／分钟｜拥有”的共享表头结构，一级目录条目登记为两行高度例外，第二行仅在工厂身份列内承载“当前生产产物／当前作业制度”两个方形图标，正方形工厂插画跨越两行。点击工厂后出现的地区工厂列表仍保持“地区｜利润／分钟｜拥有｜状态”的共享单行结构。'
new = '一级建筑页只保留全局工厂目录，不再存在独立地区建筑卡片；全局工厂目录第一行继续保持“工厂｜平均利润／分钟｜拥有”的共享表头结构，一级目录条目登记为两行高度例外，第二行仅在工厂身份列内承载“当前生产产物／当前作业制度”两个方形图标，正方形工厂插画跨越两行。条目四边统一使用同一个 `--entity-list-inline-padding`，地区下钻按钮只覆盖第一行；第二行图标的候选菜单使用工作区顶层浮层，不得通过改变条目高度显示。点击工厂后出现的地区工厂列表仍保持“地区｜利润／分钟｜拥有｜状态”的共享单行结构。'
text = replace_once(text, old, new, path)
text = replace_once(
    text,
    '一级全局工厂目录在 `620px`、`360px` 实际承载断点保持已登记的两行高度与身份列图标例外，第一行共享列、横向 padding、gap 和 Chevron 仍由 `entity-list-header.css` 控制；',
    '一级全局工厂目录在 `620px`、`360px` 实际承载断点保持已登记的两行高度与身份列图标例外，第一行共享列、gap 和 Chevron 仍由 `entity-list-header.css` 控制，条目四边必须统一复用其 `--entity-list-inline-padding`；',
    path,
)
write(path, text)

# Static anti-regression verifier.
path = 'scripts/verify-page-content.mjs'
text = read(path)
text = replace_once(text, "  'src/components/ui/layout.tsx',\n", "  'src/components/ui/layout.tsx',\n  'src/components/ui/RichSelectInput.tsx',\n", path)
text = replace_once(
    text,
    "  '不得显示文字标题、字段名、状态胶囊、保存按钮、展开详情、下拉框或浮出的选择面板',",
    "  '两个图标分别作为紧凑富内容下拉选择器的触发面',\n  '地区下钻按钮不得覆盖第二行',",
    path,
)
text = replace_once(
    text,
    "    'model.setFacilityRecipes(targets)',\n",
    "    'model.setFacilityRecipes(targets)',\n    '<RichSelectInput',\n    'variant=\"production-config\"',\n    'notifyOnReselect={row.quickProduction.productMixed}',\n    \"onValueChange={(value) => void applyQuickProduction(row, 'product', value)}\",\n",
    path,
)
text = replace_once(text, "for (const text of [\n  '<RichSelectInput',\n  '>快捷生产设置<',\n]) forbidText('src/pages/GlobalBuildingsPage.tsx', text);", "for (const text of [\n  '>快捷生产设置<',\n  'nextCatalogOption',\n]) forbidText('src/pages/GlobalBuildingsPage.tsx', text);", path)
text = replace_once(
    text,
    "  'min-height: var(--global-facility-catalog-quick-size);',\n  'height: 34px;',",
    "  'padding: var(--entity-list-inline-padding);',\n  'grid-row: 1;',\n  'min-height: 0;',\n  '.global-facility-catalog-row__quick-selector',\n  \".ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger\",",
    path,
)
text = replace_once(
    text,
    "]) requireText('src/styles/global-operation-pages.css', text);",
    "]) requireText('src/styles/global-operation-pages.css', text);\nfor (const text of [\n  'notifyOnReselect = false,',\n  'notifyOnReselect?: boolean;',\n  'option.value !== value || notifyOnReselect',\n]) requireText('src/components/ui/RichSelectInput.tsx', text);",
    path,
)
write(path, text)

path = 'scripts/verify-primary-surface-insets.mjs'
text = read(path)
text = replace_once(
    text,
    "    '.global-facility-catalog-row__artwork {',\n",
    "    '.global-facility-catalog-row__artwork {',\n    'padding: var(--entity-list-inline-padding);',\n    '.global-facility-catalog-row__open {',\n    'grid-row: 1;',\n    'min-height: 0;',\n",
    path,
)
text = replace_once(
    text,
    "    '通用列间距、横向内边距与 Chevron 轨道必须复用 `entity-list-header.css` 的页面列表共享令牌',\n",
    "    '通用列间距、横向内边距与 Chevron 轨道必须复用 `entity-list-header.css` 的页面列表共享令牌',\n    '条目四边统一使用同一个 `--entity-list-inline-padding`',\n    '地区下钻按钮只覆盖第一行',\n",
    path,
)
write(path, text)

# Browser regression: first-line click target, dropdown visibility, equal padding.
path = 'tests/browser/global-operation-pages.spec.ts'
text = read(path)
old = """  const nameBox = await firstGlobalFacilityRow.locator('.global-facility-catalog-row__identity > strong').boundingBox();\n  const productBox = await quickProduct.boundingBox();\n  const methodBox = await quickMethod.boundingBox();\n  expect(nameBox).not.toBeNull();\n  expect(productBox).not.toBeNull();\n  expect(methodBox).not.toBeNull();\n  if (!nameBox || !productBox || !methodBox) throw new Error('全局工厂两行布局未完整渲染');\n  expect(artworkBox.y).toBeLessThanOrEqual(nameBox.y + 1);\n  expect(artworkBox.y + artworkBox.height).toBeGreaterThanOrEqual(productBox.y + productBox.height - 1);\n  expect(Math.abs(productBox.width - productBox.height)).toBeLessThan(1);\n  expect(Math.abs(methodBox.width - methodBox.height)).toBeLessThan(1);\n\n  await firstGlobalFacilityRow.locator('.global-facility-catalog-row__open').click();\n"""
new = """  const nameBox = await firstGlobalFacilityRow.locator('.global-facility-catalog-row__identity > strong').boundingBox();\n  const productBox = await quickProduct.boundingBox();\n  const methodBox = await quickMethod.boundingBox();\n  const openButton = firstGlobalFacilityRow.locator('.global-facility-catalog-row__open');\n  const openBox = await openButton.boundingBox();\n  expect(nameBox).not.toBeNull();\n  expect(productBox).not.toBeNull();\n  expect(methodBox).not.toBeNull();\n  expect(openBox).not.toBeNull();\n  if (!nameBox || !productBox || !methodBox || !openBox) throw new Error('全局工厂两行布局未完整渲染');\n  expect(artworkBox.y).toBeLessThanOrEqual(nameBox.y + 1);\n  expect(artworkBox.y + artworkBox.height).toBeGreaterThanOrEqual(productBox.y + productBox.height - 1);\n  expect(Math.abs(productBox.width - productBox.height)).toBeLessThan(1);\n  expect(Math.abs(methodBox.width - methodBox.height)).toBeLessThan(1);\n  expect(openBox.y + openBox.height).toBeLessThanOrEqual(productBox.y + 1);\n  const rowPadding = await firstGlobalFacilityRow.evaluate((element) => {\n    const style = getComputedStyle(element);\n    return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];\n  });\n  expect(new Set(rowPadding).size).toBe(1);\n\n  const productSelect = quickProduct.getByRole('combobox');\n  if (await productSelect.isEnabled()) {\n    await productSelect.click();\n    await expect(page.getByRole('listbox')).toBeVisible();\n    expect(await page.getByRole('option').count()).toBeGreaterThan(1);\n    await page.keyboard.press('Escape');\n    await expect(page.getByRole('listbox')).toHaveCount(0);\n    await expect(page.getByRole('heading', { name: '建筑', exact: true })).toBeVisible();\n  }\n\n  await openButton.click();\n"""
text = replace_once(text, old, new, path)
write(path, text)

path = 'tests/browser/all-pages-preview.spec.ts'
text = read(path)
text = replace_once(
    text,
    "      const chevron = row?.lastElementChild as HTMLElement | null;",
    "      const chevron = row?.querySelector<HTMLElement>('.global-market-goods-row__chevron, .market-commodity-row__chevron, .global-facility-catalog-row__chevron, .global-facility-region-row__chevron') ?? null;",
    path,
)
old_fixture = '''            <div class="entity-list-row global-facility-catalog-row">\n              <button class="global-facility-catalog-row__open" type="button"></button>\n              <span class="global-facility-catalog-row__identity">\n                <svg class="global-facility-catalog-row__artwork"></svg>\n                <strong>测试工厂</strong>\n                <span class="global-facility-catalog-row__quick-controls">\n                  <button class="global-facility-catalog-row__quick-control" data-quick-production="product" type="button"><span class="product-artwork"></span></button>\n                  <button class="global-facility-catalog-row__quick-control" data-quick-production="method" type="button"><svg class="game-icon"></svg></button>\n                </span>\n              </span>\n              <strong class="entity-list-value global-facility-catalog-row__metric global-facility-catalog-row__profit is-positive">1</strong>\n              <strong class="global-facility-catalog-row__metric">1</strong>\n              <span class="global-facility-catalog-row__chevron"><svg class="game-icon"></svg></span>\n            </div>'''
new_fixture = '''            <div class="entity-list-row global-facility-catalog-row">\n              <svg class="global-facility-catalog-row__artwork"></svg>\n              <button class="global-facility-catalog-row__open" type="button">\n                <span class="global-facility-catalog-row__identity"><strong>测试工厂</strong></span>\n                <strong class="entity-list-value global-facility-catalog-row__metric global-facility-catalog-row__profit is-positive">1</strong>\n                <strong class="global-facility-catalog-row__metric">1</strong>\n                <span class="global-facility-catalog-row__chevron"><svg class="game-icon"></svg></span>\n              </button>\n              <span class="global-facility-catalog-row__quick-controls">\n                <span class="global-facility-catalog-row__quick-selector" data-quick-production="product"><span class="ui-rich-select" data-variant="production-config"><button class="ui-rich-select__trigger" type="button"><span class="ui-rich-select__visual"><span class="product-artwork"></span></span></button></span></span>\n                <span class="global-facility-catalog-row__quick-selector" data-quick-production="method"><span class="ui-rich-select" data-variant="production-config"><button class="ui-rich-select__trigger" type="button"><span class="ui-rich-select__visual"><svg class="game-icon"></svg></span></button></span></span>\n              </span>\n            </div>'''
text = replace_once(text, old_fixture, new_fixture, path)
# Stop treating global two-line row vertical padding as identical to the generic regional row; lock equal four-side inset instead.
old_density = """  const densityKeys = new Set<keyof typeof samples[number]>(['paddingTop', 'paddingBottom']);\n  for (const key of Object.keys(samples[0]) as Array<keyof typeof samples[number]>) {\n"""
new_density = """  const densityKeys = new Set<keyof typeof samples[number]>(['paddingTop', 'paddingBottom']);\n  expect(facilitySamples[0].paddingTop).toBe(facilitySamples[0].paddingRight);\n  expect(facilitySamples[0].paddingTop).toBe(facilitySamples[0].paddingBottom);\n  expect(facilitySamples[0].paddingTop).toBe(facilitySamples[0].paddingLeft);\n  for (const key of Object.keys(samples[0]) as Array<keyof typeof samples[number]>) {\n"""
text = replace_once(text, old_density, new_density, path)
old_density_branch = """    if (densityKeys.has(key)) {\n      expect(new Set(marketSamples.map((sample) => String(sample[key]))).size, `${key} should match inside commodity lists`).toBe(1);\n      expect(new Set(facilitySamples.map((sample) => String(sample[key]))).size, `${key} should match inside facility lists`).toBe(1);\n      expect(String(marketSamples[0][key]), `${key} should keep the commodity density exception`).not.toBe(String(facilitySamples[0][key]));\n      continue;\n    }\n"""
new_density_branch = """    if (densityKeys.has(key)) {\n      expect(new Set(marketSamples.map((sample) => String(sample[key]))).size, `${key} should match inside commodity lists`).toBe(1);\n      expect(String(marketSamples[0][key]), `${key} should keep the commodity density exception`).not.toBe(String(facilitySamples[1][key]));\n      continue;\n    }\n"""
text = replace_once(text, old_density_branch, new_density_branch, path)
write(path, text)

print('Applied global building row interaction fixes')
