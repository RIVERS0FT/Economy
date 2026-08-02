from pathlib import Path


def replace_one(path: str, old: str, new: str) -> None:
    target = Path(path)
    content = target.read_text(encoding='utf-8')
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path} 目标出现 {count} 次，预期 1 次: {old[:80]}')
    target.write_text(content.replace(old, new), encoding='utf-8')


def append_before(path: str, marker: str, addition: str) -> None:
    target = Path(path)
    content = target.read_text(encoding='utf-8')
    if addition.strip() in content:
        return
    if content.count(marker) != 1:
        raise RuntimeError(f'{path} 插入标记不唯一: {marker}')
    target.write_text(content.replace(marker, addition + marker), encoding='utf-8')


# Production settlement uses actual PNG artwork instead of the compact product SVG.
replace_one(
    'src/components/facilities/FacilityProductionFormula.tsx',
    "import { ProductIcon } from '../icons/ProductIcons';",
    "import { ProductArtwork } from '../products/ProductArtwork';",
)
replace_one(
    'src/components/facilities/FacilityProductionFormula.tsx',
    '<ProductIcon productId={item.productId} />',
    '<ProductArtwork productId={item.productId} className="facility-formula-product-artwork" />',
)
replace_one(
    'src/styles/facility-production-formula.css',
    ".facility-formula-input-item > .product-icon,\n.facility-formula-output-item > .product-icon {\n  flex: 0 0 auto;\n  width: 1.5rem;\n  height: 1.5rem;\n  color: var(--color-warning);\n  filter: drop-shadow(0 1px 1px color-mix(in srgb, var(--color-bg-deep) 72%, transparent));\n}",
    ".facility-formula-product-artwork {\n  flex: 0 0 auto;\n  width: 1.85rem;\n  height: 1.85rem;\n  filter: drop-shadow(0 2px 2px color-mix(in srgb, var(--color-bg-deep) 72%, transparent));\n}",
)
replace_one(
    'src/styles/facility-production-formula.css',
    "  .facility-formula-input-item > .product-icon,\n  .facility-formula-output-item > .product-icon {\n    width: 1.25rem;\n    height: 1.25rem;\n  }",
    "  .facility-formula-product-artwork {\n    width: 1.55rem;\n    height: 1.55rem;\n  }",
)

# Product artwork is a real non-SVG element and is approved in production formula/rich selects.
append_before(
    'src/styles/product-artwork.css',
    ':is(\n  .warehouse-product-card-icon,',
    ".product-artwork {\n  display: inline-block;\n  flex: 0 0 auto;\n  background-image: var(--product-artwork-image, none);\n  background-position: center;\n  background-repeat: no-repeat;\n  background-size: contain;\n}\n\n",
)
append_before(
    'src/styles/product-artwork.css',
    '@media (prefers-reduced-data: reduce) {',
    "@media (prefers-reduced-data: reduce) {\n  .product-artwork {\n    background-image: none;\n  }\n}\n\n",
)

# Replace production settings native selects with one shared rich select implementation.
replace_one(
    'src/pages/production/ProductionFacilityDetail.tsx',
    "import { ProductIcon } from '../../components/icons/ProductIcons';",
    "import { ProductArtwork } from '../../components/products/ProductArtwork';",
)
replace_one(
    'src/pages/production/ProductionFacilityDetail.tsx',
    "import { SelectInput } from '../../components/ui/FormControls';",
    "import { RichSelectInput } from '../../components/ui/RichSelectInput';",
)
replace_one(
    'src/pages/production/ProductionFacilityDetail.tsx',
    "  const selectedBaseRecipe = recipeState.recipes.find(\n    (recipe) => recipe.id === recipeState.selectedBaseRecipeId,\n  ) ?? recipeState.activeBaseRecipe;\n",
    '',
)
replace_one(
    'src/pages/production/ProductionFacilityDetail.tsx',
    '''          <SelectInput
            label="生产配方"
            aria-label={`${type.name}生产配方`}
            leadingIcon={<ProductIcon productId={selectedBaseRecipe.output.productId} />}
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
          </SelectInput>''',
    '''          <RichSelectInput
            label="生产产物"
            aria-label={`${type.name}生产产物`}
            value={recipeState.selectedBaseRecipeId}
            options={recipeState.recipes.map((recipe) => ({
              value: recipe.id,
              label: recipe.name,
              visual: <ProductArtwork productId={recipe.output.productId} />,
            }))}
            disabled={group.count < 1 || recipeState.recipes.length === 0}
            onValueChange={(baseRecipeId) => {
              selectConfiguration(baseRecipeId, recipeState.selectedProductionMethodId);
            }}
          />''',
)
replace_one(
    'src/pages/production/ProductionFacilityDetail.tsx',
    '''            <SelectInput
              label={recipeState.productionMethodGroup.name}
              aria-label={`${type.name}生产方式`}
              leadingIcon={<ProductionMethodIcon methodId={recipeState.selectedProductionMethodId} />}
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
            </SelectInput>''',
    '''            <RichSelectInput
              label={recipeState.productionMethodGroup.name}
              aria-label={`${type.name}生产方式`}
              value={recipeState.selectedProductionMethodId}
              options={recipeState.productionMethodGroup.methods.map((method) => ({
                value: method.id,
                label: method.name,
                disabled: !method.plansByRecipeId[recipeState.selectedBaseRecipeId],
                visual: <ProductionMethodIcon methodId={method.id} />,
              }))}
              disabled={group.count < 1}
              onValueChange={(methodId) => {
                selectConfiguration(
                  recipeState.selectedBaseRecipeId,
                  methodId as FacilityProductionMethodId,
                );
              }}
            />''',
)

