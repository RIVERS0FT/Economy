import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content.replace(/\r\n/g, '\n'));
}

function replaceOnce(path, before, after) {
  const source = read(path);
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${path} 缺少待替换内容`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${path} 待替换内容出现多次`);
  }
  write(path, source.slice(0, first) + after + source.slice(first + before.length));
}

function insertAfterMatchingLine(path, needle, line) {
  const source = read(path);
  if (source.includes(line)) return;
  const lines = source.split('\n');
  const index = lines.findIndex((candidate) => candidate.includes(needle));
  if (index < 0) throw new Error(`${path} 缺少插入锚点: ${needle}`);
  lines.splice(index + 1, 0, line);
  write(path, lines.join('\n'));
}

const stylePath = 'src/styles/market-page-polish.css';
const oldStepperStyles = `.market-page-surface .market-stepper__button {
  position: absolute;
  z-index: 2;
  top: 50%;
  width: 36px;
  min-width: 36px;
  height: 36px;
  border: 0;
  padding: 0;
  background: transparent;
  box-shadow: none;
  font-size: 1.15rem;
  line-height: 1;
  transform: translateY(-50%);
}

.market-page-surface .market-stepper__button:first-child {
  left: calc(var(--market-stepper-label-width) + var(--space-2));
  border-right: 1px solid var(--color-divider);
  border-radius: var(--radius-control) 0 0 var(--radius-control);
}

.market-page-surface .market-stepper__button:last-child {
  right: 0;
  border-left: 1px solid var(--color-divider);
  border-radius: 0 var(--radius-control) var(--radius-control) 0;
}

@media (hover: hover) and (pointer: fine) {
  html[data-input-modality='mouse']
    .market-page-surface .market-stepper__button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.045);
    transform: translateY(-50%);
  }
}

.market-page-surface .market-stepper__button:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.045);
  transform: translateY(-50%);
}`;
const newStepperStyles = `.market-page-surface .market-stepper__button {
  position: absolute;
  z-index: 2;
  top: 0;
  bottom: 0;
  width: 36px;
  min-width: 36px;
  height: 36px;
  margin-block: auto;
  border: 0;
  padding: 0;
  background: transparent;
  box-shadow: none;
  font-size: 1.15rem;
  line-height: 1;
  transform: none;
}

.market-page-surface .market-stepper__button:first-child {
  left: calc(var(--market-stepper-label-width) + var(--space-2));
  border-right: 1px solid var(--color-divider);
  border-radius: var(--radius-control) 0 0 var(--radius-control);
}

.market-page-surface .market-stepper__button:last-child {
  right: 0;
  border-left: 1px solid var(--color-divider);
  border-radius: 0 var(--radius-control) var(--radius-control) 0;
}

@media (hover: hover) and (pointer: fine) {
  html[data-input-modality='mouse']
    .market-page-surface .market-stepper__button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.045);
    transform: none;
  }
}

.market-page-surface .market-stepper__button:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.045);
  transform: none;
}

.market-page-surface .market-stepper__button:disabled {
  transform: none;
}`;
replaceOnce(stylePath, oldStepperStyles, newStepperStyles);

insertAfterMatchingLine(
  'docs/UI_DESIGN_SYSTEM.md',
  '金额输入默认不响应滚轮',
  '- 嵌入输入框的绝对定位操作按钮不得依赖 `transform` 完成基础居中；普通、悬停、按下、键盘焦点和禁用状态必须共享同一几何位置，状态变化不得造成按钮跳动。',
);

