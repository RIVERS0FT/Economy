from pathlib import Path

path = Path('.agent/apply-research-tree-pan-zoom.py')
text = path.read_text(encoding='utf-8')
old = '''old_forbid = "for (const forbidden of [\\n  'grid-template-columns: repeat(7',\\n  '.research-stage-node',\\n]) forbidText('src/styles/research-page.css', forbidden);"\nnew_forbid = "for (const forbidden of [\\n  'grid-template-columns: repeat(7',\\n  '.research-stage-node',\\n  '.research-tree-scroll',\\n  '.research-tree-connections--mobile',\\n  '--research-node-mobile-x',\\n  '--research-node-desktop-x',\\n]) forbidText('src/styles/research-page.css', forbidden);\\nfor (const forbidden of [\\n  'MOBILE_COLUMNS',\\n  'mobileXPercent',\\n  'mobileY',\\n  'mobilePath',\\n  'desktopX',\\n  'desktopPath',\\n]) forbidText('src/research/researchTreeLayout.ts', forbidden);\\nfor (const forbidden of [\\n  'research-tree-connections--mobile',\\n  'research-tree-connections--desktop',\\n]) forbidText('src/pages/ResearchPage.tsx', forbidden);"'''
new = '''old_forbid = "for (const forbidden of [\\n  'grid-template-columns: repeat(7',\\n  '.research-stage-node',\\n  'var(--color-accent)',\\n  'transform: translate(-50%, -50%)',\\n]) forbidText('src/styles/research-page.css', forbidden);"\nnew_forbid = "for (const forbidden of [\\n  'grid-template-columns: repeat(7',\\n  '.research-stage-node',\\n  'var(--color-accent)',\\n  'transform: translate(-50%, -50%)',\\n  '.research-tree-scroll',\\n  '.research-tree-connections--mobile',\\n  '--research-node-mobile-x',\\n  '--research-node-desktop-x',\\n]) forbidText('src/styles/research-page.css', forbidden);\\nfor (const forbidden of [\\n  'MOBILE_COLUMNS',\\n  'mobileXPercent',\\n  'mobileY',\\n  'mobilePath',\\n  'desktopX',\\n  'desktopPath',\\n]) forbidText('src/research/researchTreeLayout.ts', forbidden);\\nfor (const forbidden of [\\n  'research-tree-connections--mobile',\\n  'research-tree-connections--desktop',\\n]) forbidText('src/pages/ResearchPage.tsx', forbidden);"'''
if text.count(old) != 1:
    raise SystemExit(f'expected one verifier patch definition, found {text.count(old)}')
text = text.replace(old, new, 1)
needle = "verifier = read(verifier_path)\n"
insert = '''verifier = verifier.replace("  'research-tree-connections--desktop',\\n  'research-tree-connections--mobile',\\n", "  'ResearchTreeViewport',\\n  'className=\\\"research-tree-connections\\\"',\\n", 1)\nverifier = verifier.replace("  'keeps every mobile dependency below its prerequisite without horizontal tree scrolling',\\n", '', 1)\n'''
if text.count(needle) != 1:
    raise SystemExit(f'expected one verifier read marker, found {text.count(needle)}')
text = text.replace(needle, needle + insert, 1)
path.write_text(text, encoding='utf-8')
print('pan zoom apply script verifier markers fixed')