# Rename player-visible recipe wording without changing protocol/domain identifiers.
production_page = Path('src/pages/ProductionPage.tsx')
page_content = production_page.read_text(encoding='utf-8')
for old, new in [
    ('<strong>生产配方</strong>', '<strong>生产产物</strong>'),
    ('`可选配方：${selectedRecipes.map((recipe) => recipe.name).join(\'／\')}`', '`可选产物：${selectedRecipes.map((recipe) => recipe.name).join(\'／\')}`'),
    ('`固定配方：${selectedRecipes[0]?.name ?? selectedType.name}`', '`固定产物：${selectedRecipes[0]?.name ?? selectedType.name}`'),
]:
    if page_content.count(old) != 1:
        raise RuntimeError(f'ProductionPage 文案目标不唯一: {old}')
    page_content = page_content.replace(old, new)
production_page.write_text(page_content, encoding='utf-8')

# Shared rich dropdown visuals live in the final form-control stylesheet.
form_css_addition = r'''

.ui-rich-select {
  min-width: 0;
  display: block;
}

.ui-rich-select__trigger {
  width: 100%;
  min-width: 0;
  min-height: var(--control-height);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: var(--space-2) var(--space-3);
  color: var(--color-text-primary);
  background: var(--color-surface-control);
  box-shadow: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
  appearance: none;
  transition:
    border-color var(--motion-fast) ease,
    box-shadow var(--motion-fast) ease,
    background-color var(--motion-fast) ease;
}

.ui-rich-select__trigger:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
}

.ui-rich-select__trigger[aria-expanded='true'] {
  border-color: rgba(123, 228, 158, 0.72);
  box-shadow: var(--shadow-focus);
}

.ui-rich-select__trigger:focus-visible {
  outline: 2px solid var(--color-success);
  outline-offset: 2px;
}

.ui-rich-select__trigger:disabled {
  color: var(--color-text-muted);
  background: var(--color-surface-inset);
  cursor: not-allowed;
  opacity: 0.7;
}

.ui-rich-select__visual {
  width: 1.5rem;
  height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}

.ui-rich-select__visual .product-artwork {
  width: 1.5rem;
  height: 1.5rem;
  filter: drop-shadow(0 1px 2px color-mix(in srgb, var(--color-bg-deep) 72%, transparent));
}

.ui-rich-select__visual .game-icon,
.ui-rich-select__visual .production-method-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.ui-rich-select__value,
.ui-rich-select__option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-rich-select__chevron {
  width: 0.48rem;
  height: 0.48rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: translateY(-0.12rem) rotate(45deg);
  color: var(--color-text-muted);
  transition: transform var(--motion-fast) ease;
}

.ui-rich-select__trigger[aria-expanded='true'] .ui-rich-select__chevron {
  transform: translateY(0.12rem) rotate(225deg);
}

.ui-rich-select__listbox {
  position: absolute;
  z-index: 120;
  display: grid;
  gap: 0.2rem;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  padding: 0.3rem;
  color: var(--color-text-primary);
  background: color-mix(in srgb, var(--color-bg-deep) 94%, var(--color-surface-control));
  box-shadow:
    0 18px 44px color-mix(in srgb, var(--color-bg-deep) 72%, transparent),
    inset 0 1px color-mix(in srgb, var(--color-text-primary) 7%, transparent);
}

.ui-rich-select__option {
  width: 100%;
  min-width: 0;
  min-height: 2.75rem;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
  border: 0;
  border-radius: calc(var(--radius-control) - 0.25rem);
  padding: 0.38rem 0.65rem;
  color: var(--color-text-secondary);
  background: transparent;
  box-shadow: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.ui-rich-select__option .ui-rich-select__visual {
  width: 2rem;
  height: 2rem;
}

.ui-rich-select__option .product-artwork {
  width: 2rem;
  height: 2rem;
}

.ui-rich-select__option .game-icon,
.ui-rich-select__option .production-method-icon {
  width: 1.4rem;
  height: 1.4rem;
}

.ui-rich-select__option:hover:not(:disabled),
.ui-rich-select__option[data-active='true']:not(:disabled) {
  color: var(--color-text-primary);
  background: var(--color-surface-hover);
}

.ui-rich-select__option[aria-selected='true'] {
  color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 13%, var(--color-surface-hover));
}

.ui-rich-select__option:disabled {
  color: var(--color-text-muted);
  cursor: not-allowed;
  opacity: 0.48;
}

@media (max-width: 720px) {
  .ui-rich-select__trigger,
  .ui-rich-select__option {
    min-height: 48px;
    font-size: 16px;
  }

  .ui-rich-select__option .ui-rich-select__visual,
  .ui-rich-select__option .product-artwork {
    width: 2.25rem;
    height: 2.25rem;
  }
}
'''
form_css = Path('src/styles/form-controls.css')
form_content = form_css.read_text(encoding='utf-8')
if '.ui-rich-select__trigger {' in form_content:
    raise RuntimeError('form-controls.css 已存在富内容下拉框样式')
