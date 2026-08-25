from pathlib import Path

path = Path('scripts/verify-market-page-layout-base.mjs')
source = path.read_text(encoding='utf-8')
old = "requireText(marketPage, '<WidgetHeading title=\"生产者与消费者\" />', '地区商品详情必须展示生产者与消费者。');"
new = """requireText(marketPage, '<WidgetHeading title=\"库存与生产\" />', '地区商品详情必须展示库存与生产。');
requireText(marketPage, 'market-inventory-production-card', '地区商品详情库存与生产必须使用独立信息卡。');
requireText(marketPage, 'productionSummary.unitsPerMinute', '地区商品详情必须展示预计生产速度。');
requireText(marketPage, 'currentFormulaScope(group, now)', '预计生产速度必须复用共享等效产能投影。');
forbidText(marketPage, '生产者与消费者', '地区商品详情不得恢复生产者与消费者关系卡。');"""
if old not in source:
    raise SystemExit('stale producer/consumer verifier token not found')
source = source.replace(old, new, 1)
old_console = "console.log('市场页验证通过：地区目录默认折叠且无搜索，商品行仅保留卖单量、买单量、市场价和 24h 变化；详情继续承载基本面、订单簿、下单和自动交易。');"
new_console = "console.log('市场页验证通过：地区目录默认折叠且无搜索，商品行保留核心行情；详情承载基本面、库存与生产、订单簿、下单和自动交易。');"
if old_console not in source:
    raise SystemExit('market verifier success message anchor missing')
source = source.replace(old_console, new_console, 1)
path.write_text(source, encoding='utf-8')
