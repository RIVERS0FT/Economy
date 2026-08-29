from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, got {count}: {old[:120]}')
    write(path, text.replace(old, new, 1))


def replace_all(path, old, new, expected=None):
    text = read(path)
    count = text.count(old)
    if expected is not None and count != expected:
        raise SystemExit(f'{path}: expected {expected} matches, got {count}: {old[:120]}')
    if count == 0:
        raise SystemExit(f'{path}: no match: {old[:120]}')
    write(path, text.replace(old, new))


def sub_once(path, pattern, repl):
    text = read(path)
    text2, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{path}: regex expected one match, got {count}: {pattern[:120]}')
    write(path, text2)


market = 'src/pages/GlobalMarketPage.tsx'
replace_once(
    market,
    '          <MarketCommodityHeader\n            entityLabel="地区"',
    '          <section className="entity-list-surface global-market-product-region-surface">\n            <MarketCommodityHeader\n              entityLabel="地区"',
)
replace_once(
    market,
    '          <ul className="global-market-product-region-list" aria-label={`${selectedGlobalProduct.name}各地区行情`}>',
    '            <ul className="entity-list-rows global-market-product-region-list" aria-label={`${selectedGlobalProduct.name}各地区行情`}>',
)
replace_once(
    market,
    '          </ul>\n        </div>\n      </PageLayout>\n    );\n  }\n\n  const activeCatalogFilterCount',
    '            </ul>\n          </section>\n        </div>\n      </PageLayout>\n    );\n  }\n\n  const activeCatalogFilterCount',
)
replace_once(
    market,
    '        <EntityListHeader\n          className="global-market-goods-header"',
    '        <section className="entity-list-surface global-market-goods-surface">\n          <EntityListHeader\n            className="global-market-goods-header"',
)
replace_once(
    market,
    '        <ul className="global-market-goods-list" aria-label="全局商品目录">',
    '          <ul className="entity-list-rows global-market-goods-list" aria-label="全局商品目录">',
)
replace_once(
    market,
    '        </ul>\n      </div>\n    </PageLayout>\n  );\n}',
    '          </ul>\n        </section>\n      </div>\n    </PageLayout>\n  );\n}',
)
replace_once(
    market,
    '<span className="global-market-goods-row__metric"><strong>{typeof row.priceChange24h === \'number\'',
    '<span className={`global-market-goods-row__metric entity-list-value ${typeof row.priceChange24h !== \'number\' ? \'is-unavailable\' : row.priceChange24h > 0 ? \'is-positive\' : row.priceChange24h < 0 ? \'is-negative\' : \'is-neutral\'}`}><strong>{typeof row.priceChange24h === \'number\'',
)

buildings = 'src/pages/GlobalBuildingsPage.tsx'
replace_once(
    buildings,
    '          {facilityProvinceRows.length > 0 ? (\n            <>\n              <EntityListHeader',
    '          {facilityProvinceRows.length > 0 ? (\n            <section className="entity-list-surface global-facility-region-surface">\n              <EntityListHeader',
)
replace_once(
    buildings,
    '              <ul className="global-facility-region-list" aria-label={`${selectedGlobalFacility.name}地区工厂`}>',
    '              <ul className="entity-list-rows global-facility-region-list" aria-label={`${selectedGlobalFacility.name}地区工厂`}>',
)
replace_once(
    buildings,
    '              </ul>\n            </>\n          ) : <Panel className="empty-state">当前已没有地区持有该工厂。</Panel>}',
    '              </ul>\n            </section>\n          ) : <Panel className="empty-state">当前已没有地区持有该工厂。</Panel>}',
)
replace_once(
    buildings,
    '<section className="global-facility-catalog" aria-label="全局工厂目录">',
    '<section className="entity-list-surface global-facility-catalog" aria-label="全局工厂目录">',
)
replace_once(
    buildings,
    '<ul className="global-facility-catalog-list" aria-label="跨州工厂汇总">',
    '<ul className="entity-list-rows global-facility-catalog-list" aria-label="跨州工厂汇总">',
)
replace_once(
    buildings,
    'className={`global-facility-region-row__profit is-${row.profitTone}`}',
    'className={`entity-list-value global-facility-region-row__profit is-${row.profitTone}`}',
)
replace_once(
    buildings,
    'className={`global-facility-catalog-row__metric global-facility-catalog-row__profit is-${row.profitTone}`}',
    'className={`entity-list-value global-facility-catalog-row__metric global-facility-catalog-row__profit is-${row.profitTone}`}',
)