form_css.write_text(form_content.rstrip() + form_css_addition + '\n', encoding='utf-8')

# Production method icon follows the visual slot rather than keeping a fixed 1.1rem box.
replace_one(
    'src/styles/production-methods.css',
    ".production-method-icon {\n  width: 1.1rem;\n  height: 1.1rem;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.production-method-icon .game-icon {\n  width: 1.1rem;\n  height: 1.1rem;\n}",
    ".production-method-icon {\n  width: 100%;\n  height: 100%;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.production-method-icon .game-icon {\n  width: 100%;\n  height: 100%;\n}",
)

# Browser harness must load generated product artwork mappings.
replace_one(
    'tests/browser/runtime-harness.tsx',
    "import '../../src/styles/icon-system.css';\nimport '../../src/styles/industry-system.css';",
    "import '../../src/styles/icon-system.css';\nimport '../../src/styles/product-artwork.css';\nimport '../../src/styles/industry-system.css';",
)

# Authoritative documents: visible wording, approved artwork contexts and unified rich dropdown behavior.
replace_one(
    'docs/UI_DESIGN_SYSTEM.md',
    "`src/components/ui/FormControls.tsx` 是统一表单控件的唯一 React 包装层。新页面不得为文本、整数、选择器、文本域、文件或组合输入创建平行基础组件；紧凑表格行内输入可以直接使用原生控件，但必须带 `.ui-control` 并遵守相同解析和状态规则。`SelectInput` 的 `leadingIcon` 是选择框收起状态显示语义 Icon 的唯一入口：业务组件只能传入统一 Icon 组件，不得在选择器中手写 `<svg>`、`<path>`、Emoji、字符或字体图标；原生 `<option>` 继续只显示文字，保留系统下拉、键盘操作和移动端原生选择体验。",
    "`src/components/ui/FormControls.tsx` 是文本、整数、原生纯文字选择器、文本域、文件与组合输入的唯一 React 包装层；紧凑表格行内输入可以直接使用原生控件，但必须带 `.ui-control` 并遵守相同解析和状态规则。需要在收起状态和选项中显示商品图片或语义 Icon 时，必须使用共享 `RichSelectInput`，不得由业务页面自行实现下拉弹层。`RichSelectInput` 的触发器、深色列表、选项高度、圆角、悬停、选中、禁用、键盘导航、焦点返回和工作区安全浮层定位统一由 `form-controls.css` 与组件实现；生产产物使用 `ProductArtwork`，作业制度使用统一功能 Icon，不得手写 `<svg>`、`<path>`、Emoji、字符或字体图标。",
)
replace_one(
    'docs/UI_DESIGN_SYSTEM.md',
    "商品物资插画是仓库、市场和资产界面可使用的高识别度商品视觉资产，与导航、状态、周期、成本等功能型 SVG 分工明确。正式源资源统一保存在 `src/assets/product-icons/`，每种商品使用与服务器商品 ID 同名的独立 `1024 × 1024` PNG 文件。24 × 24 的紧凑语义位置仍使用 `ProductIcon`／`ProductIconLabel`；页面不得绕过统一组件随意混用插画与功能型 SVG。",
    "商品物资插画是仓库、市场、资产和生产物资界面可使用的高识别度商品视觉资产，与导航、状态、周期、成本等功能型 SVG 分工明确。正式源资源统一保存在 `src/assets/product-icons/`，每种商品使用与服务器商品 ID 同名的独立 `1024 × 1024` PNG 文件。普通 24 × 24 紧凑语义位置继续使用 `ProductIcon`／`ProductIconLabel`；生产结算物资行以及 `RichSelectInput` 的生产产物触发器与选项是明确例外，必须通过 `ProductArtwork` 使用 128px 运行时 PNG，不得渲染商品 SVG，也不得由页面直接拼接图片路径。",
)
replace_one(
    'docs/UI_DESIGN_SYSTEM.md',
    "- 生产配方与作业制度使用同一个“生产设置”区和统一 `SelectInput`；容器宽度大于 `479px` 时双列，不大于 `479px` 时单列。生产配方收起状态使用当前基础配方产出商品的 `ProductIcon` 加名称，作业制度收起状态使用对应的统一作业 Icon 加名称；原生选项列表只保留文字。作业制度摘要不得重复显示下拉框已经选中的制度名称。",
    "- 玩家可见的“生产产物”与“作业制度”使用同一个“生产设置”区和统一 `RichSelectInput`；容器宽度大于 `479px` 时双列，不大于 `479px` 时单列。生产产物的收起状态和每个选项均使用对应产出商品的 `ProductArtwork` PNG 加路线名称，作业制度的收起状态和选项使用对应统一功能 Icon 加名称；两者必须共用同一深色弹层、选项几何、键盘交互和工作区安全浮层定位。作业制度摘要不得重复显示下拉框已经选中的制度名称。",
)
replace_one(
    'docs/UI_DESIGN_SYSTEM.md',
    "- 输入和输出项目统一使用“商品 Icon、生产数量、仓库 Icon、当前可用库存”的单行结构，多项目之间使用独立 `+` 元素；输入与输出均显示当前可用库存，输出库存不得改成预计入库后的预测值。业务组件只能调用 `ProductIcon`、`WarehouseIcon` 等统一 Icon 组件，不得在生产详情中手写 SVG 标记。",
    "- 输入和输出项目统一使用“商品图片、生产数量、仓库 Icon、当前可用库存”的单行结构，多项目之间使用独立 `+` 元素；输入与输出均显示当前可用库存，输出库存不得改成预计入库后的预测值。商品位置只能调用 `ProductArtwork` 加载 128px PNG，不得渲染 `ProductIcon` SVG；仓库等功能语义继续使用统一功能 Icon，不得在生产详情中手写 SVG 标记。",
)
replace_one(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    "- 详情显示工厂名称和总数量、运行开关、完整状态、“运行中／下一周期加入／冻结中／抵押中”四列摘要、紧凑满员率状态、生产设置、生产结算和市场入口。生产设置包含生产配方与作业制度；生产结算包含集群生产公式、生产进度和单厂平均利润／分钟。满员率不得替换或扩成第五项数量摘要。",
    "- 详情显示工厂名称和总数量、运行开关、完整状态、“运行中／下一周期加入／冻结中／抵押中”四列摘要、紧凑满员率状态、生产设置、生产结算和市场入口。玩家可见生产设置包含“生产产物”与“作业制度”，底层仍提交服务器正式配方 ID；生产结算包含集群生产公式、生产进度和单厂平均利润／分钟。满员率不得替换或扩成第五项数量摘要。",
)
replace_one(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    "- 生产配方与作业制度必须合并为同一个“生产设置”区；详情容器宽度大于 `479px` 时两个统一下拉框并排，不大于 `479px` 时单列排列。生产配方选择器收起状态显示当前基础配方产出商品 Icon 与配方名称，作业制度选择器收起状态显示制度 Icon 与制度名称；选项列表继续使用原生纯文字选项。作业制度摘要只显示周期、产出、成本和说明，不得在下拉框下重复当前制度名称。",
    "- 玩家可见“生产产物”与“作业制度”必须合并为同一个“生产设置”区；详情容器宽度大于 `479px` 时两个统一富内容下拉框并排，不大于 `479px` 时单列排列。生产产物的触发器和选项均显示产出商品 PNG 与路线名称，作业制度的触发器和选项均显示制度 Icon 与名称；两者共用共享 `RichSelectInput`，不得恢复浏览器浅色原生选项弹层。作业制度摘要只显示周期、产出、成本和说明，不得在下拉框下重复当前制度名称。",
)
replace_one(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    "- 输入位于进度条上方左侧，输出位于右侧；无输入统一显示“无”。每个输入与输出物资行固定依次显示商品 Icon、生产数量、仓库 Icon和当前可用库存；输出侧仓库数量只表示结算前当前库存，不得提前计入本周期产出。",
    "- 输入位于进度条上方左侧，输出位于右侧；无输入统一显示“无”。每个输入与输出物资行固定依次显示商品 PNG、生产数量、仓库 Icon 和当前可用库存；商品图片统一使用 128px 运行时缩略图且不得回退为商品 SVG，输出侧仓库数量只表示结算前当前库存，不得提前计入本周期产出。",
)
replace_one(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    "| 生产 | `production` | `ProductionPage` | 仓库、建设和工厂集群 |",
    "| 生产 | `production` | `ProductionPage` | 仓库、建设、工厂集群，以及玩家可见“生产产物／作业制度”配置 |",
)

