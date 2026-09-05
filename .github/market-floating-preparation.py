"""Branch-only fixture corrections; removed before final PR validation."""
from pathlib import Path

for name in ['commodity-freeze-details.spec.ts', 'market-pointer-interaction.spec.ts']:
    path = Path('tests/browser') / name
    source = path.read_text()
    source = source.replace("page.goto('/market-runtime-test.html", "page.goto('market-runtime-test.html")
    source = source.replace('page.goto(`/market-runtime-test.html', 'page.goto(`market-runtime-test.html')
    source = source.replace("import('/src/components/charts/echartsCore.ts')", "import('/economy/src/components/charts/echartsCore.ts')")
    path.write_text(source)
print('New browser regressions use the configured /economy/ base URL.')