commodity = 'src/components/market/MarketCommodityRow.tsx'
replace_once(
    commodity,
    '<span className={`market-commodity-row__metric market-commodity-row__trend${trendClassName}`}>',
    '<span className={`entity-list-value market-commodity-row__metric market-commodity-row__trend${trendClassName}${trend === undefined ? \' is-unavailable\' : trend === 0 ? \' is-neutral\' : \'\'}`}>',
)

css = 'src/styles/global-operation-pages.css'
replace_once(
    css,
    '.global-facility-catalog-header,\n.global-facility-region-header {\n  --entity-list-gap: .55rem;\n  --entity-list-inline-padding: .6rem;\n}\n\n',
    '',
)
replace_all(
    css,
    '  --entity-list-columns: minmax(0, 1.6fr) minmax(7rem, .8fr) minmax(4rem, .45fr) 1rem;',
    '  --entity-list-columns: minmax(0, 1.6fr) minmax(7rem, .8fr) minmax(4rem, .45fr) var(--entity-list-chevron-column);',
    expected=2,
)
replace_all(
    css,
    '  --entity-list-columns: minmax(0, 1.45fr) minmax(6rem, .7fr) minmax(3.5rem, .42fr) minmax(4.5rem, .55fr) 1rem;',
    '  --entity-list-columns: minmax(0, 1.45fr) minmax(6rem, .7fr) minmax(3.5rem, .42fr) minmax(4.5rem, .55fr) var(--entity-list-chevron-column);',
    expected=2,
)
sub_once(
    css,
    r'\.global-facility-catalog-list,\n\.global-facility-region-list \{.*?\.global-facility-region-list > li \{\n  min-width: 0;\n\}\n\n',
    '',
)
replace_once(
    css,
    '.global-facility-catalog-row,\n.global-facility-region-row {\n  position: relative;\n  --entity-list-gap: .55rem;\n  --entity-list-inline-padding: .6rem;\n}',
    '.global-facility-catalog-row,\n.global-facility-region-row {\n  position: relative;\n}',
)
replace_once(
    css,
    '  grid-template-columns: 42px minmax(0, 1fr);\n  align-items: center;\n  gap: .65rem;',
    '  grid-template-columns: var(--entity-list-artwork-slot) minmax(0, 1fr);\n  align-items: center;\n  gap: var(--entity-list-gap);',
)
replace_once(
    css,
    '.global-facility-catalog-row__artwork {\n  width: 42px;\n  height: 42px;\n  min-width: 42px;\n  aspect-ratio: 1;\n  overflow: hidden;\n  border-radius: var(--radius-control);\n}',
    '.global-facility-catalog-row__artwork {\n  width: var(--entity-list-artwork-size);\n  height: var(--entity-list-artwork-size);\n  min-width: var(--entity-list-artwork-size);\n  aspect-ratio: 1;\n  justify-self: center;\n  overflow: hidden;\n  border-radius: var(--radius-control);\n}',
)
sub_once(
    css,
    r'\.global-facility-catalog-row__profit\.is-positive,.*?\.global-facility-region-row__profit\.is-unavailable \{\n  color: var\(--color-text-primary\);\n\}\n\n',
    '',
)
replace_once(
    css,
    '.global-market-goods-header {\n  --entity-list-columns: minmax(8.5rem, 1.4fr) repeat(5, minmax(4.6rem, .64fr)) .8rem;\n  margin-bottom: .32rem;\n}',
    '.global-market-goods-header {\n  --entity-list-columns: minmax(8.5rem, 1.4fr) repeat(5, minmax(4.6rem, .64fr)) var(--entity-list-chevron-column);\n}',
)
sub_once(
    css,
    r'\.global-market-goods-list,\n\.global-market-product-region-list \{.*?\.global-market-product-region-list > li \{\n  max-width: 100%;\n  min-width: 0;\n\}\n\n',
    '',
)
replace_once(
    css,
    '  --entity-list-columns: minmax(8.5rem, 1.4fr) repeat(5, minmax(4.6rem, .64fr)) .8rem;',
    '  --entity-list-columns: minmax(8.5rem, 1.4fr) repeat(5, minmax(4.6rem, .64fr)) var(--entity-list-chevron-column);',
)
replace_once(
    css,
    '  grid-template-columns: 42px minmax(0, 1fr);\n  align-items: center;\n  gap: .55rem;',
    '  grid-template-columns: var(--entity-list-artwork-slot) minmax(0, 1fr);\n  align-items: center;\n  gap: var(--entity-list-gap);',
)
replace_once(
    css,
    '.global-market-goods-row__artwork {\n  width: 42px;\n  height: 42px;\n  display: grid;',
    '.global-market-goods-row__artwork {\n  width: var(--entity-list-artwork-slot);\n  height: var(--entity-list-artwork-slot);\n  display: grid;',
)
replace_once(
    css,
    '.global-market-goods-row__artwork > .product-artwork {\n  width: 34px;\n  height: 34px;\n}',
    '.global-market-goods-row__artwork > .product-artwork {\n  width: var(--entity-list-artwork-size);\n  height: var(--entity-list-artwork-size);\n}',
)
sub_once(
    css,
    r'@container global-market-page \(max-width: 760px\) \{.*?\}\n\n@container global-market-page \(max-width: 620px\)',
    '@container global-market-page (max-width: 620px)',
)
text = read(css)
for old in [
    '    --entity-list-gap: .3rem;\n    --entity-list-inline-padding: .4rem;\n',
    '    --entity-list-gap: .25rem;\n    --entity-list-inline-padding: .4rem;\n',
    '    --entity-list-gap: .2rem;\n    --entity-list-inline-padding: .3rem;\n',
    '    --entity-list-gap: .1rem;\n    --entity-list-inline-padding: .3rem;\n',
    '    --entity-list-gap: .25rem;\n',
    '    --entity-list-gap: .18rem;\n    --entity-list-inline-padding: .3rem;\n',
    '    --entity-list-inline-padding: .4rem;\n',
    '    --entity-list-inline-padding: .3rem;\n',
]:
    text = text.replace(old, '')