# Replace the browser regression with image, custom listbox, keyboard and mobile geometry coverage.
Path('tests/browser/production-methods.spec.ts').write_text(r'''import { expect, test } from '@playwright/test';

test.describe('factory production methods', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('uses product artwork and unified rich selects while submitting stable recipe variants', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=production-methods');

    const detail = page.locator('.facility-cluster-detail-card');
    await expect(detail).toContainText('生产设置');
    await expect(detail).toContainText('生产产物');
    await expect(detail).not.toContainText('生产配方');
    await expect(detail).toContainText('作业制度');
    await expect(detail).toContainText('生产结算');
    await expect(detail).toContainText('下一周期切换为：机械制造 · 高速生产');
    await expect(detail.getByRole('radio')).toHaveCount(0);

    const recipeSelect = detail.getByRole('combobox', { name: '机械工厂生产产物' });
    const methodSelect = detail.getByRole('combobox', { name: '机械工厂生产方式' });
    await expect(recipeSelect).toHaveCount(1);
    await expect(methodSelect).toHaveCount(1);
    await expect(methodSelect).toContainText('高速生产');

    const settings = detail.locator('.facility-production-settings');
    await expect(settings.locator('.ui-rich-select')).toHaveCount(2);
    await expect(recipeSelect.locator('[data-product-artwork="machinery"]')).toHaveCount(1);
    await expect(methodSelect.locator('[data-production-method-icon="rapid"]')).toHaveCount(1);
    await expect(settings.locator('select')).toHaveCount(0);

    await recipeSelect.click();
    const recipeListbox = page.getByRole('listbox', { name: '机械工厂生产产物' });
    await expect(recipeListbox).toBeVisible();
    const recipeOption = recipeListbox.getByRole('option', { name: '机械制造' });
    await expect(recipeOption.locator('[data-product-artwork="machinery"]')).toHaveCount(1);
    const [recipeTriggerBox, recipeListboxBox] = await Promise.all([
      recipeSelect.boundingBox(),
      recipeListbox.boundingBox(),
    ]);
    expect(recipeTriggerBox).not.toBeNull();
    expect(recipeListboxBox).not.toBeNull();
    if (!recipeTriggerBox || !recipeListboxBox) throw new Error('生产产物下拉框几何不可用');
    expect(Math.abs(recipeTriggerBox.width - recipeListboxBox.width)).toBeLessThanOrEqual(1);
    const listboxBackground = await recipeListbox.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(listboxBackground).not.toBe('rgb(255, 255, 255)');
    expect(listboxBackground).not.toBe('rgba(0, 0, 0, 0)');
    await page.keyboard.press('Escape');
    await expect(recipeListbox).toHaveCount(0);
    await expect(recipeSelect).toBeFocused();

    const summary = detail.locator('.facility-production-method-summary');
    await expect(summary.locator('strong')).toHaveCount(0);
    await expect(summary).not.toContainText('高速生产');
    await expect(summary).toContainText('1m · 产出 1 · 成本 12');
    await expect(summary).toContainText('缩短周期并提高成本');

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
    const formulaTop = settlement.locator('.facility-formula-top');
    const inputSide = settlement.locator('.facility-formula-input-side');
    const formulaMeta = inputSide.locator(':scope > .facility-formula-meta');
    const output = settlement.locator('.facility-formula-output');
    const profit = settlement.locator('.facility-average-profit');
    await expect(inputSide).toHaveCount(1);
    await expect(formulaMeta).toHaveCount(1);
    await expect(output).toHaveCount(1);
    await expect(profit).toHaveCount(1);

    const formulaColumns = await formulaTop.evaluate((element) => (
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
    ));
    expect(formulaColumns).toBe(2);

    const [inputSideBox, metaBox, outputBox] = await Promise.all([
      inputSide.boundingBox(),
      formulaMeta.boundingBox(),
      output.boundingBox(),
    ]);
    expect(inputSideBox).not.toBeNull();
    expect(metaBox).not.toBeNull();
    expect(outputBox).not.toBeNull();
    if (!inputSideBox || !metaBox || !outputBox) throw new Error('生产结算几何不可用');
    expect(metaBox.x).toBeGreaterThanOrEqual(inputSideBox.x - 1);
    expect(metaBox.x + metaBox.width).toBeLessThanOrEqual(inputSideBox.x + inputSideBox.width + 1);
    expect(metaBox.x + metaBox.width).toBeLessThan(outputBox.x);

    const metaUnits = formulaMeta.locator(':scope > .facility-formula-meta-unit');
    await expect(metaUnits).toHaveCount(2);
    const [cycleBox, costBox] = await Promise.all([
      metaUnits.nth(0).boundingBox(),
      metaUnits.nth(1).boundingBox(),
    ]);
    expect(cycleBox).not.toBeNull();
    expect(costBox).not.toBeNull();
    if (!cycleBox || !costBox) throw new Error('周期成本两行几何不可用');
    expect(costBox.y).toBeGreaterThan(cycleBox.y + cycleBox.height - 1);

    const materialRows = settlement.locator('.facility-formula-item-group');
    await expect(materialRows).toHaveCount(2);
    await expect(settlement.locator('.facility-formula-inventory')).toHaveCount(2);
    await expect(settlement.locator('.facility-formula-input .facility-formula-inventory')).toHaveCount(1);
    await expect(settlement.locator('.facility-formula-output .facility-formula-inventory')).toHaveCount(1);
    await expect(settlement.locator('.product-artwork')).toHaveCount(2);
    await expect(settlement.locator('svg.product-icon')).toHaveCount(0);
    const artworkBackgrounds = await settlement.locator('.product-artwork').evaluateAll((elements) => (
      elements.map((element) => getComputedStyle(element).backgroundImage)
    ));
    expect(artworkBackgrounds.every((background) => background.includes('.png'))).toBe(true);

    const slotStyle = await settlement.locator('.facility-formula-item-group').first().evaluate((element) => {
      const style = getComputedStyle(element);
      const row = element.firstElementChild;
      const children = row ? Array.from(row.children) : [];
      const boxes = children.map((child) => child.getBoundingClientRect().x);
      return {
        backgroundImage: style.backgroundImage,
        borderLeftWidth: style.borderLeftWidth,
        borderRadius: style.borderRadius,
        childCount: children.length,
        ordered: boxes.every((item, index) => index === 0 || item >= boxes[index - 1]),
      };
    });
    expect(slotStyle.backgroundImage).not.toBe('none');
    expect(slotStyle.borderLeftWidth).not.toBe('0px');
    expect(slotStyle.borderRadius).not.toBe('0px');
    expect(slotStyle.childCount).toBe(3);
    expect(slotStyle.ordered).toBe(true);

    const flowStyle = await settlement.locator('.facility-formula-progress .progress-track span').evaluate((element) => {
      const style = getComputedStyle(element.parentElement!);
      const arrow = getComputedStyle(element, '::after');
      return {
        trackHeight: Number.parseFloat(style.height),
        arrowContent: arrow.content,
        arrowClipPath: arrow.clipPath,
      };
    });
    expect(flowStyle.trackHeight).toBeGreaterThanOrEqual(8);
    expect(flowStyle.arrowContent).not.toBe('none');
    expect(flowStyle.arrowClipPath).not.toBe('none');

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

    await methodSelect.click();
    const methodListbox = page.getByRole('listbox', { name: '机械工厂生产方式' });
    await expect(methodListbox).toBeVisible();
    await methodListbox.getByRole('option', { name: '节约生产' }).click();
    await expect.poll(async () => page.evaluate(() => (
      window as typeof window & { __productionRecipeRequests?: string[] }
    ).__productionRecipeRequests ?? [])).toEqual([
      'machine-factory:machinery-recipe--economical',
    ]);
  });

  test('keeps the rich production dropdown inside the mobile floating layer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=production&scenario=production-methods');

    await page.locator('.facility-cluster-selector-card').first().click();
    const sheet = page.locator('.facility-detail-sheet');
    await expect(sheet).toBeVisible();
    const recipeSelect = sheet.getByRole('combobox', { name: '机械工厂生产产物' });
    await recipeSelect.click();
    const listbox = page.getByRole('listbox', { name: '机械工厂生产产物' });
    await expect(listbox).toBeVisible();
    const box = await listbox.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error('移动生产产物下拉框几何不可用');
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    await expect(listbox.locator('[data-product-artwork="machinery"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(listbox).toHaveCount(0);
    await expect(recipeSelect).toBeFocused();
  });
});
''', encoding='utf-8')

