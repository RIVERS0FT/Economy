import { readFileSync, writeFileSync, rmSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content, 'utf8');
}

function replaceExact(path, before, after) {
  const source = read(path);
  if (!source.includes(before)) throw new Error(`${path} missing expected source block`);
  write(path, source.replace(before, after));
}

const detailPath = 'src/pages/production/ProductionFacilityDetail.tsx';
let detail = read(detailPath);
replaceExact(
  detailPath,
  `  const selectedMethod = recipeState.productionMethodGroup?.methods.find(\n    (method) => method.id === recipeState.selectedProductionMethodId,\n  );\n`,
  `  const selectedMethod = recipeState.productionMethodGroup?.methods.find(\n    (method) => method.id === recipeState.selectedProductionMethodId,\n  );\n  const selectedPlan = selectedMethod?.plansByRecipeId[recipeState.selectedBaseRecipeId];\n`,
);
detail = read(detailPath);
const methodStart = detail.indexOf('      {recipeState.productionMethodGroup ? (');
const formulaStart = detail.indexOf('\n      <FacilityProductionFormula', methodStart);
if (methodStart < 0 || formulaStart < 0) throw new Error('production method JSX block not found');
const methodBlock = `      {recipeState.productionMethodGroup ? (\n        <section className="facility-production-method-section">\n          <SelectInput\n            label={recipeState.productionMethodGroup.name}\n            aria-label={\`${type.name}生产方式\`}\n            value={recipeState.selectedProductionMethodId}\n            disabled={group.count < 1}\n            onChange={(event) => {\n              selectConfiguration(\n                recipeState.selectedBaseRecipeId,\n                event.target.value as FacilityProductionMethodId,\n              );\n            }}\n          >\n            {recipeState.productionMethodGroup.methods.map((method) => {\n              const plan = method.plansByRecipeId[recipeState.selectedBaseRecipeId];\n              return (\n                <option value={method.id} key={method.id} disabled={!plan}>\n                  {method.name}\n                </option>\n              );\n            })}\n          </SelectInput>\n          {selectedMethod && selectedPlan ? (\n            <div className="facility-production-method-summary" aria-live="polite">\n              <strong>{selectedMethod.name}</strong>\n              <span>\n                {formatDuration(selectedPlan.cycleMs)} · 产出 {formatNumber(selectedPlan.output.quantity)} · 成本 {formatNumber(selectedPlan.operatingCost)}\n              </span>\n              <small>{selectedMethod.description}</small>\n            </div>\n          ) : null}\n        </section>\n      ) : null}\n`;
write(detailPath, detail.slice(0, methodStart) + methodBlock + detail.slice(formulaStart));

write('src/styles/production-methods.css', `.facility-production-method-section {\n  min-width: 0;\n  display: grid;\n  gap: var(--space-1);\n}\n\n.facility-production-method-summary {\n  min-width: 0;\n  display: grid;\n  gap: 0.2rem;\n  padding-inline: var(--space-1);\n}\n\n.facility-production-method-summary strong {\n  color: var(--color-text-primary);\n  font-size: var(--font-size-sm);\n  line-height: var(--line-height-tight);\n}\n\n.facility-production-method-summary span {\n  color: var(--color-text-secondary);\n  font-size: var(--font-size-xs);\n  line-height: var(--line-height-normal);\n  font-variant-numeric: tabular-nums;\n}\n\n.facility-production-method-summary small {\n  color: var(--color-text-muted);\n  font-size: var(--font-size-xs);\n  line-height: var(--line-height-normal);\n}\n`);

