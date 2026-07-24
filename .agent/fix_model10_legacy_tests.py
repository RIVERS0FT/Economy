from pathlib import Path

path = Path('server/test/market-liquidity.test.js')
content = path.read_text()
content = content.replace('market model 9 creates inventory-backed buy and sell orders without system self-trades',
                          'market model 10 creates inventory-backed buy and sell orders without system self-trades')
content = content.replace('model 3 migrates directly to model 9 with one-time reserve seeding',
                          'model 3 migrates directly to model 10 with one-time reserve seeding')
content = content.replace('model 5 migrates to model 9 and releases obsolete liquidity reservations',
                          'model 5 migrates to model 10 and releases obsolete liquidity reservations')
content = content.replace('assert.equal(world.marketDemand.modelVersion, 9);',
                          'assert.equal(world.marketDemand.modelVersion, 10);')
path.write_text(content)

verify_path = Path('scripts/verify-staple-crops-demand.mjs')
verify = verify_path.read_text()
verify = verify.replace("'未满足需求报价锚点'", "'双向报价锚点'")
verify_path.write_text(verify)