# Rewrite the focused production settlement verifier to lock the new component and image boundaries.
Path('scripts/verify-production-settlement-layout.mjs').write_text(r'''import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const formula = read('src/components/facilities/FacilityProductionFormula.tsx');
const detail = read('src/pages/production/ProductionFacilityDetail.tsx');
const richSelect = read('src/components/ui/RichSelectInput.tsx');
const productArtwork = read('src/components/products/ProductArtwork.tsx');
const formulaCss = read('src/styles/facility-production-formula.css');
const controlsCss = read('src/styles/form-controls.css');
const artworkCss = read('src/styles/product-artwork.css');
const profitCss = read('src/styles/facility-recipe-profit-analysis.css');
const browserTest = read('tests/browser/production-methods.spec.ts');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
const industryDesign = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
const main = read('src/main.tsx');

for (const text of [
  'data-status={group.status}',
  'className="facility-formula-input-side"',
  'className="facility-formula-input"',
  'className="facility-formula-meta"',
  'facility-formula-meta-unit is-cycle',
  'facility-formula-meta-unit is-cost',
  'className="facility-formula-output"',
  'className="facility-formula-inventory"',
  '<ProductArtwork productId={item.productId} className="facility-formula-product-artwork" />',
  '<WarehouseIcon className="facility-formula-meta-icon" />',
  '<FacilityGroupProgress group={group} type={type} now={now} />',
]) assert.equal(formula.includes(text), true, `生产结算结构缺少: ${text}`);

assert.equal((formula.match(/<RecipeItems/g) ?? []).length, 2, '生产结算必须保留输入和输出调用');
for (const forbidden of [
  '<ProductIcon',
  'showInventory',
  'facility-formula-meta-divider',
  '<strong>{formatNumber(quantity)} ×</strong>',
  'facility-formula-center',
]) assert.equal(formula.includes(forbidden), false, `生产结算不得包含: ${forbidden}`);

const itemStart = formula.indexOf('className={itemClassName}');
const artworkStart = formula.indexOf('<ProductArtwork', itemStart);
const quantityStart = formula.indexOf('<strong>{formatNumber(quantity)}</strong>', itemStart);
const inventoryStart = formula.indexOf('className="facility-formula-inventory"', itemStart);
assert.ok(itemStart >= 0 && artworkStart > itemStart, '商品图片必须位于物资行内');
assert.ok(quantityStart > artworkStart && inventoryStart > quantityStart, '物资行必须依次为商品图片、生产数量、仓库数量');

for (const text of [
  'data-product-artwork={productId}',
  "classNames('product-icon', 'product-artwork', className)",
]) assert.equal(productArtwork.includes(text), true, `商品图片组件缺少: ${text}`);
for (const forbidden of ['<svg', '<path']) {
  assert.equal(productArtwork.includes(forbidden), false, `商品图片组件不得渲染: ${forbidden}`);
}
for (const text of [
  '.product-artwork {',
  'background-image: var(--product-artwork-image, none);',
  'background-size: contain;',
]) assert.equal(artworkCss.includes(text), true, `商品图片样式缺少: ${text}`);

const inputSideStart = formula.indexOf('className="facility-formula-input-side"');
const inputStart = formula.indexOf('className="facility-formula-input"', inputSideStart);
const metaStart = formula.indexOf('className="facility-formula-meta"', inputSideStart);
const outputStart = formula.indexOf('className="facility-formula-output"', inputSideStart);
assert.ok(inputSideStart >= 0 && inputStart > inputSideStart, '输入物资必须位于输入侧组合区内');
assert.ok(metaStart > inputStart && outputStart > metaStart, '两行周期成本仪表必须位于输入物资之后、输出之前');

for (const text of [
  '.facility-formula-input-side',
  '.facility-formula-meta',
  '.facility-formula-item-group',
  '.facility-formula-product-artwork',
  'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);',
  'grid-template-columns: auto auto auto;',
  'grid-template-columns: minmax(0, 1fr);',
  'border-left: 1px solid var(--color-divider);',
  'grid-template-areas: none;',
  '.facility-formula-progress .progress-track span::after',
  'clip-path: polygon(0 0, 100% 50%, 0 100%);',
  '@container (max-width: 420px)',
  '@media (prefers-reduced-motion: reduce)',
]) assert.equal(formulaCss.includes(text), true, `生产结算样式缺少: ${text}`);

for (const forbidden of [
  '.facility-formula-center',
  '.facility-formula-meta-divider',
  'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);',
  'border-top: 1px solid var(--color-divider);',
]) assert.equal(formulaCss.includes(forbidden), false, `生产结算样式不得包含: ${forbidden}`);

for (const text of [
  'export function RichSelectInput',
  'role="combobox"',
  'role="listbox"',
  'role="option"',
  'createPortal(',
  'useWorkspaceFloatingLayer()',
  "event.key === 'ArrowDown'",
  "case 'Escape':",
  'data-facility-sheet-no-drag="true"',
]) assert.equal(richSelect.includes(text), true, `统一富内容下拉框缺少: ${text}`);
for (const text of [
  '.ui-rich-select__trigger',
  '.ui-rich-select__listbox',
  '.ui-rich-select__option',
  "[aria-selected='true']",
  'min-height: 48px;',
]) assert.equal(controlsCss.includes(text), true, `统一富内容下拉框样式缺少: ${text}`);
for (const text of [
  'label="生产产物"',
  'aria-label={`${type.name}生产产物`}',
  'visual: <ProductArtwork productId={recipe.output.productId} />',
  'visual: <ProductionMethodIcon methodId={method.id} />',
  'data-production-method-icon={methodId}',
]) assert.equal(detail.includes(text), true, `生产设置富内容选项缺少: ${text}`);
for (const forbidden of ['<SelectInput', '<option']) {
  const settingsStart = detail.indexOf('<section className="facility-production-settings">');
  const settingsEnd = detail.indexOf('<FacilityProductionFormula', settingsStart);
  assert.equal(detail.slice(settingsStart, settingsEnd).includes(forbidden), false, `生产设置不得恢复: ${forbidden}`);
}

const groupCssImport = main.indexOf("import './styles/facility-group-card-grid.css';");
const formulaCssImport = main.indexOf("import './styles/facility-production-formula.css';");
assert.ok(groupCssImport >= 0 && formulaCssImport > groupCssImport, '生产结算样式必须在工厂详情基础样式之后加载');

const profitRule = profitCss.slice(
  profitCss.indexOf('.facility-average-profit {'),
  profitCss.indexOf('.facility-average-profit__copy {'),
);
assert.equal(profitRule.includes('border-top:'), true, '利润结果栏必须保留顶部分隔线');
for (const forbidden of ['border-radius:', 'background:']) {
  assert.equal(profitRule.includes(forbidden), false, `利润结果栏不得恢复独立卡片视觉: ${forbidden}`);
}

for (const text of [
  "getByRole('combobox', { name: '机械工厂生产产物' })",
  "getByRole('listbox', { name: '机械工厂生产产物' })",
  "getByRole('option', { name: '节约生产' })",
  "settlement.locator('svg.product-icon')",
  "settlement.locator('.product-artwork')",
  'expect(box.x + box.width).toBeLessThanOrEqual(390)',
  'expect(costBox.y).toBeGreaterThan(cycleBox.y + cycleBox.height - 1)',
  'arrowClipPath',
]) assert.equal(browserTest.includes(text), true, `生产结算浏览器回归缺少: ${text}`);

for (const text of [
  '工厂生产公式固定采用双列顶层布局',
  '商品图片、生产数量、仓库 Icon、当前可用库存',
  '`ProductArtwork`',
  '`RichSelectInput`',
  '不得恢复浏览器浅色原生选项弹层',
  '输入与输出均显示当前可用库存',
]) assert.equal(uiDesign.includes(text) || industryDesign.includes(text), true, `权威设计缺少: ${text}`);

console.log('生产结算商品 PNG、输入输出仓库库存、两行周期成本、统一富内容下拉框、流向进度、响应式与利润结果栏验证通过。');
''', encoding='utf-8')

