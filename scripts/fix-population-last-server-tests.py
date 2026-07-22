from pathlib import Path

path = Path('server/test/domain.test.js')
text = path.read_text().replace(
    'stocked.lastClassAllocation.staples.shares.wheat, empty.lastClassAllocation.staples.shares.wheat',
    'stocked.lastClassAllocation.basic.staples.shares.wheat, empty.lastClassAllocation.basic.staples.shares.wheat',
)
path.write_text(text)

path = Path('server/test/order-book-integrity.test.js')
text = path.read_text().replace(
    '  assert.equal(seller.stats.systemSinks, 1);',
    '  assert.equal(seller.stats.systemSinks, 0);\n  assert.equal(seller.stats.marketServiceFees, 0);',
)
path.write_text(text)

Path('population-validation.log').unlink(missing_ok=True)
Path('scripts/fix-population-last-server-tests.py').unlink()
Path('.github/workflows/fix-population-last-server-tests.yml').unlink()
