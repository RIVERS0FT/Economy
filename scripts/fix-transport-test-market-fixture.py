from pathlib import Path

path = Path('server/test/transport.test.js')
text = path.read_text(encoding='utf-8')
old = '''function setReferencePrice(world, provinceId, productId, price) {\n  const market = world.markets[provinceScopedKey(provinceId, productId)];\n  market.lastTradePrice = price;\n  market.lastPrice = price;\n  market.officialPrice = null;\n}\n'''
new = '''function testMarketFor(world, provinceId, productId) {\n  const key = provinceScopedKey(provinceId, productId);\n  if (!world.markets[key]) {\n    const template = world.markets[provinceScopedKey('110000', productId)]\n      || Object.values(world.markets).find((market) => market?.productId === productId);\n    assert.ok(template, `missing market fixture for ${productId}`);\n    world.markets[key] = structuredClone(template);\n    world.markets[key].provinceId = provinceId;\n    world.markets[key].productId = productId;\n  }\n  return world.markets[key];\n}\n\nfunction setReferencePrice(world, provinceId, productId, price) {\n  const market = testMarketFor(world, provinceId, productId);\n  market.lastTradePrice = price;\n  market.lastPrice = price;\n  market.officialPrice = null;\n}\n'''
if text.count(old) != 1:
    raise SystemExit(f'expected one setReferencePrice helper, got {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('transport test market fixture aligned')
