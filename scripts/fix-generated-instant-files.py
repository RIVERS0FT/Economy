#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/verify-gem-shop.mjs')
text = path.read_text(encoding='utf-8')
start = text.index('if (failures.length) {')
end = text.index("console.log('商店验证通过", start)
text = text[:start] + '''if (failures.length) {
  console.error(`商店与宝石验证失败:\\n- ${failures.join('\\n- ')}`);
  process.exit(1);
}
''' + text[end:]
path.write_text(text, encoding='utf-8')
print('generated instant files fixed')
