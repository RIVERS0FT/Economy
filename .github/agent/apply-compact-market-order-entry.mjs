import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content, 'utf8');

function countText(source, text) {
  return source.split(text).length - 1;
}

function replaceText(path, before, after, expected = 1) {
  const source = read(path);
  const count = countText(source, before);
  if (count !== expected) {
    throw new Error(`${path}: expected ${expected} occurrence(s), found ${count}: ${before.slice(0, 120)}`);
  }
  write(path, source.split(before).join(after));
}

function replaceRegex(path, expression, after, expected = 1) {
  const source = read(path);
  const flags = expression.flags.includes('g') ? expression.flags : `${expression.flags}g`;
  const matches = [...source.matchAll(new RegExp(expression.source, flags))];
  if (matches.length !== expected) {
    throw new Error(`${path}: expected ${expected} regex match(es), found ${matches.length}: ${expression}`);
  }
  write(path, source.replace(expression, after));
}

function transformSection(path, startMarker, endMarker, transform) {
  const source = read(path);
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`${path}: section markers not found`);
  const section = source.slice(start, end);
  const transformed = transform(section);
  if (transformed === section) throw new Error(`${path}: section transform made no change`);
  write(path, `${source.slice(0, start)}${transformed}${source.slice(end)}`);
}

const formControls = 'src/components/ui/FormControls.tsx';
replaceText(
  formControls,
  "import { formatMoneyDraft, normalizeMoneyDraft } from '../../utils/moneyDraft';",
  "import { formatMoneyDraft, normalizeMoneyDraft, parseMoneyDraft } from '../../utils/moneyDraft';",
);
replaceText(
  formControls,
  `type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'
> & SharedFieldProps & {
  value: string;
  fallbackValue: number;
  min?: number;
  max?: number;
  onValueChange: (value: string) => void;
};`,
  `type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'
> & SharedFieldProps & {
  value: string;
  fallbackValue: number;
  min?: number;
  max?: number;
  wheelStep?: number;
  onValueChange: (value: string) => void;
};`,
);
transformSection(formControls, 'export function MoneyInput({', 'export function FileInput({', (section) => {
  let next = section;
  const destructuringBefore = `  min,
  max,
  required,
  onValueChange,`;
  const destructuringAfter = `  min,
  max,
  wheelStep,
  required,
  onValueChange,`;
  if (countText(next, destructuringBefore) !== 1) throw new Error('MoneyInput destructuring changed unexpectedly');
  next = next.replace(destructuringBefore, destructuringAfter);

  const setupBefore = `  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (`;
  const setupAfter = `  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || wheelStep === undefined) return undefined;
    const stepCents = Math.round(wheelStep * 100);
    if (!Number.isFinite(wheelStep) || !Number.isSafeInteger(stepCents) || stepCents <= 0) return undefined;

    const handleWheel = (event: WheelEvent) => {
      if (document.activeElement !== input || event.deltaY === 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (input.disabled || input.readOnly) return;

      const parsed = parseMoneyDraft(input.value, { min, max });
      const minimum = min ?? Number.MIN_SAFE_INTEGER;
      const maximum = max ?? Number.MAX_SAFE_INTEGER;
      const current = parsed ?? Math.min(maximum, Math.max(minimum, fallbackValue));
      const direction = event.deltaY < 0 ? 1 : -1;
      const nextCents = Math.round(current * 100) + direction * stepCents;
      const minimumCents = Math.ceil(minimum * 100);
      const maximumCents = Math.floor(maximum * 100);
      const clampedCents = Math.min(maximumCents, Math.max(minimumCents, nextCents));
      onValueChange(formatMoneyDraft(clampedCents / 100));
    };

    input.addEventListener('wheel', handleWheel, { passive: false });
    return () => input.removeEventListener('wheel', handleWheel);
  }, [fallbackValue, max, min, onValueChange, wheelStep]);

  return (`;
  if (countText(next, setupBefore) !== 1) throw new Error('MoneyInput setup changed unexpectedly');
  next = next.replace(setupBefore, setupAfter);

  const inputBefore = `      <input
        {...props}
        id={inputId}`;
  const inputAfter = `      <input
        {...props}
        ref={inputRef}
        id={inputId}`;
  if (countText(next, inputBefore) !== 1) throw new Error('MoneyInput input changed unexpectedly');
  return next.replace(inputBefore, inputAfter);
});

const marketPage = 'src/pages/MarketPage.tsx';
replaceText(
  marketPage,
  `                      min={0.01}
                      max={1_000_000}
                      aria-invalid={Boolean(priceReason)}`,
  `                      min={0.01}
                      max={1_000_000}
                      wheelStep={0.01}
                      aria-invalid={Boolean(priceReason)}`,
);
replaceRegex(
  marketPage,
  /\n                <details className="market-order-details">[\s\S]*?\n                <\/details>/,
  '',
);
replaceText(
  marketPage,
  `                <Button
                  block
                  disabled={Boolean(orderDisabledReason)}`,
  `                <Button
                  block
                  className="market-submit-order"
                  disabled={Boolean(orderDisabledReason)}`,
);