for old, new in [
    (' minmax(2.4rem, .42fr) .6rem;', ' minmax(2.4rem, .42fr) var(--entity-list-chevron-column);'),
    (' minmax(3rem, .48fr) .6rem;', ' minmax(3rem, .48fr) var(--entity-list-chevron-column);'),
    (' minmax(2.1rem, .4fr) .55rem;', ' minmax(2.1rem, .4fr) var(--entity-list-chevron-column);'),
    (' minmax(0, .75fr) .4rem;', ' minmax(0, .75fr) var(--entity-list-chevron-column);'),
    (' repeat(5, minmax(2.7rem, .56fr)) .6rem;', ' repeat(5, minmax(2.7rem, .56fr)) var(--entity-list-chevron-column);'),
    (' repeat(5, minmax(2.15rem, .52fr)) .5rem;', ' repeat(5, minmax(2.15rem, .52fr)) var(--entity-list-chevron-column);'),
    ('    grid-template-columns: 40px minmax(0, 1fr);\n    gap: .4rem;', '    grid-template-columns: var(--entity-list-artwork-slot) minmax(0, 1fr);\n    gap: var(--entity-list-gap);'),
    ('    width: 40px;\n    height: 40px;\n    min-width: 40px;', '    width: var(--entity-list-artwork-size);\n    height: var(--entity-list-artwork-size);\n    min-width: var(--entity-list-artwork-size);'),
    ('    grid-template-columns: 36px minmax(0, 1fr);\n    gap: .3rem;', '    grid-template-columns: var(--entity-list-artwork-slot) minmax(0, 1fr);\n    gap: var(--entity-list-gap);'),
    ('    width: 36px;\n    height: 36px;\n    min-width: 36px;', '    width: var(--entity-list-artwork-size);\n    height: var(--entity-list-artwork-size);\n    min-width: var(--entity-list-artwork-size);'),
    ('    grid-template-columns: 34px minmax(0, 1fr);\n    gap: .35rem;', '    grid-template-columns: var(--entity-list-artwork-slot) minmax(0, 1fr);\n    gap: var(--entity-list-gap);'),
    ('    width: 34px;\n    height: 34px;', '    width: var(--entity-list-artwork-slot);\n    height: var(--entity-list-artwork-slot);'),
    ('    width: 29px;\n    height: 29px;', '    width: var(--entity-list-artwork-size);\n    height: var(--entity-list-artwork-size);'),
]:
    text = text.replace(old, new)
text = text.replace('  .global-facility-catalog-header,\n  .global-facility-region-header {\n    font-size: .625rem;\n  }\n\n', '')
text = text.replace('  .global-market-goods-header {\n    font-size: .625rem;\n  }\n\n', '')
text = text.replace('  .global-market-goods-row {\n    padding-block: .35rem;\n  }\n\n', '')
text = re.sub(
    r'\n  \.global-facility-region-row__identity > strong,\n  \.global-facility-region-row__profit,\n  \.global-facility-region-row__metric,\n  \.global-facility-region-row__status \{\n    font-size: \.6875rem;\n  \}\n',
    '\n',
    text,
)
write(css, text)

