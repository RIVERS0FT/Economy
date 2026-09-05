"""Branch-only diagnostic preparation; removed before the final PR."""
from pathlib import Path
path = Path('tests/browser/market-pointer-interaction.spec.ts')
s = path.read_text()
old = "        viewport: { width: innerWidth, height: innerHeight },"
new = """        viewport: { width: innerWidth, height: innerHeight },
        coordinateNodes: [host, ...Array.from(document.querySelectorAll('.market-history-chart, .economy-chart, .economy-chart__canvas, .economy-chart__canvas > div'))].map((parent) => ({
          tag: parent.tagName, cls: parent.className,
          rect: parent.getBoundingClientRect().toJSON(), style: (parent as HTMLElement).style.cssText,
          offsetTop: (parent as HTMLElement).offsetTop, offsetParent: (parent as HTMLElement).offsetParent?.className,
          children: Array.from(parent.children).filter((child) => child.tagName === 'DIV').map((child) => ({
            cls: child.className, rect: child.getBoundingClientRect().toJSON(), style: (child as HTMLElement).style.cssText,
            offsetLeft: (child as HTMLElement).offsetLeft, offsetTop: (child as HTMLElement).offsetTop,
            offsetParent: (child as HTMLElement).offsetParent?.className,
          })),
        })),"""
if new not in s:
    assert s.count(old) == 1
    path.write_text(s.replace(old, new, 1))