const marketStyles = 'src/styles/market-page-polish.css';
replaceText(
  marketStyles,
  '  grid-template-columns: minmax(280px, 44fr) minmax(300px, 56fr);',
  '  grid-template-columns: minmax(320px, 3fr) minmax(240px, 2fr);',
);
replaceRegex(
  marketStyles,
  /\.market-stepper-block \{[\s\S]*?\.market-stepper__input \{[\s\S]*?\n\}/,
  `.market-stepper-block {
  --market-stepper-label-width: 52px;
  min-width: 0;
  display: grid;
  gap: var(--space-1);
  margin-top: var(--space-3);
}

.market-page-surface .market-stepper {
  position: relative;
  min-width: 0;
}

.market-page-surface .market-stepper__field {
  min-width: 0;
  display: grid;
  grid-template-columns: var(--market-stepper-label-width) minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
  margin: 0;
}

.market-page-surface .market-stepper__field > .ui-form-field__label {
  align-self: center;
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 800;
}

.market-page-surface .market-stepper__button {
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

.market-page-surface .market-stepper__button:hover:not(:disabled),
.market-page-surface .market-stepper__button:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.045);
  transform: translateY(-50%);
}

.market-page-surface .market-stepper__input {
  grid-column: 2;
  min-width: 0;
  width: 100%;
  padding-inline: 44px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}`,
);
replaceText(
  marketStyles,
  `.market-stepper-block > .ui-form-field__description,
.market-stepper-block > .ui-form-field__error {
  display: block;
  margin: 0;
  line-height: 1.4;
}`,
  `.market-stepper-block > .ui-form-field__description,
.market-stepper-block > .ui-form-field__error {
  display: block;
  margin: 0 0 0 calc(var(--market-stepper-label-width) + var(--space-2));
  line-height: 1.4;
}`,
);
replaceRegex(
  marketStyles,
  /\n\.market-order-details \{[\s\S]*?\n\.order-book-columns \{/,
  '\n.order-book-columns {',
);
replaceText(
  marketStyles,
  '    grid-template-columns: minmax(0, 3fr) minmax(126px, 2fr);',
  '    grid-template-columns: minmax(0, 2fr) minmax(126px, 1fr);',
);
replaceText(
  marketStyles,
  `  .market-stepper {
    grid-template-columns: var(--control-height) minmax(0, 1fr) var(--control-height);
    gap: 4px;
  }`,
  `  .market-stepper-block {
    --market-stepper-label-width: 44px;
  }`,
);
replaceText(
  marketStyles,
  `  .market-order-summary-grid,
  .market-trade-card .market-order-capacity {
    grid-template-columns: minmax(0, 1fr);
  }`,
  `  .market-order-summary-grid {
    grid-template-columns: minmax(0, 1fr);
  }`,
);
write(
  marketStyles,
  `${read(marketStyles).trimEnd()}\n\n/* Compact market order-entry controls. */
.market-page-surface .market-submit-order {
  margin-top: var(--space-3);
}

.market-page-surface .order-disabled-reason + .market-submit-order {
  margin-top: 0;
}

@media (max-width: 720px) {
  .market-page-surface .market-stepper__button {
    width: 44px;
    min-width: 44px;
    height: 44px;
  }

  .market-page-surface .market-stepper__input {
    padding-inline: 52px;
  }
}\n`,
);

const orderBookDesign = 'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md';
replaceText(
  orderBookDesign,
  '价格和数量均使用“减号按钮／共享输入控件／加号按钮”组合',
  '价格和数量均使用“字段标签／内嵌减号按钮／共享输入控件／内嵌加号按钮”的单行组合',
);
replaceText(
  orderBookDesign,
  '资金、仓库、冻结、抵押和生产参与等次要指标收进“交易资产详情”折叠区。',
  '不再提供“交易资产详情”折叠区；资金、仓库、库存、冻结、抵押和生产参与只在摘要、限制说明或所属页面展示，市场不得重复堆叠。',
);
replaceText(orderBookDesign, '下单 44%／盘口 56%', '下单 60%／盘口 40%', 2);
replaceText(orderBookDesign, '约 60%／40%', '约 66%／34%', 2);
replaceText(
  orderBookDesign,
  '点击任一档位只把该档价格填入价格输入，不得直接提交订单。',
  '点击任一档位只把该档价格填入价格输入，不得直接提交订单。价格输入只在显式启用 `wheelStep={0.01}`、输入框已聚焦且滚轮命中输入框时按 0.01 调整并消费纵向滚轮；未聚焦时必须放行页面滚动。',
);
replaceText(
  orderBookDesign,
  '- 让价格或数量加减按钮绕过输入解析、合法边界、资金、仓库、库存、工厂可出售量或订单上限；',
  '- 让价格或数量加减按钮绕过输入解析、合法边界、资金、仓库、库存、工厂可出售量或订单上限；\n- 恢复独立的“交易资产详情”折叠区、把字段标签放回输入框上方，或把加减按钮移回输入框外部；',
);

const uiDesign = 'docs/UI_DESIGN_SYSTEM.md';
const integerWheelRule = '- 整数输入始终拥有发生在自身命中区域内的滚轮事件：`IntegerInput` 必须在真实 `<input>` 节点上注册非被动原生 `wheel` 监听器，并在事件到达父级 `ScrollArea` 前同时调用 `preventDefault()` 与 `stopPropagation()`；可编辑输入按纵向滚轮方向以步长 1 增减并限制在 `min`／`max`，只读、禁用、横向滚轮和到达数值边界时仍消费事件但不改变值，页面不得跟随滚动。';
replaceText(
  uiDesign,
  integerWheelRule,
  `${integerWheelRule}\n- 金额输入默认不响应滚轮；只有业务显式传入正数 \`wheelStep\` 时，\`MoneyInput\` 才在真实输入节点注册非被动原生 \`wheel\` 监听器。输入框必须已经聚焦才消费纵向滚轮，并按“分”的整数步长限制在 \`min\`／\`max\`；未聚焦时必须放行滚轮，避免浏览页面时误改金额。`,
);

const pageDesign = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
replaceText(
  pageDesign,
  '卖出方向必须在订单总额下显示按整张订单完全成交估算的“预计手续费（累计成交额的 1%）”和“预计到账”；成交额全部被最低手续费抵扣时显示明确提示。服务器仍按真实逐笔成交和单张卖单累计额结算，客户端估算不参与扣费。',
  '卖出方向必须在订单摘要中常驻显示按整张订单完全成交估算的“预计到账”；服务器仍按真实逐笔成交和单张卖单累计额结算，客户端估算不参与扣费。市场不显示重复的交易资产详情折叠区，手续费规则继续由预计到账、本地成交记录和服务器结算共同表达。',
);

const marketLayoutVerifier = 'scripts/verify-market-page-layout.mjs';
replaceText(
  marketLayoutVerifier,
  "requireText(marketStyles, 'grid-template-columns: minmax(280px, 44fr) minmax(300px, 56fr);', '交易卡桌面内部必须使用下单区 44%、订单簿 56% 的双列结构。');",
  "requireText(marketStyles, 'grid-template-columns: minmax(320px, 3fr) minmax(240px, 2fr);', '交易卡桌面内部必须使用下单区 60%、订单簿 40% 的双列结构。');",
);
replaceText(
  marketLayoutVerifier,
  "requireText(marketStyles, 'grid-template-columns: minmax(0, 3fr) minmax(126px, 2fr);', '340px 至 819px 交易卡必须保持约 60%／40% 的下单与盘口同排结构。');",
  "requireText(marketStyles, 'grid-template-columns: minmax(0, 2fr) minmax(126px, 1fr);', '340px 至 819px 交易卡必须保持约 66%／34% 的下单与盘口同排结构。');",
);
replaceText(
  marketLayoutVerifier,
  "requireText(marketDesign, '价格和数量均使用“减号按钮／共享输入控件／加号按钮”', '订单簿设计必须记录步进输入组合。');",
  "requireText(marketDesign, '字段标签／内嵌减号按钮／共享输入控件／内嵌加号按钮', '订单簿设计必须记录同行内嵌步进输入组合。');",
);

const marketAssetsVerifier = 'scripts/verify-market-assets.mjs';
replaceText(
  marketAssetsVerifier,
  "  '价格和数量均使用“减号按钮／共享输入控件／加号按钮”',",
  "  '字段标签／内嵌减号按钮／共享输入控件／内嵌加号按钮',",
);

const runtimeSpec = 'tests/browser/market-runtime.spec.ts';
replaceText(
  runtimeSpec,
  `  expect(narrowOrder.width / narrowBook.width).toBeGreaterThan(1.35);
  expect(narrowOrder.width / narrowBook.width).toBeLessThan(1.65);`,
  `  expect(narrowOrder.width / narrowBook.width).toBeGreaterThan(1.75);
  expect(narrowOrder.width / narrowBook.width).toBeLessThan(2.25);`,
);

const sellFeeVerifier = 'scripts/verify-market-sell-fee.mjs';
replaceText(
  sellFeeVerifier,
  "for (const text of ['estimatedSellFee', '预计手续费', '预计到账', '手续费 / 实收']) {",
  "for (const text of ['estimatedSellFee', 'estimatedNetTotal', '预计到账', '手续费 / 实收']) {",
);
replaceText(
  sellFeeVerifier,
  "  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '预计手续费'],",
  "  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '预计到账'],",
);

const packagePath = 'package.json';
replaceText(
  packagePath,
  'node scripts/verify-form-controls.mjs && node scripts/verify-contract-layout.mjs',
  'node scripts/verify-form-controls.mjs && node scripts/verify-market-order-entry-compact.mjs && node scripts/verify-contract-layout.mjs',
);
