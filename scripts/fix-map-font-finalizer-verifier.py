#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/verify-province-map-focus.mjs')
text = path.read_text(encoding='utf-8')
old = """requireText(
  uiDesignSource,
  '不得恢复 Playfair Display／Georgia',
  'authoritative UI design must prohibit restoring the retired Playfair/Georgia map font stack',
);"""
new = """requireText(
  uiDesignSource,
  '不得把完整 CJK 字体打入网页包',
  'authoritative UI design must prohibit bundling the complete CJK font',
);"""
if text.count(old) != 1:
    raise SystemExit(f'expected one retired Playfair design verifier target, found {text.count(old)}')
path.write_text(text.replace(old, new), encoding='utf-8')
