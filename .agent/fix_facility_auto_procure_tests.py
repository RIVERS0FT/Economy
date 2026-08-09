from pathlib import Path

path = Path('server/test/instant-facility-construction.test.js')
source = path.read_text(encoding='utf-8')
replacements = {
    "placeMaterialSell(store, 'timber', 3, 6, 'material-sell-0001'": "placeMaterialSell(store, 'timber', 3, 60, 'material-sell-0001'",
    "placeMaterialSell(store, 'ore', 2, 7, 'material-sell-0002'": "placeMaterialSell(store, 'ore', 2, 70, 'material-sell-0002'",
    'maxProcurementTotal: 32,\n        materialPriceCaps: { timber: 6, ore: 7 },': 'maxProcurementTotal: 320,\n        materialPriceCaps: { timber: 60, ore: 70 },',
    'before.credits - ranch.buildCost - 32': 'before.credits - ranch.buildCost - 320',
    'after.markets.timber.lastTradePrice, 6': 'after.markets.timber.lastTradePrice, 60',
    'after.markets.ore.lastTradePrice, 7': 'after.markets.ore.lastTradePrice, 70',
    "placeMaterialSell(store, 'timber', 2, 6, 'material-sell-0011'": "placeMaterialSell(store, 'timber', 2, 60, 'material-sell-0011'",
    "placeMaterialSell(store, 'ore', 2, 7, 'material-sell-0012'": "placeMaterialSell(store, 'ore', 2, 70, 'material-sell-0012'",
    'maxProcurementTotal: 100, materialPriceCaps: { timber: 10, ore: 10 },': 'maxProcurementTotal: 1_000, materialPriceCaps: { timber: 100, ore: 100 },',
    "placeMaterialSell(store, 'timber', 3, 6, 'material-sell-0021'": "placeMaterialSell(store, 'timber', 3, 60, 'material-sell-0021'",
    "placeMaterialSell(store, 'ore', 2, 7, 'material-sell-0022'": "placeMaterialSell(store, 'ore', 2, 70, 'material-sell-0022'",
    'maxProcurementTotal: 32, materialPriceCaps: { timber: 5.99, ore: 7 },': 'maxProcurementTotal: 320, materialPriceCaps: { timber: 59.99, ore: 70 },',
    "placeMaterialSell(store, 'timber', 3, 6, 'material-sell-0031'": "placeMaterialSell(store, 'timber', 3, 60, 'material-sell-0031'",
    "placeMaterialSell(store, 'ore', 2, 7, 'material-sell-0032'": "placeMaterialSell(store, 'ore', 2, 70, 'material-sell-0032'",
    'maxProcurementTotal: 32, materialPriceCaps: { timber: 6, ore: 7 },': 'maxProcurementTotal: 320, materialPriceCaps: { timber: 60, ore: 70 },',
}
for old, new in replacements.items():
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'expected one match, got {count}: {old!r}')
    source = source.replace(old, new, 1)
path.write_text(source, encoding='utf-8')
print('facility procurement test prices hardened')