replaceExact(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  `- 生产页工厂详情把基础配方与作业制度放在同一个“生产配置”区。基础配方使用统一选择控件，作业制度使用四张互斥选择卡。\n- 选择卡必须显示方式名称以及该基础配方对应的周期、单周期产出和周期成本；页面效果预览、真实价格利润和生产公式必须读取服务器返回的变体数值。\n- 运行中改变任一配置时显示“下一周期切换”为目标基础配方与生产方式，当前周期内容保持不变；一次操作必须提交完整目标变体，不得先后发送两个会形成中间状态的请求。\n- 桌面详情和移动底部详情必须共用同一生产配置组件、相同选择状态与相同下一周期语义。`,
  `- 生产页工厂详情把基础配方与作业制度放在同一个“生产配置”区。基础配方与作业制度都使用统一下拉选择控件，不得把作业制度恢复为选择卡、按钮组或独立弹窗。\n- 作业制度下拉选项显示方式名称；控件下方必须显示当前所选方式的说明，以及该基础配方对应的周期、单周期产出和周期成本。页面效果预览、真实价格利润和生产公式必须读取服务器返回的变体数值。\n- 运行中改变任一配置时显示“下一周期切换”为目标基础配方与生产方式，当前周期内容保持不变；一次操作必须提交完整目标变体，不得先后发送两个会形成中间状态的请求。\n- 桌面详情和移动底部详情必须共用同一生产配置组件、相同下拉选中状态与相同下一周期语义。`,
);

replaceExact(
  'docs/UI_DESIGN_SYSTEM.md',
  `## 生产方式选择卡\n\n- 生产方式选择卡使用语义化 \`radiogroup\` 与 \`radio\`，四种方式互斥；选中态必须同时具有边框、背景和 \`aria-checked\`，不得仅依赖颜色表达。\n- 桌面和宽详情默认两列，窄屏改为单列；卡片文本必须允许在中文界面下保持可读，数值使用等宽数字，并关闭浏览器原生蓝色 tap highlight。\n- 鼠标、触摸与键盘均可选择方式；必须保留 \`:focus-visible\` 焦点，减少动态偏好下关闭过渡动画。\n- 卡片颜色只表达标准、速度、节约和高产的提示语气，不代表收益保证；真实利润仍以生产公式和最近真实成交价为准。`,
  `## 生产方式下拉选择\n\n- 作业制度必须使用共享 \`SelectInput\` 渲染为原生 \`select\`，由浏览器暴露可访问的 \`combobox\` 语义；标准、高速、节约和高产四个选项互斥，不得恢复 \`radiogroup\`、选择卡或按钮组。\n- 下拉选项只显示方式名称；控件下方使用紧凑说明区显示当前方式名称、周期、单周期产出、周期成本和方式说明，数值使用等宽数字。\n- 桌面详情与移动 Bottom Sheet 共用同一个下拉控件和说明区；鼠标、触摸与键盘均可操作，并保留共享表单控件的 \`:focus-visible\` 焦点与移动 tap highlight 规则。\n- 方式说明不使用颜色承诺收益；真实利润仍以生产公式和最近真实成交价为准。`,
);

replaceExact(
  'scripts/verify-production-methods.mjs',
  `for (const text of [\n  'productionRecipeVariantId',\n  'const methodGroup = productionMethodGroupForType(type);',\n  'id: plan.recipeId',\n  'role="radiogroup"',\n  'role="radio"',\n  'facility-production-method-option',\n]) assert.ok(detailSource.includes(text), \`生产方式客户端合成缺少 \${text}\`);\nassert.ok(pageSource.includes("import '../styles/production-methods.css'"));\nassert.ok(styleSource.includes('.facility-production-method-grid'));\nassert.ok(styleSource.includes("[data-selected='true']"));`,
  `for (const text of [\n  'productionRecipeVariantId',\n  'const methodGroup = productionMethodGroupForType(type);',\n  'id: plan.recipeId',\n  'const selectedPlan = selectedMethod?.plansByRecipeId[recipeState.selectedBaseRecipeId];',\n  'aria-label={\`${type.name}生产方式\`}',\n  'value={recipeState.selectedProductionMethodId}',\n  'event.target.value as FacilityProductionMethodId',\n  'facility-production-method-summary',\n]) assert.ok(detailSource.includes(text), \`生产方式客户端合成缺少 \${text}\`);\nfor (const forbidden of ['role="radiogroup"', 'role="radio"', 'facility-production-method-option']) {\n  assert.equal(detailSource.includes(forbidden), false, \`生产方式不得恢复选择卡: \${forbidden}\`);\n}\nassert.ok(pageSource.includes("import '../styles/production-methods.css'"));\nassert.ok(styleSource.includes('.facility-production-method-summary'));\nfor (const forbidden of ['.facility-production-method-grid', '.facility-production-method-option', "[data-selected='true']"]) {\n  assert.equal(styleSource.includes(forbidden), false, \`生产方式样式不得恢复选择卡: \${forbidden}\`);\n}`,
);