const browserPath = 'tests/browser/market-order-entry-compact.spec.ts';
const browserAnchor = `test('focused market price input owns the wheel in 0.01 steps', async ({ page }) => {`;
const stableGeometryTest = `test('embedded market steppers keep stable geometry through press and disabled states', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');

  const quantityInput = page.getByRole('spinbutton', { name: '数量' });
  const quantityDecrease = page.getByRole('button', { name: '数量减少 1' });
  const quantityIncrease = page.getByRole('button', { name: '数量增加 1' });
  const priceIncrease = page.getByRole('button', { name: '价格增加 0.01' });

  await priceIncrease.hover();
  const pressBefore = await requireBox(priceIncrease);
  await page.mouse.down();
  const pressDuring = await requireBox(priceIncrease);
  expect(Math.abs(pressDuring.x - pressBefore.x)).toBeLessThan(0.5);
  expect(Math.abs(pressDuring.y - pressBefore.y)).toBeLessThan(0.5);
  await page.mouse.up();

  const maxQuantity = Number(await quantityInput.getAttribute('max'));
  expect(Number.isSafeInteger(maxQuantity)).toBe(true);
  expect(maxQuantity).toBeGreaterThan(1);

  await quantityInput.fill(String(maxQuantity - 1));
  await quantityInput.blur();
  await expect(quantityInput).toHaveValue(String(maxQuantity - 1));
  await expect(quantityIncrease).toBeEnabled();
  const increaseBefore = await requireBox(quantityIncrease);
  await quantityIncrease.click();
  await expect(quantityInput).toHaveValue(String(maxQuantity));
  await expect(quantityIncrease).toBeDisabled();
  const increaseAfter = await requireBox(quantityIncrease);
  expect(Math.abs(increaseAfter.x - increaseBefore.x)).toBeLessThan(0.5);
  expect(Math.abs(increaseAfter.y - increaseBefore.y)).toBeLessThan(0.5);
  expect(Math.abs(increaseAfter.width - increaseBefore.width)).toBeLessThan(0.5);
  expect(Math.abs(increaseAfter.height - increaseBefore.height)).toBeLessThan(0.5);

  await quantityInput.fill('2');
  await quantityInput.blur();
  await expect(quantityInput).toHaveValue('2');
  await expect(quantityDecrease).toBeEnabled();
  const decreaseBefore = await requireBox(quantityDecrease);
  await quantityDecrease.click();
  await expect(quantityInput).toHaveValue('1');
  await expect(quantityDecrease).toBeDisabled();
  const decreaseAfter = await requireBox(quantityDecrease);
  expect(Math.abs(decreaseAfter.x - decreaseBefore.x)).toBeLessThan(0.5);
  expect(Math.abs(decreaseAfter.y - decreaseBefore.y)).toBeLessThan(0.5);
  expect(Math.abs(decreaseAfter.width - decreaseBefore.width)).toBeLessThan(0.5);
  expect(Math.abs(decreaseAfter.height - decreaseBefore.height)).toBeLessThan(0.5);
});

`;
replaceOnce(browserPath, browserAnchor, stableGeometryTest + browserAnchor);

const verifierPath = 'scripts/verify-market-order-entry-compact.mjs';
replaceOnce(
  verifierPath,
  `  'position: absolute;',
  'width: 44px;',`,
  `  'position: absolute;',
  'top: 0;',
  'bottom: 0;',
  'margin-block: auto;',
  '.market-page-surface .market-stepper__button:disabled {',
  'width: 44px;',`,
);
replaceOnce(
  verifierPath,
  `  '输入框必须已经聚焦才消费纵向滚轮',
]) requireText(uiDesignPath, text);`,
  `  '输入框必须已经聚焦才消费纵向滚轮',
  '嵌入输入框的绝对定位操作按钮不得依赖',
]) requireText(uiDesignPath, text);`,
);
replaceOnce(
  verifierPath,
  `  'focused market price input owns the wheel in 0.01 steps',
  'market order book yields width to the order entry on desktop and mobile',`,
  `  'focused market price input owns the wheel in 0.01 steps',
  'embedded market steppers keep stable geometry through press and disabled states',
  'market order book yields width to the order entry on desktop and mobile',`,
);
replaceOnce(
  verifierPath,
  `forbidText(stylePath, 'minmax(0, 3fr) minmax(126px, 2fr)');`,
  `forbidText(stylePath, 'minmax(0, 3fr) minmax(126px, 2fr)');
forbidText(stylePath, 'transform: translateY(-50%);');`,
);
replaceOnce(
  verifierPath,
  `console.log('市场同行标签、内嵌步进按钮、聚焦金额滚轮、详情移除和订单簿宽度验证通过。');`,
  `console.log('市场同行标签、内嵌步进按钮稳定定位、聚焦金额滚轮、详情移除和订单簿宽度验证通过。');`,
);

console.log('市场步进按钮稳定定位修改完成。');
