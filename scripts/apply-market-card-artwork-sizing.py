from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    source = file_path.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:120]!r}')
    file_path.write_text(source.replace(old, new, 1), encoding='utf-8')


def append_once(path: str, marker: str, addition: str) -> None:
    file_path = Path(path)
    source = file_path.read_text(encoding='utf-8')
    if marker in source:
        return
    file_path.write_text(source.rstrip() + '\n\n' + addition.strip() + '\n', encoding='utf-8')


replace_once(
    'src/pages/MarketPage.tsx',
    '                    <strong className="market-asset-card__name">{product.name}</strong>',
    '''                    <strong className="market-asset-card__name">
                      <ProductIcon productId={product.id} className="market-asset-card__name-icon" />
                      <span>{product.name}</span>
                    </strong>''',
)

replace_once(
    'src/styles/product-artwork.css',
    '''.market-asset-card__icon-layer > .product-icon {
  width: 38px;
  height: 38px;
}''',
    '''.market-asset-card__icon-layer > .product-icon {
  width: 64px;
  height: 64px;
}''',
)
replace_once(
    'src/styles/product-artwork.css',
    '''  .market-asset-card__icon-layer > .product-icon {
    width: 34px;
    height: 34px;
  }''',
    '''  .market-asset-card__icon-layer > .product-icon {
    width: 48px;
    height: 48px;
  }''',
)

replace_once(
    'src/styles/market-page-polish.css',
    '  gap: var(--space-2);\n  overflow-x: auto;',
    '  gap: var(--space-3);\n  overflow-x: auto;',
)
replace_once(
    'src/styles/market-page-polish.css',
    '''.unified-asset-tab {
  position: relative;
  min-height: 72px;
  padding: 9px 11px;
}''',
    '''.unified-asset-tab {
  position: relative;
  min-height: 72px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  padding: 9px 11px;
  background: var(--gradient-panel);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.035),
    0 6px 16px rgba(0, 0, 0, 0.18);
}''',
)
replace_once(
    'src/styles/market-page-polish.css',
    '''.market-page-surface .market-asset-card__icon-layer {
  position: absolute;
  z-index: 1;
  inset: 18px 0;
  display: grid;''',
    '''.market-page-surface .market-asset-card__icon-layer {
  position: absolute;
  z-index: 1;
  inset: 14px 0;
  display: grid;''',
)
replace_once(
    'src/styles/market-page-polish.css',
    '''  gap: 2px 6px;
  padding: 8px 10px 7px;
  pointer-events: none;''',
    '''  gap: 2px 6px;
  padding: 7px 9px 6px;
  pointer-events: none;''',
)
replace_once(
    'src/styles/market-page-polish.css',
    '''.market-page-surface .market-asset-card__name {
  grid-area: name;
  min-width: 0;
  align-self: start;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}''',
    '''.market-page-surface .market-asset-card__name {
  grid-area: name;
  min-width: 0;
  align-self: start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  line-height: 1.15;
  white-space: nowrap;
}

.market-page-surface .market-asset-card__name-icon {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  color: var(--color-text-secondary);
}

.market-page-surface .unified-asset-tab.active .market-asset-card__name-icon {
  color: var(--color-success);
}

.market-page-surface .market-asset-card__name > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}''',
)
replace_once(
    'src/styles/market-page-polish.css',
    '''.market-page-surface .market-asset-card__inventory > .game-icon {
  width: 14px;
  height: 14px;
}

.unified-asset-tab.active {''',
    '''.market-page-surface .market-asset-card__inventory > .game-icon {
  width: 14px;
  height: 14px;
}

.market-page-surface .unified-asset-tab:hover:not(:disabled) {
  transform: none;
  border-color: rgba(123, 228, 158, 0.42);
  background: linear-gradient(145deg, rgba(18, 40, 31, 0.96), rgba(8, 21, 16, 0.94));
}

.unified-asset-tab.active {''',
)
replace_once(
    'src/styles/market-page-polish.css',
    '''.unified-asset-tab.active {
  border-color: var(--color-success);
  background: linear-gradient(145deg, rgba(49, 175, 94, 0.19), rgba(15, 34, 26, 0.92));
  box-shadow: inset 0 0 0 1px rgba(123, 228, 158, 0.36);
}''',
    '''.unified-asset-tab.active {
  border-color: var(--color-success);
  background: linear-gradient(145deg, rgba(49, 175, 94, 0.19), rgba(15, 34, 26, 0.92));
  box-shadow:
    inset 0 0 0 1px rgba(123, 228, 158, 0.36),
    0 8px 18px rgba(0, 0, 0, 0.22);
}''',
)
replace_once(
    'src/styles/market-page-polish.css',
    '''  .market-page-surface .market-asset-card__icon-layer {
    inset: 17px 0;
  }
}''',
    '''  .market-page-surface .market-asset-card__icon-layer {
    inset: 18px 0;
  }

  .market-page-surface .market-asset-card__data-layer {
    gap: 2px 5px;
    padding: 6px 8px;
  }
}''',
)