# Focused production-method verifier follows RichSelectInput instead of native select change events.
production_methods = Path('scripts/verify-production-methods.mjs')
pm_content = production_methods.read_text(encoding='utf-8')
for old, new in [
    ("  'event.target.value as FacilityProductionMethodId',", "  'methodId as FacilityProductionMethodId',\n  'RichSelectInput',\n  'onValueChange={(methodId)',"),
    ("  \"getByRole('combobox', { name: '机械工厂生产方式' })\",\n  \"selectOption('economical')\",", "  \"getByRole('combobox', { name: '机械工厂生产方式' })\",\n  \"getByRole('option', { name: '节约生产' })\",\n  \"methodListbox.getByRole('option', { name: '节约生产' }).click()\","),
]:
    if pm_content.count(old) != 1:
        raise RuntimeError(f'verify-production-methods 目标不唯一: {old}')
    pm_content = pm_content.replace(old, new)
production_methods.write_text(pm_content, encoding='utf-8')

# Product artwork verifier approves the non-SVG component in production formula and rich options.
product_verifier = Path('scripts/verify-product-artwork.mjs')
pv_content = product_verifier.read_text(encoding='utf-8')
pv_content = pv_content.replace(
    "const productIconsPath = 'src/components/icons/ProductIcons.tsx';\nconst formulaPath = 'src/components/facilities/FacilityProductionFormula.tsx';",
    "const productIconsPath = 'src/components/icons/ProductIcons.tsx';\nconst productArtworkPath = 'src/components/products/ProductArtwork.tsx';\nconst richSelectPath = 'src/components/ui/RichSelectInput.tsx';\nconst formulaPath = 'src/components/facilities/FacilityProductionFormula.tsx';",
)
pv_content = pv_content.replace(
    "  productIconsPath,\n  formulaPath,",
    "  productIconsPath,\n  productArtworkPath,\n  richSelectPath,\n  formulaPath,",
)
pv_content = pv_content.replace(
    "    '.asset-auction-history-icon',\n    'background-image: var(--product-artwork-image, none);',",
    "    '.asset-auction-history-icon',\n    '.product-artwork {',\n    'background-image: var(--product-artwork-image, none);',",
)
replace_old = """  const formula = read(formulaPath);\n  if (!formula.includes('ProductIcon')) {\n    failures.push('生产公式必须继续使用紧凑 ProductIcon SVG');\n  }"""
replace_new = """  const formula = read(formulaPath);\n  const productArtwork = read(productArtworkPath);\n  const richSelect = read(richSelectPath);\n  if (!formula.includes('ProductArtwork') || formula.includes('<ProductIcon')) {\n    failures.push('生产公式必须使用 ProductArtwork PNG 且不得渲染商品 SVG');\n  }\n  for (const required of [\n    'data-product-artwork={productId}',\n    \"classNames('product-icon', 'product-artwork', className)\",\n  ]) if (!productArtwork.includes(required)) failures.push(`${productArtworkPath} 缺少: ${required}`);\n  for (const forbidden of ['<svg', '<path']) {\n    if (productArtwork.includes(forbidden)) failures.push(`${productArtworkPath} 不得包含: ${forbidden}`);\n  }\n  for (const required of ['role=\"listbox\"', 'role=\"option\"', 'createPortal(']) {\n    if (!richSelect.includes(required)) failures.push(`${richSelectPath} 缺少: ${required}`);\n  }"""
if pv_content.count(replace_old) != 1:
    raise RuntimeError('verify-product-artwork 生产公式目标不唯一')
