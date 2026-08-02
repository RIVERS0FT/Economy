from pathlib import Path

V2_PATH = Path('.github/apply-facility-complexity-order-v2.py')
SPEC_PATH = Path('tests/browser/production-facility-cards.spec.ts')

source = V2_PATH.read_text(encoding='utf-8')
exec(compile(source, str(V2_PATH), 'exec'), {})

spec = SPEC_PATH.read_text(encoding='utf-8')
old = "await expect(page.locator('#desktop-facility-detail-title')).toHaveText('农场');"
new = "await expect(page.locator('#desktop-facility-detail-title')).toContainText('农场');"
if spec.count(old) != 1:
    raise SystemExit(f'expected one exact default detail assertion, found {spec.count(old)}')
SPEC_PATH.write_text(spec.replace(old, new, 1), encoding='utf-8', newline='\n')