page_old = '商品和工厂保持同一连续目录，但目录使用两行横向布局、明确分组标记、前后滚动控制和“当前”文字状态。商品目录卡固定按 DOM 顺序先渲染图标层、再渲染数据层：图标层只能包含居中的 `ProductIcon`；数据层必须包含左上名称、右上 `CurrencyAmount` 最近真实成交价、左下真实 DOM“当前”胶囊和右下 `WarehouseIcon` 可用库存。两层都覆盖卡片，图标层位于下方且不参与数据网格，数据层位于上方且不得用伪元素生成“当前”胶囊。下单禁用必须说明资金、仓库或可售资产不足的具体原因。本地成交表必须显示成交总额以及卖方“手续费／实收”，买方对应位置显示无手续费，不得新增来源或对手列。最近 24h 成交笔数与 240 个六分钟行情分段使用同一时间窗口；零涨跌使用中性色。买盘和卖盘标题必须位于对应价格档位之前，稀疏订单簿按内容自然高度显示。'
page_new = '商品和工厂保持同一连续目录，但目录使用两行横向布局、明确分组标记、前后滚动控制和“当前”文字状态。商品目录卡固定按 DOM 顺序先渲染图标层、再渲染数据层：图标层只能包含居中的 `ProductIcon`；卡片几何保持桌面 `138 × 92px`、不大于 `720px` 时 `132 × 88px`，中央商品插画分别固定为 `64 × 64px` 和 `48 × 48px`，不得通过放大卡片获得更大的主视觉。数据层必须包含左上名称、右上 `CurrencyAmount` 最近真实成交价、左下真实 DOM“当前”胶囊和右下 `WarehouseIcon` 可用库存；左上名称必须以 `14 × 14px` 的对应商品 SVG 开头。两层都覆盖卡片，图标层位于下方且不参与数据网格，数据层位于上方且不得用伪元素生成“当前”胶囊。目录卡统一使用 `var(--radius-control)` 圆角、`var(--space-3)` 卡间距、强边框和轻量阴影区分相邻卡片；悬停不得发生位移。下单禁用必须说明资金、仓库或可售资产不足的具体原因。本地成交表必须显示成交总额以及卖方“手续费／实收”，买方对应位置显示无手续费，不得新增来源或对手列。最近 24h 成交笔数与 240 个六分钟行情分段使用同一时间窗口；零涨跌使用中性色。买盘和卖盘标题必须位于对应价格档位之前，稀疏订单簿按内容自然高度显示。'
replace_once('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', page_old, page_new)

