from pathlib import Path

path = Path('server/test/market-liquidity.test.js')
content = path.read_text()
content = content.replace('model 3 migrates directly to model 9 with one-time reserve seeding',
                          'model 3 migrates directly to model 10 with one-time reserve seeding')
content = content.replace('model 5 migrates to model 9 and releases obsolete liquidity reservations',
                          'model 5 migrates to model 10 and releases obsolete liquidity reservations')
content = content.replace('assert.equal(world.marketDemand.modelVersion, 9);',
                          'assert.equal(world.marketDemand.modelVersion, 10);')
path.write_text(content)