commodity_css = 'src/styles/market-commodity-row.css'
text = read(commodity_css)
text = text.replace('repeat(5, minmax(3.8rem, .64fr)) .8rem;', 'repeat(5, minmax(3.8rem, .64fr)) var(--entity-list-chevron-column, .8rem);')
text = text.replace('repeat(5, minmax(2.35rem, .58fr)) .65rem;', 'repeat(5, minmax(2.35rem, .58fr)) var(--entity-list-chevron-column, .65rem);')
text = text.replace('repeat(5, minmax(2.05rem, .56fr)) .55rem;', 'repeat(5, minmax(2.05rem, .56fr)) var(--entity-list-chevron-column, .55rem);')
text = re.sub(
    r'\n\.market-commodity-row__trend\.is-positive strong \{.*?\.market-commodity-row__trend\.is-negative strong \{\n  color: var\(--color-danger\);\n\}\n',
    '\n',
    text,
    flags=re.S,
)
write(commodity_css, text)

ui = 'docs/UI_DESIGN_SYSTEM.md'
replace_once(
    ui,
    '| `src/styles/entity-list-header.css` | 所有带表头实体列表共享的表头基线令牌：统一弱化文字、加粗字重、下边框分隔、单元格省略和网格行布局；业务列表只补充各自列模板与横向内边距 |',
    '| `src/styles/entity-list-header.css` | 所有带表头页面实体列表的统一视觉权威：列表表面、表头、数据行、表头到首行间距、行间距、响应式列间距／横向内边距、箭头列、目录插画槽和正负数值色；业务列表只补充列模板与业务单元格内容 |',
)
replace_once(
    ui,
    '玩家端 `PageLayout` 的标题区固定只包含返回、主标题和关闭三个槽位，不得渲染刷新、创建、筛选、保存或其他业务按钮；业务操作必须进入正文中的对应业务模块或正文顶部操作区。',
    '所有带表头的页面实体目录固定使用 `.entity-list-surface` 包裹 `EntityListHeader + .entity-list-rows`。表头与首行、相邻数据行统一使用同一 `.32rem` 间距；列 gap、横向 padding、Chevron 轨道和目录插画槽只能由 `entity-list-header.css` 的共享变量随真实内容容器收缩，业务 CSS 只允许定义字段列模板和业务单元格内部排版，不得为市场、地区商品、建筑或地区建筑各自维护另一套列表密度。正负行情与利润统一通过 `.entity-list-value.is-positive / .is-negative` 表达，避免同一语义跨页面变色。\n\n玩家端 `PageLayout` 的标题区固定只包含返回、主标题和关闭三个槽位，不得渲染刷新、创建、筛选、保存或其他业务按钮；业务操作必须进入正文中的对应业务模块或正文顶部操作区。',
)

verifier = 'scripts/verify-page-content.mjs'
replace_once(
    verifier,
    "for (const text of [\n  '玩家端 `PageLayout` 的标题区固定只包含返回、主标题和关闭三个槽位',\n  '`PageLayout.actions` 只允许非玩家页面继续使用',\n]) requireText('docs/UI_DESIGN_SYSTEM.md', text);",
    "for (const text of [\n  '玩家端 `PageLayout` 的标题区固定只包含返回、主标题和关闭三个槽位',\n  '`PageLayout.actions` 只允许非玩家页面继续使用',\n  '所有带表头的页面实体目录固定使用 `.entity-list-surface` 包裹 `EntityListHeader + .entity-list-rows`',\n  '表头与首行、相邻数据行统一使用同一 `.32rem` 间距',\n  '正负行情与利润统一通过 `.entity-list-value.is-positive / .is-negative` 表达',\n]) requireText('docs/UI_DESIGN_SYSTEM.md', text);",
)
replace_once(
    verifier,
    "for (const text of ['.entity-list-header', 'border-bottom: 1px solid var(--color-divider);']) {\n  requireText('src/styles/entity-list-header.css', text);\n}",
    "for (const text of [\n  '.entity-list-surface {',\n  '.entity-list-rows {',\n  '--entity-list-chevron-column: .8rem;',\n  '--entity-list-artwork-slot: 42px;',\n  '--entity-list-artwork-size: 34px;',\n  'gap: .32rem;',\n  '.entity-list-value.is-positive {',\n  '.entity-list-value.is-negative {',\n  'border-bottom: 1px solid var(--color-divider);',\n]) requireText('src/styles/entity-list-header.css', text);\nfor (const text of [\n  'className=\"entity-list-surface global-market-goods-surface\"',\n  'className=\"entity-list-rows global-market-goods-list\"',\n  'className=\"entity-list-surface global-market-product-region-surface\"',\n  'className=\"entity-list-rows global-market-product-region-list\"',\n  'entity-list-value',\n]) requireText('src/pages/GlobalMarketPage.tsx', text);\nfor (const text of [\n  'className=\"entity-list-surface global-facility-catalog\"',\n  'className=\"entity-list-rows global-facility-catalog-list\"',\n  'className=\"entity-list-surface global-facility-region-surface\"',\n  'className=\"entity-list-rows global-facility-region-list\"',\n  'entity-list-value',\n]) requireText('src/pages/GlobalBuildingsPage.tsx', text);\nforbidText('src/styles/global-operation-pages.css', '--entity-list-gap:');\nforbidText('src/styles/global-operation-pages.css', '--entity-list-inline-padding:');\nforbidText('src/styles/global-operation-pages.css', '@container global-market-page (max-width: 760px)');\nforbidText('src/styles/global-operation-pages.css', '.global-facility-catalog-row__profit.is-positive');\nforbidText('src/styles/market-commodity-row.css', '.market-commodity-row__trend.is-positive strong');",
)