ui_old = '- 商品标签使用商品 SVG，工厂标签使用独立厂房 SVG。市场商品目录卡必须使用两个按 DOM 顺序渲染的覆盖层：先渲染只包含 `ProductIcon` 的图标层，再渲染包含名称、`CurrencyAmount` 最近成交价、`WarehouseIcon` 库存和真实 DOM“当前”胶囊的数据层；图标层 `z-index` 必须低于数据层，两层均不得截获按钮指针事件。'
ui_new = '- 商品标签使用商品 SVG，工厂标签使用独立厂房 SVG。市场商品目录卡必须使用两个按 DOM 顺序渲染的覆盖层：先渲染只包含 `ProductIcon` 的图标层，再渲染包含名称、`CurrencyAmount` 最近成交价、`WarehouseIcon` 库存和真实 DOM“当前”胶囊的数据层；桌面中央插画固定 `64 × 64px`，不大于 `720px` 时固定 `48 × 48px`，卡片仍分别保持 `138 × 92px` 与 `132 × 88px`。名称前固定渲染 `14 × 14px` 对应商品 SVG；目录卡使用 `var(--radius-control)`、`var(--space-3)` 间距、强边框和轻量阴影，悬停不位移。图标层 `z-index` 必须低于数据层，两层均不得截获按钮指针事件。'
replace_once('docs/UI_DESIGN_SYSTEM.md', ui_old, ui_new)

index_old = '40. 市场商品目录卡内部信息布局归属页面职责与市场专用样式：卡片必须先渲染只包含居中 `ProductIcon` 的图标层，再渲染包含左上名称、右上 `CurrencyAmount` 最近真实成交价、左下真实 DOM“当前”胶囊和右下 `WarehouseIcon` 可用库存的数据层。图标层必须位于数据层下方且不参与数据网格，两层均覆盖卡片并禁用指针事件；商品卡不得用 `::after` 生成“当前”胶囊。没有真实成交时商品和工厂目录价格统一显示 `—`，不得回退到商品基础价或工厂系统价值；实现必须同步 `MarketPage.tsx`、`market-page-polish.css`、`product-artwork.css`、`scripts/verify-market-page-layout.mjs` 与市场浏览器测试。'
index_new = '40. 市场商品目录卡内部信息布局归属页面职责与市场专用样式：卡片必须先渲染只包含居中 `ProductIcon` 的图标层，再渲染包含左上名称、右上 `CurrencyAmount` 最近真实成交价、左下真实 DOM“当前”胶囊和右下 `WarehouseIcon` 可用库存的数据层。桌面／移动卡片继续固定为 `138 × 92px`／`132 × 88px`，中央插画固定为 `64 × 64px`／`48 × 48px`，名称前固定增加 `14 × 14px` 对应商品 SVG；卡片使用 `var(--radius-control)` 圆角、`var(--space-3)` 间距、强边框和轻量阴影区分相邻项目，悬停不得位移。图标层必须位于数据层下方且不参与数据网格，两层均覆盖卡片并禁用指针事件；商品卡不得用 `::after` 生成“当前”胶囊。没有真实成交时商品和工厂目录价格统一显示 `—`，不得回退到商品基础价或工厂系统价值；实现必须同步 `MarketPage.tsx`、`market-page-polish.css`、`product-artwork.css`、`scripts/verify-market-page-layout.mjs` 与市场浏览器测试。'
replace_once('docs/README.md', index_old, index_new)

verify_insert_after = "requireText(productArtworkStyles, '.market-asset-card__icon-layer', '商品插画映射必须识别市场商品图标层。');"
verify_addition = """requireText(productArtworkStyles, 'width: 64px;\\n  height: 64px;', '桌面市场商品中央插画必须固定为 64px。');
requireText(productArtworkStyles, 'width: 48px;\\n    height: 48px;', '移动市场商品中央插画必须固定为 48px。');
requireText(marketStyles, 'gap: var(--space-3);\\n  overflow-x: auto;', '市场资产卡间距必须使用 12px 设计令牌。');
requireText(marketStyles, 'border-radius: var(--radius-control);', '市场资产卡必须使用统一圆角令牌。');
requireText(marketStyles, 'inset: 14px 0;', '桌面市场中央插画层必须为 64px 主视觉保留居中区域。');
requireText(marketStyles, 'padding: 7px 9px 6px;', '桌面市场数据层必须使用紧凑四角内边距。');
requireText(marketStyles, '.market-page-surface .market-asset-card__name-icon', '市场商品名称必须提供独立 SVG 图标样式。');
requireText(marketStyles, 'transform: none;', '市场资产卡悬停不得位移。');
requireText(marketPage, 'className=\"market-asset-card__name-icon\"', '市场商品名称前必须渲染对应商品 SVG。');
requireText(runtimeSpec, 'market product artwork uses 64px desktop and 48px mobile without resizing cards', 'Playwright 必须覆盖市场中央插画尺寸、卡片尺寸、圆角和间距。');"""
replace_once(
    'scripts/verify-market-page-layout.mjs',
    verify_insert_after,
    verify_insert_after + '\n' + verify_addition,
)

