from pathlib import Path

path = Path('scripts/verify-page-content.mjs')
text = path.read_text()
replacements = {
    "    'className=\"global-facility-catalog\"',": "    'className=\"entity-list-surface global-facility-catalog\"',",
    "    'className=\"global-facility-catalog-list\"',": "    'className=\"entity-list-rows global-facility-catalog-list\"',",
    "    'className=\"global-facility-region-list\"',": "    'className=\"entity-list-rows global-facility-region-list\"',",
    "    'className={`global-facility-region-row__profit is-${row.profitTone}`}',": "    'className={`entity-list-value global-facility-region-row__profit is-${row.profitTone}`}',",
}
for old, new in replacements.items():
    if text.count(old) != 1:
        raise SystemExit(f'expected one verifier match: {old}')
    text = text.replace(old, new, 1)
old_block = """for (const text of [
  '.global-facility-catalog-header,',
  '.global-facility-region-header {',
  '.global-facility-catalog-list,',
  '.global-facility-region-list {',
  '.global-facility-catalog-row,',
  '.global-facility-region-row {',
  '.global-facility-catalog-row__artwork {',
  '--entity-list-columns: minmax(0, 1.6fr) minmax(7rem, .8fr) minmax(4rem, .45fr) 1rem;',
  '--entity-list-columns: minmax(0, 1.45fr) minmax(6rem, .7fr) minmax(3.5rem, .42fr) minmax(4.5rem, .55fr) 1rem;',
  'aspect-ratio: 1;',
  '.global-facility-catalog-row__profit.is-positive,',
  '.global-facility-region-row__profit.is-positive {',
  '.global-facility-region-row__profit.is-negative {',
  '@container (max-width: 620px)',
  '@container (max-width: 360px)',
]) requireText('src/styles/global-operation-pages.css', text);"""
new_block = """for (const text of [
  '.global-facility-catalog-header {',
  '.global-facility-region-header {',
  '.global-facility-catalog-row,',
  '.global-facility-region-row {',
  '.global-facility-catalog-row__artwork {',
  '--entity-list-columns: minmax(0, 1.6fr) minmax(7rem, .8fr) minmax(4rem, .45fr) var(--entity-list-chevron-column);',
  '--entity-list-columns: minmax(0, 1.45fr) minmax(6rem, .7fr) minmax(3.5rem, .42fr) minmax(4.5rem, .55fr) var(--entity-list-chevron-column);',
  'grid-template-columns: var(--entity-list-artwork-slot) minmax(0, 1fr);',
  'width: var(--entity-list-artwork-size);',
  'aspect-ratio: 1;',
  '@container (max-width: 620px)',
  '@container (max-width: 360px)',
]) requireText('src/styles/global-operation-pages.css', text);"""
if text.count(old_block) != 1:
    raise SystemExit('expected old facility CSS verifier block once')
text = text.replace(old_block, new_block, 1)
text = text.replace(
    "console.log('页面内容与职责验证通过：一级市场/建筑锁定全局视图；一级建筑只保留工厂目录，工厂列表使用统一表头、单行可点击条目和正方形插画，地区工厂列表增加州级单厂利润并按工厂类型 → 地区 → 现有地区工厂详情下钻；市场列表保留独立表头与共享方向 Chevron；所有玩家 PageLayout 共用 40px 标题轨道与紧凑单行标题；州级上下文继续复用本地市场/建筑，邀请卡与礼品码兑换唯一归属商店，地图保留 0.5–4 手势缩放并禁止恢复独立缩放功能面板。');",
    "console.log('页面内容与职责验证通过：一级市场/建筑锁定全局视图；市场、地区商品、建筑和地区建筑目录共用统一页面实体列表表面、间距、Chevron、目录插画槽和正负数值色；一级建筑按工厂类型 → 地区 → 现有地区工厂详情下钻；所有玩家 PageLayout 共用 40px 标题轨道与紧凑单行标题；州级上下文继续复用本地市场/建筑，邀请卡与礼品码兑换唯一归属商店，地图保留 0.5–4 手势缩放并禁止恢复独立缩放功能面板。');",
)
path.write_text(text)