pv_content = pv_content.replace(replace_old, replace_new)
pv_content = pv_content.replace(
    '紧凑语义位置继续使用 SVG。`,',
    '生产结算与富内容下拉框使用 ProductArtwork PNG，其余紧凑语义位置继续使用 SVG。`,',
)
product_verifier.write_text(pv_content, encoding='utf-8')

# Shared form verification includes the portal listbox contract.
form_verifier = Path('scripts/verify-form-controls.mjs')
fv_content = form_verifier.read_text(encoding='utf-8')
fv_content = fv_content.replace(
    "const componentPath = 'src/components/ui/FormControls.tsx';",
    "const componentPath = 'src/components/ui/FormControls.tsx';\nconst richSelectPath = 'src/components/ui/RichSelectInput.tsx';",
)
fv_content = fv_content.replace(
    "  componentPath,\n  draftPath,",
    "  componentPath,\n  richSelectPath,\n  draftPath,",
)
fv_content = fv_content.replace(
    "for (const text of [\n  'export function parseIntegerDraft',",
    "for (const text of [\n  'export function RichSelectInput',\n  'role=\"combobox\"',\n  'role=\"listbox\"',\n  'role=\"option\"',\n  'createPortal(',\n  'useWorkspaceFloatingLayer()',\n  'data-facility-sheet-no-drag=\"true\"',\n]) requireText(richSelectPath, text);\n\nfor (const text of [\n  'export function parseIntegerDraft',",
)
fv_content = fv_content.replace(
    "  '.ui-input-group',\n]) requireText(stylePath, text);",
    "  '.ui-input-group',\n  '.ui-rich-select__trigger',\n  '.ui-rich-select__listbox',\n  '.ui-rich-select__option',\n]) requireText(stylePath, text);",
)
form_verifier.write_text(fv_content, encoding='utf-8')

# Existing page/factory verifiers follow the renamed visible field.
for path in ['scripts/verify-facility-groups.mjs', 'scripts/verify-page-content.mjs']:
    target = Path(path)
    content = target.read_text(encoding='utf-8')
    content = content.replace("'生产配方',", "'生产产物',")
    content = content.replace("'<strong>生产配方</strong>',", "'<strong>生产产物</strong>',")
    target.write_text(content, encoding='utf-8')

print('production product artwork and unified rich selects applied')