test = 'tests/browser/all-pages-preview.spec.ts'
marker = "test('player page heading keeps SVG back, centered title, and SVG close in that order', async ({ page }) => {"
addition = r'''test('market and building entity lists share one page-list geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');

  const inspect = async (selector: string) => {
    const surface = page.locator(selector);
    await expect(surface).toBeVisible();
    await expect(surface.locator(':scope > .entity-list-header')).toBeVisible();
    await expect(surface.locator(':scope > .entity-list-rows .entity-list-row').first()).toBeVisible();
    return surface.evaluate((element) => {
      const header = element.querySelector<HTMLElement>(':scope > .entity-list-header');
      const rows = element.querySelector<HTMLElement>(':scope > .entity-list-rows');
      const row = rows?.querySelector<HTMLElement>('.entity-list-row');
      const primary = row?.querySelector<HTMLElement>('strong');
      const chevron = row?.lastElementChild as HTMLElement | null;
      if (!header || !rows || !row || !primary || !chevron) throw new Error('entity list fixture is incomplete');
      const surfaceStyle = getComputedStyle(element);
      const rowsStyle = getComputedStyle(rows);
      const rowStyle = getComputedStyle(row);
      const headerBox = header.getBoundingClientRect();
      const rowsBox = rows.getBoundingClientRect();
      return {
        surfaceGap: surfaceStyle.rowGap,
        rowsGap: rowsStyle.rowGap,
        headerToRows: Math.round((rowsBox.top - headerBox.bottom) * 100) / 100,
        columnGap: rowStyle.columnGap,
        paddingLeft: rowStyle.paddingLeft,
        paddingRight: rowStyle.paddingRight,
        paddingTop: rowStyle.paddingTop,
        paddingBottom: rowStyle.paddingBottom,
        borderRadius: rowStyle.borderRadius,
        minHeight: rowStyle.minHeight,
        fontSize: getComputedStyle(primary).fontSize,
        chevronColumn: rowStyle.getPropertyValue('--entity-list-chevron-column').trim(),
        chevronWidth: Math.round(chevron.getBoundingClientRect().width * 100) / 100,
      };
    });
  };

  await sidebar.getByRole('button', { name: /^市场/ }).click();
  const samples = [await inspect('.global-market-goods-surface')];
  const marketArtworkSize = await page.locator('.global-market-goods-row__artwork > .product-artwork').first().evaluate(
    (element) => getComputedStyle(element).width,
  );
  await page.locator('.global-market-goods-row').first().click();
  samples.push(await inspect('.global-market-product-region-surface'));

  await sidebar.getByRole('button', { name: /^建筑/ }).click();
  samples.push(await inspect('.global-facility-catalog'));
  const facilityArtworkSize = await page.locator('.global-facility-catalog-row__artwork').first().evaluate(
    (element) => getComputedStyle(element).width,
  );
  expect(facilityArtworkSize).toBe(marketArtworkSize);
  await page.locator('.global-facility-catalog-row').first().click();
  samples.push(await inspect('.global-facility-region-surface'));

  for (const key of Object.keys(samples[0]) as Array<keyof typeof samples[number]>) {
    expect(new Set(samples.map((sample) => String(sample[key]))).size, `${key} should be shared`).toBe(1);
  }
});

'''
replace_once(test, marker, addition + marker)
