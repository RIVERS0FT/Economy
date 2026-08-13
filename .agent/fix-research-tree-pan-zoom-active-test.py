from pathlib import Path
path = Path('.agent/apply-research-tree-pan-zoom.py')
text = path.read_text(encoding='utf-8')
marker = "test = test.replace(\"await page.getByRole('button', { name: /家电工程，尚未开放/ }).click();\", \"await page.getByRole('button', { name: /家电工程，尚未开放/ }).press('Enter');\")\\n"
addition = "test = test.replace(\"await page.getByRole('button', { name: /冶金技术，研发中/ }).click();\", \"await page.getByRole('button', { name: /冶金技术，研发中/ }).press('Enter');\")\\n"
if text.count(marker) != 1:
    raise SystemExit(f'expected one active test insertion marker, found {text.count(marker)}')
path.write_text(text.replace(marker, marker + addition, 1), encoding='utf-8')
print('active research viewport test patch fixed')