replaceExact(
  'scripts/verify-production-methods.mjs',
  `for (const text of [\n  '下一周期切换为：机械制造 · 高速生产',\n  "'machine-factory:machinery-recipe--economical'",\n  "getByRole('radio', { name: /节约生产/ })",\n]) assert.ok(browserSpecSource.includes(text), \`生产方式浏览器回归缺少 \${text}\`);`,
  `for (const text of [\n  '下一周期切换为：机械制造 · 高速生产',\n  "'machine-factory:machinery-recipe--economical'",\n  "getByRole('combobox', { name: '机械工厂生产方式' })",\n  "selectOption('economical')",\n]) assert.ok(browserSpecSource.includes(text), \`生产方式浏览器回归缺少 \${text}\`);`,
);

replaceExact(
  'scripts/verify-production-methods.mjs',
  `  ['docs/UI_DESIGN_SYSTEM.md', ['生产方式选择卡', 'radiogroup']],`,
  `  ['docs/UI_DESIGN_SYSTEM.md', ['生产方式下拉选择', 'combobox']],`,
);

replaceExact(
  'scripts/verify-production-methods.mjs',
  `console.log('生产方式验证通过：四种作业制度、整数平衡、稳定变体 ID、周期边界切换、需求图去重、标准路线公开兼容、可选客户端元数据、响应式选择卡、浏览器交互和版本兼容均已锁定。');`,
  `console.log('生产方式验证通过：四种作业制度、整数平衡、稳定变体 ID、周期边界切换、需求图去重、标准路线公开兼容、可选客户端元数据、统一下拉选择、浏览器交互和版本兼容均已锁定。');`,
);

write('tests/browser/production-methods.spec.ts', `import { expect, test } from '@playwright/test';\n\ntest.describe('factory production methods', () => {\n  test.use({ viewport: { width: 1440, height: 900 } });\n\n  test('previews the pending method and submits the selected stable recipe variant', async ({ page }) => {\n    await page.goto('runtime-test.html?view=production&scenario=production-methods');\n\n    const detail = page.locator('.facility-cluster-detail-card');\n    await expect(detail).toContainText('作业制度');\n    await expect(detail).toContainText('下一周期切换为：机械制造 · 高速生产');\n\n    const methodSelect = detail.getByRole('combobox', { name: '机械工厂生产方式' });\n    await expect(methodSelect).toHaveValue('rapid');\n    await expect(detail.locator('.facility-production-method-summary')).toContainText('高速生产');\n    await expect(detail.locator('.facility-production-method-summary')).toContainText('缩短周期并提高成本');\n\n    await methodSelect.selectOption('economical');\n    await expect.poll(async () => page.evaluate(() => (\n      window as typeof window & { __productionRecipeRequests?: string[] }\n    ).__productionRecipeRequests ?? [])).toEqual([\n      'machine-factory:machinery-recipe--economical',\n    ]);\n  });\n});\n`);

rmSync('scripts/agent-production-method-dropdown.mjs');
rmSync('.github/workflows/agent-production-method-dropdown.yml');