append_once(
    'tests/browser/market-runtime.spec.ts',
    "test('market product artwork uses 64px desktop and 48px mobile without resizing cards'",
    r'''test('market product artwork uses 64px desktop and 48px mobile without resizing cards', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active');

  const wheatTab = page.getByRole('tab', { name: /^小麦/ });
  const desktopMetrics = await wheatTab.evaluate((element) => {
    const card = element as HTMLElement;
    const artwork = card.querySelector<HTMLElement>('.market-asset-card__icon-layer > .product-icon');
    const nameIcon = card.querySelector<HTMLElement>('.market-asset-card__name-icon');
    const directory = card.closest<HTMLElement>('.unified-asset-tabs');
    if (!artwork || !nameIcon || !directory) throw new Error('market product card visual fixture is incomplete');
    const cardRect = card.getBoundingClientRect();
    const artworkRect = artwork.getBoundingClientRect();
    const nameIconRect = nameIcon.getBoundingClientRect();
    const cardStyle = getComputedStyle(card);
    return {
      cardWidth: cardRect.width,
      cardHeight: cardRect.height,
      artworkWidth: artworkRect.width,
      artworkHeight: artworkRect.height,
      nameIconWidth: nameIconRect.width,
      nameIconHeight: nameIconRect.height,
      borderRadius: Number.parseFloat(cardStyle.borderTopLeftRadius),
      directoryGap: Number.parseFloat(getComputedStyle(directory).columnGap),
      transform: cardStyle.transform,
    };
  });
  expect(desktopMetrics.cardWidth).toBeCloseTo(138, 0);
  expect(desktopMetrics.cardHeight).toBeCloseTo(92, 0);
  expect(desktopMetrics.artworkWidth).toBeCloseTo(64, 0);
  expect(desktopMetrics.artworkHeight).toBeCloseTo(64, 0);
  expect(desktopMetrics.nameIconWidth).toBeCloseTo(14, 0);
  expect(desktopMetrics.nameIconHeight).toBeCloseTo(14, 0);
  expect(desktopMetrics.borderRadius).toBeCloseTo(12, 0);
  expect(desktopMetrics.directoryGap).toBeCloseTo(12, 0);
  expect(desktopMetrics.transform).toBe('none');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => wheatTab.evaluate((element) => {
    const card = element as HTMLElement;
    const artwork = card.querySelector<HTMLElement>('.market-asset-card__icon-layer > .product-icon');
    if (!artwork) throw new Error('mobile market product artwork is missing');
    const cardRect = card.getBoundingClientRect();
    const artworkRect = artwork.getBoundingClientRect();
    return {
      cardWidth: Math.round(cardRect.width),
      cardHeight: Math.round(cardRect.height),
      artworkWidth: Math.round(artworkRect.width),
      artworkHeight: Math.round(artworkRect.height),
    };
  })).toEqual({
    cardWidth: 132,
    cardHeight: 88,
    artworkWidth: 48,
    artworkHeight: 48,
  });
  expect(pageErrors).toEqual([]);
});''',
)

print('Market asset card artwork sizing, SVG labels, rounded separation, docs and regressions updated.')
