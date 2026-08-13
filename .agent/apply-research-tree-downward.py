from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def replace_regex_once(text, pattern, replacement, label):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one regex match, found {count}')
    return updated


# ResearchPage: import deterministic DAG layout helpers.
path = Path('src/pages/ResearchPage.tsx')
text = read(path)
text = replace_once(
    text,
    "import { useStableSelection } from '../hooks/useStableSelection';\n",
    "import { useStableSelection } from '../hooks/useStableSelection';\nimport { buildResearchTreeFocus, buildResearchTreeLayout } from '../research/researchTreeLayout';\n",
    'ResearchPage layout import',
)
selection_anchor = """  const selectedTechnology = technologiesById.get(selectedTechnologyId)
    ?? (activeTechnology?.id === selectedTechnologyId ? activeTechnology : null)
    ?? technologiesById.get(fallbackTechnologyId)
    ?? (activeTechnology?.id === fallbackTechnologyId ? activeTechnology : null)
    ?? technologies[0];
  const selectedFacilities = selectedTechnology
"""
selection_replacement = """  const selectedTechnology = technologiesById.get(selectedTechnologyId)
    ?? (activeTechnology?.id === selectedTechnologyId ? activeTechnology : null)
    ?? technologiesById.get(fallbackTechnologyId)
    ?? (activeTechnology?.id === fallbackTechnologyId ? activeTechnology : null)
    ?? technologies[0];
  const researchTreeLayout = useMemo(
    () => buildResearchTreeLayout(technologies),
    [technologies],
  );
  const researchTreeFocus = useMemo(
    () => buildResearchTreeFocus(technologies, selectedTechnology?.id ?? ''),
    [selectedTechnology?.id, technologies],
  );
  const selectedFacilities = selectedTechnology
"""
text = replace_once(text, selection_anchor, selection_replacement, 'ResearchPage tree layout memo')

start = text.index('          <div className="research-tree-scroll">')
end_marker = '          </div>\n        </PagePanel>'
end = text.index(end_marker, start) + len('          </div>')
new_tree = r'''          <div className="research-tree-scroll">
            <div
              className="research-tree"
              role="tree"
              aria-label="产业科技树"
              data-layout-direction="downward"
              style={{
                '--research-tree-desktop-width': `${researchTreeLayout.desktopWidth}px`,
                '--research-tree-desktop-height': `${researchTreeLayout.desktopHeight}px`,
                '--research-tree-mobile-height': `${researchTreeLayout.mobileHeight}px`,
              } as CSSProperties}
            >
              <svg
                className="research-tree-connections research-tree-connections--desktop"
                viewBox={`0 0 ${researchTreeLayout.desktopWidth} ${researchTreeLayout.desktopHeight}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {researchTreeLayout.edges.map((edge) => (
                  <path
                    className="research-tree-edge"
                    data-highlighted={researchTreeFocus.upstreamEdgeKeys.has(edge.key) || undefined}
                    data-related={researchTreeFocus.downstreamEdgeKeys.has(edge.key) || undefined}
                    d={edge.desktopPath}
                    key={`desktop:${edge.key}`}
                  />
                ))}
              </svg>
              <svg
                className="research-tree-connections research-tree-connections--mobile"
                viewBox={`0 0 1000 ${researchTreeLayout.mobileHeight}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {researchTreeLayout.edges.map((edge) => (
                  <path
                    className="research-tree-edge"
                    data-highlighted={researchTreeFocus.upstreamEdgeKeys.has(edge.key) || undefined}
                    data-related={researchTreeFocus.downstreamEdgeKeys.has(edge.key) || undefined}
                    d={edge.mobilePath}
                    key={`mobile:${edge.key}`}
                  />
                ))}
              </svg>
              {researchTreeLayout.nodes.map((layoutNode) => {
                const technology = technologiesById.get(layoutNode.id);
                if (!technology) return null;
                const status = statusFor(technology, completed, technologiesById, active?.technologyId);
                const isSelected = selectedTechnology.id === technology.id;
                const progress = progressForResearchTechnology(
                  technology,
                  active,
                  now,
                  status === 'mastered',
                );
                const facility = technology.unlockFacilityTypeIds
                  .map((facilityTypeId) => facilitiesById.get(facilityTypeId))
                  .find(Boolean);
                const operationProductId = technology.kind === 'operation' ? technology.operationProductIds?.[0] : undefined;
                const isAncestor = researchTreeFocus.ancestorIds.has(technology.id);
                const isDirectChild = researchTreeFocus.directChildIds.has(technology.id);
                const nodeStyle = {
                  '--research-node-progress': `${Math.round(progress * 360)}deg`,
                  '--research-node-desktop-x': `${layoutNode.desktopX}px`,
                  '--research-node-desktop-y': `${layoutNode.desktopY}px`,
                  '--research-node-mobile-x': `${layoutNode.mobileXPercent}%`,
                  '--research-node-mobile-y': `${layoutNode.mobileY}px`,
                } as CSSProperties;
                return (
                  <button
                    type="button"
                    className="research-facility-node research-technology-node"
                    data-technology-id={technology.id}
                    data-depth={layoutNode.depth}
                    data-prerequisites={technology.prerequisiteTechnologyIds.join(',')}
                    data-status={status}
                    data-selected={isSelected || undefined}
                    data-path={isAncestor ? 'ancestor' : isDirectChild ? 'descendant' : undefined}
                    style={nodeStyle}
                    key={technology.id}
                    role="treeitem"
                    aria-level={layoutNode.depth + 1}
                    aria-pressed={isSelected}
                    aria-label={`${technology.name}，${statusLabels[status]}，${technology.stage} ${technology.kind === 'operation' ? '作业科技' : '生产科技'}`}
                    onClick={(event) => selectTechnology(technology.id, event.currentTarget)}
                  >
                    <span className="research-facility-artwork" aria-hidden="true">
                      {operationProductId
                        ? <ProductArtwork productId={operationProductId} />
                        : facility ? <FacilityIcon facilityTypeId={facility.id} /> : <span>{technology.stage}</span>}
                    </span>
                    <span className="research-technology-node-name">{technology.name}</span>
                    <small className="research-technology-node-meta">
                      {technology.stage} · {technology.kind === 'operation' ? '作业科技' : '生产科技'}
                    </small>
                    <small className="research-technology-node-status">{statusLabels[status]}</small>
                  </button>
                );
              })}
            </div>
          </div>'''
text = text[:start] + new_tree + text[end:]
write(path, text)

# CSS: replace the old seven-column stage tree with an absolute downward DAG.
path = Path('src/styles/research-page.css')
text = read(path)
new_tree_css = r'''.research-tree-scroll {
  min-width: 0;
  overflow-x: auto;
  overflow-y: visible;
  overscroll-behavior-x: contain;
  padding: var(--space-2) var(--space-1) var(--space-4);
}

.research-tree {
  --research-trunk-color: color-mix(in srgb, var(--color-border-strong) 78%, transparent);
  position: relative;
  min-width: var(--research-tree-desktop-width);
  width: var(--research-tree-desktop-width);
  height: var(--research-tree-desktop-height);
  margin-inline: auto;
}

.research-tree-connections {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.research-tree-connections--mobile {
  display: none;
}

.research-tree-edge {
  fill: none;
  stroke: var(--research-trunk-color);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  opacity: 0.5;
  transition: opacity 160ms ease, stroke 160ms ease, stroke-width 160ms ease;
}

.research-tree-edge[data-highlighted='true'] {
  stroke: var(--color-accent);
  stroke-width: 3;
  opacity: 0.95;
}

.research-tree-edge[data-related='true'] {
  stroke: color-mix(in srgb, var(--color-accent) 62%, var(--color-border-strong));
  opacity: 0.76;
}

.research-facility-node {
  min-width: 0;
  color: var(--color-text-secondary);
  font: inherit;
  cursor: pointer;
}

.research-technology-node {
  --research-node-color: var(--color-text-muted);
  --research-node-soft: color-mix(in srgb, var(--color-text-muted) 10%, var(--color-surface-inset));
  position: absolute;
  z-index: 1;
  left: var(--research-node-desktop-x);
  top: var(--research-node-desktop-y);
  width: 7.5rem;
  min-height: 7rem;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 0.16rem;
  border: 0;
  padding: 0.25rem;
  transform: translate(-50%, -50%);
  color: var(--color-text-secondary);
  background: transparent;
  text-align: center;
}

.research-technology-node[data-status='mastered'] {
  --research-node-color: var(--color-success);
  --research-node-soft: var(--color-success-soft);
}

.research-technology-node[data-status='active'] {
  --research-node-color: var(--color-info);
  --research-node-soft: var(--color-info-soft);
}

.research-technology-node[data-status='available'] {
  --research-node-color: var(--color-warning);
  --research-node-soft: var(--color-warning-soft);
}

.research-technology-node[data-status='locked'] {
  opacity: 0.62;
}

.research-technology-node[data-path='ancestor'],
.research-technology-node[data-path='descendant'] {
  opacity: 1;
}

.research-facility-node:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 4px;
  border-radius: var(--radius-control);
}

.research-facility-artwork {
  position: relative;
  width: 3.35rem;
  height: 3.35rem;
  display: grid;
  place-items: center;
  overflow: visible;
  border: 2px solid color-mix(in srgb, var(--research-node-color) 62%, var(--color-border));
  border-radius: 50%;
  background: var(--research-node-soft);
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease, filter 160ms ease;
}

.research-facility-artwork::after {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  background: conic-gradient(
    var(--color-info) var(--research-node-progress, 0deg),
    color-mix(in srgb, var(--color-border-strong) 72%, transparent) 0deg
  );
  opacity: 0;
  pointer-events: none;
  -webkit-mask: radial-gradient(circle, transparent 0 63%, #000 65% 100%);
  mask: radial-gradient(circle, transparent 0 63%, #000 65% 100%);
}

.research-technology-node[data-status='active'] .research-facility-artwork::after {
  opacity: 1;
}

.research-technology-node[data-selected='true'] .research-facility-artwork {
  box-shadow:
    0 0 0 2px var(--color-surface),
    0 0 0 5px var(--color-accent);
}

.research-technology-node[data-path='ancestor'] .research-facility-artwork {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 48%, transparent);
}

.research-technology-node[data-path='descendant'] .research-facility-artwork {
  border-style: dashed;
}

.research-facility-node:active .research-facility-artwork {
  transform: scale(0.96);
}

.research-facility-artwork .facility-icon,
.research-detail-level-artwork .facility-icon,
.research-unlock-artwork .facility-icon {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background-image: var(--facility-artwork-image, none);
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  stroke: transparent;
}

.research-facility-artwork > .product-artwork {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}

.research-technology-node[data-status='locked'] .research-facility-artwork {
  filter: grayscale(1) brightness(0.62);
}

.research-technology-node-name {
  max-width: 100%;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.research-technology-node-meta,
.research-technology-node-status {
  max-width: 100%;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 0.66rem;
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.research-technology-node-status {
  color: var(--research-node-color);
  font-weight: 700;
}

'''
text = replace_regex_once(
    text,
    r"\.research-tree-scroll \{.*?(?=\.research-detail-content,)",
    new_tree_css,
    'desktop research tree css',
)

mobile_tree_css = r'''  .research-tree-scroll {
    overflow-x: visible;
    padding: var(--space-1) 0 var(--space-3);
  }

  .research-tree {
    min-width: 0;
    width: 100%;
    height: var(--research-tree-mobile-height);
    margin-inline: 0;
  }

  .research-tree-connections--desktop {
    display: none;
  }

  .research-tree-connections--mobile {
    display: block;
  }

  .research-technology-node {
    left: var(--research-node-mobile-x);
    top: var(--research-node-mobile-y);
    width: min(8.5rem, calc(50% - var(--space-2)));
    min-height: 6.5rem;
    padding-inline: 0.15rem;
  }

  .research-facility-artwork {
    width: 3rem;
    height: 3rem;
  }

  .research-technology-node-name {
    font-size: 0.7rem;
  }

  .research-technology-node-meta,
  .research-technology-node-status {
    font-size: 0.63rem;
  }

'''
text = replace_regex_once(
    text,
    r"  \.research-tree-scroll \{.*?  \.research-facility-artwork \{\n    width: 3rem;\n    height: 3rem;\n  \}\n\n(?=  \.mobile-detail-sheet \.research-detail-content)",
    mobile_tree_css,
    'mobile research tree css',
)
text = replace_regex_once(
    text,
    r"/\* Split technology nodes: C1-C7 remain visual stages while access belongs to each node\. \*/.*?(?=\.research-industry-context \{)",
    '',
    'legacy split technology css',
)
write(path, text)

# Page authority: replace horizontal stage organization with prerequisite-driven downward DAG rules.
path = Path('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md')
text = read(path)
old_layout = """研发页固定分为“研发新技术”和“技术树”两个一级区域。大于 `1380px` 时复用生产工作区三轨宽度：左侧操作列为 `280px–320px`，右侧技术树跨两条轨道；`961px–1380px` 保持左侧固定操作列和右侧剩余宽度，宽度不大于 `960px` 时改为单列。桌面操作卡只在研发工作区内 `sticky`。桌面代表工厂图标固定为 `4.5rem` 的 1:1 正圆，移动详情继续使用共享底部详情面板。

技术树按 C1–C7 阶段横向组织，每个阶段内部展示具体科技节点。节点显示科技名称、代表工厂图标、已掌握／研发中／可研发／锁定状态和研发中环形进度；点击锁定节点仍可查看缺少的具体前置科技。技术树宽度不足时只允许自身滚动，不得让整个页面横向溢出。默认选择进行中的科技，其次选择第一个满足前置关系的可研发科技，全部完成时选择最终科技。
"""
new_layout = """研发页固定分为“研发新技术”和“技术树”两个一级区域。大于 `1380px` 时复用生产工作区三轨宽度：左侧操作列为 `280px–320px`，右侧技术树跨两条轨道；`961px–1380px` 保持左侧固定操作列和右侧剩余宽度，宽度不大于 `960px` 时改为单列。桌面操作卡只在研发工作区内 `sticky`。桌面详情代表图固定为 `4.5rem` 的 1:1 正圆，移动详情继续使用共享底部详情面板。

技术树固定使用真实 `prerequisiteTechnologyIds` 驱动的自上而下 DAG，不得再按 C1–C7 生成七个横向阶段主干或阶段圆形节点。无前置科技位于最上层；任一科技的纵向深度固定为全部有效前置科技最大深度加一，因此每个子节点的视觉位置必须严格低于所有前置节点，同阶段科技存在真实前置时也必须继续向下生长。C1–C7 只显示为科技节点上的阶段标签，不决定树的纵向层级。生产科技继续使用代表工厂插画，作业科技继续使用对应生产资料商品图；节点显示科技名称、阶段、科技类型、已掌握／研发中／可研发／锁定状态和研发中环形进度，点击锁定节点仍可查看缺少的具体前置科技。

桌面技术树使用确定性布局：同一科技目录和前置关系必须产生稳定位置，目录顺序作为最终稳定排序；允许在每层按父／子重心做有限次稳定排序以减少连线交叉，但状态刷新不得使节点跳位。技术树从上向下自然增加页面高度；最宽层超出右侧工作区时只允许技术树区域自身横向滚动，不得让整个页面横向溢出。选中科技后固定高亮其完整上游前置路径，并以较弱强调显示直接后继及其连线，不得用颜色作为唯一关系表达。

移动端 `<=720px` 不复用桌面宽树横向滚动，固定压缩为最多两条横向节点轨道；同一纵向深度超过两个节点时在该深度内部增加子行，下一深度必须排在前一深度全部子行之后，因此任何子节点仍严格位于全部前置节点下方。移动技术树使用页面统一纵向滚动，不建立树级纵向滚动，也不得产生页面或树级横向滚动。点击节点继续打开共享底部详情面板，关闭后焦点返回原节点。默认选择进行中的科技，其次选择第一个满足前置关系的可研发科技，全部完成时选择最终科技。
"""
text = replace_once(text, old_layout, new_layout, 'research page authority layout')
write(path, text)

# Verifier: lock the downward DAG and remove stage-node expectations.
path = Path('scripts/verify-research-page.mjs')
text = read(path)
text = replace_once(
    text,
    "  'src/hooks/useStableSelection.ts',\n  'src/pages/ResearchPage.tsx',\n",
    "  'src/hooks/useStableSelection.ts',\n  'src/research/researchTreeLayout.ts',\n  'src/pages/ResearchPage.tsx',\n",
    'verifier helper file',
)
text = replace_once(text, "  'research-stage-node',\n", "  'data-layout-direction=\"downward\"',\n  'research-tree-connections--desktop',\n  'research-tree-connections--mobile',\n", 'verifier page tree markers')
text = replace_once(
    text,
    "  'active.durationMs ?? technology.durationMs',\n]) requireText('src/pages/ResearchPage.tsx', text);\n",
    "  'active.durationMs ?? technology.durationMs',\n  'buildResearchTreeLayout(technologies)',\n  'buildResearchTreeFocus(technologies, selectedTechnology?.id ?? \'\')',\n]) requireText('src/pages/ResearchPage.tsx', text);\n\nfor (const text of [\n  'technologyDepths',\n  'orderedLayers',\n  'MOBILE_COLUMNS = 2',\n  'desktopPath',\n  'mobilePath',\n  'buildResearchTreeFocus',\n]) requireText('src/research/researchTreeLayout.ts', text);\n",
    'verifier helper markers',
)
text = replace_once(
    text,
    "  '.research-stage-node',\n  '.research-technology-node',\n",
    "  '.research-tree-connections',\n  '.research-tree-edge[data-highlighted=\'true\']',\n  '.research-technology-node',\n",
    'verifier css markers',
)
text = replace_once(
    text,
    "  'renders seven stages and split technology nodes',\n",
    "  'renders a downward prerequisite tree on desktop',\n  'keeps every mobile dependency below its prerequisite without horizontal tree scrolling',\n",
    'verifier browser names',
)
text = replace_once(
    text,
    "  'C1–C7 只作为产业阶段',\n  '其余节点按照真实产业链设置前置关系',\n",
    "  'C1–C7 只作为产业阶段',\n  '其余节点按照真实产业链设置前置关系',\n  '自上而下 DAG',\n  '最多两条横向节点轨道',\n",
    'verifier design phrases',
)
text = replace_once(
    text,
    "  'technologies[technologies.length - 1]',\n]) forbidText('src/pages/ResearchPage.tsx', forbidden);\n",
    "  'technologies[technologies.length - 1]',\n  'research-stage-node',\n]) forbidText('src/pages/ResearchPage.tsx', forbidden);\nfor (const forbidden of [\n  'grid-template-columns: repeat(7',\n  '.research-stage-node',\n]) forbidText('src/styles/research-page.css', forbidden);\n",
    'verifier forbid legacy tree',
)
text = replace_once(
    text,
    "console.log('split technology tree, refresh-stable selection, detail requirements, mobile sheet, acceleration, server access and design verification passed');",
    "console.log('downward prerequisite research DAG, deterministic layout, mobile two-lane tree, stable selection, detail sheet and design verification passed');",
    'verifier message',
)
write(path, text)

# Browser regression: replace geometry test, extend stable-selection geometry, and add mobile DAG geometry.
path = Path('tests/browser/research-technology-tree.spec.ts')
text = read(path)
first_start = text.index("  test('renders seven stages and split technology nodes'")
first_end = text.index("\n\n  test('distinguishes operation research from production research'", first_start)
first_test = r'''  test('renders a downward prerequisite tree on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });

    await page.goto('runtime-test.html?view=production&scenario=facility-order');
    const productionGeometry = await page.evaluate(() => {
      const build = document.querySelector<HTMLElement>('.production-build-card')?.getBoundingClientRect();
      const navigation = document.querySelector<HTMLElement>('.facility-cluster-navigation')?.getBoundingClientRect();
      const detail = document.querySelector<HTMLElement>('.facility-cluster-detail-card')?.getBoundingClientRect();
      return {
        actionWidth: build?.width ?? 0,
        contentLeft: navigation?.left ?? 0,
        contentRight: detail?.right ?? 0,
      };
    });

    await page.goto('runtime-test.html?view=research&scenario=research-active');
    await expect(page.locator('.research-stage-node')).toHaveCount(0);
    await expect(page.locator('.research-technology-node')).toHaveCount(32);
    const researchGeometry = await page.evaluate(() => {
      const action = document.querySelector<HTMLElement>('.research-action-panel')?.getBoundingClientRect();
      const treePanel = document.querySelector<HTMLElement>('.research-tree-panel')?.getBoundingClientRect();
      const tree = document.querySelector<HTMLElement>('.research-tree');
      const treeScroll = document.querySelector<HTMLElement>('.research-tree-scroll');
      const detailArtwork = document.querySelector<HTMLElement>('.research-action-panel .research-detail-level-artwork');
      const detailArtworkBox = detailArtwork?.getBoundingClientRect();
      const detailArtworkStyle = detailArtwork ? getComputedStyle(detailArtwork) : null;
      const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.research-technology-node'));
      const topById = new Map(nodes.map((node) => [node.dataset.technologyId ?? '', node.getBoundingClientRect().top]));
      const allDependenciesDownward = nodes.every((node) => {
        const childTop = node.getBoundingClientRect().top;
        const prerequisiteIds = (node.dataset.prerequisites ?? '').split(',').filter(Boolean);
        return prerequisiteIds.every((parentId) => childTop > (topById.get(parentId) ?? -Infinity) + 24);
      });
      return {
        actionWidth: action?.width ?? 0,
        contentLeft: treePanel?.left ?? 0,
        contentRight: treePanel?.right ?? 0,
        detailArtworkWidth: detailArtworkBox?.width ?? 0,
        detailArtworkHeight: detailArtworkBox?.height ?? 0,
        detailArtworkAspectRatio: detailArtworkStyle?.aspectRatio ?? '',
        expectedDetailArtworkSize: rootFontSize * 4.5,
        layoutDirection: tree?.dataset.layoutDirection ?? '',
        connectionCount: document.querySelectorAll('.research-tree-connections--desktop .research-tree-edge').length,
        allDependenciesDownward,
        treeOwnsHorizontalOverflow: (treeScroll?.scrollWidth ?? 0) >= (treeScroll?.clientWidth ?? 0),
        fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
      };
    });

    expect(Math.abs(researchGeometry.actionWidth - productionGeometry.actionWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(researchGeometry.contentLeft - productionGeometry.contentLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(researchGeometry.contentRight - productionGeometry.contentRight)).toBeLessThanOrEqual(1);
    expect(researchGeometry.detailArtworkWidth).toBeCloseTo(researchGeometry.expectedDetailArtworkSize, 0);
    expect(Math.abs(researchGeometry.detailArtworkWidth - researchGeometry.detailArtworkHeight)).toBeLessThanOrEqual(1);
    expect(researchGeometry.detailArtworkAspectRatio).toBe('1 / 1');
    expect(researchGeometry.layoutDirection).toBe('downward');
    expect(researchGeometry.connectionCount).toBeGreaterThan(0);
    expect(researchGeometry.allDependenciesDownward).toBe(true);
    expect(researchGeometry.treeOwnsHorizontalOverflow).toBe(true);
    expect(researchGeometry.fitsViewport).toBe(true);
  });'''
text = text[:first_start] + first_test + text[first_end:]

old_refresh = """    const applianceNode = page.getByRole('button', { name: /家电工程，尚未开放/ });
    await applianceNode.click();
    await expect(applianceNode).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.research-action-panel')).toContainText('家电工程');

    const assetsButton = page.locator('button').filter({ hasText: '净资产' }).first();
"""
new_refresh = """    const applianceNode = page.getByRole('button', { name: /家电工程，尚未开放/ });
    await applianceNode.click();
    await expect(applianceNode).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.research-action-panel')).toContainText('家电工程');
    const beforeRefreshPosition = await applianceNode.boundingBox();

    const assetsButton = page.locator('button').filter({ hasText: '净资产' }).first();
"""
text = replace_once(text, old_refresh, new_refresh, 'browser refresh pre-position')
old_refresh_after = """    await expect(applianceNode).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.research-action-panel')).toContainText('家电工程');
    await expect(page.getByRole('button', { name: /冶金技术，研发中/ })).toHaveAttribute('aria-pressed', 'false');
  });
"""
new_refresh_after = """    await expect(applianceNode).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.research-action-panel')).toContainText('家电工程');
    await expect(page.getByRole('button', { name: /冶金技术，研发中/ })).toHaveAttribute('aria-pressed', 'false');
    const afterRefreshPosition = await applianceNode.boundingBox();
    expect(afterRefreshPosition?.x).toBeCloseTo(beforeRefreshPosition?.x ?? 0, 0);
    expect(afterRefreshPosition?.y).toBeCloseTo(beforeRefreshPosition?.y ?? 0, 0);
  });
"""
text = replace_once(text, old_refresh_after, new_refresh_after, 'browser refresh post-position')

mobile_anchor = """  test('opens technology details in the shared mobile sheet', async ({ page }) => {
"""
mobile_test = r'''  test('keeps every mobile dependency below its prerequisite without horizontal tree scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const geometry = await page.evaluate(() => {
      const treeScroll = document.querySelector<HTMLElement>('.research-tree-scroll');
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.research-technology-node'));
      const topById = new Map(nodes.map((node) => [node.dataset.technologyId ?? '', node.getBoundingClientRect().top]));
      const allDependenciesDownward = nodes.every((node) => {
        const childTop = node.getBoundingClientRect().top;
        const prerequisiteIds = (node.dataset.prerequisites ?? '').split(',').filter(Boolean);
        return prerequisiteIds.every((parentId) => childTop > (topById.get(parentId) ?? -Infinity) + 20);
      });
      return {
        allDependenciesDownward,
        treeHasNoHorizontalScroll: (treeScroll?.scrollWidth ?? 0) <= (treeScroll?.clientWidth ?? 0) + 1,
        pageFitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
        mobileConnectionsVisible: getComputedStyle(document.querySelector<HTMLElement>('.research-tree-connections--mobile')!).display !== 'none',
      };
    });

    expect(geometry.allDependenciesDownward).toBe(true);
    expect(geometry.treeHasNoHorizontalScroll).toBe(true);
    expect(geometry.pageFitsViewport).toBe(true);
    expect(geometry.mobileConnectionsVisible).toBe(true);
  });

'''
text = replace_once(text, mobile_anchor, mobile_test + mobile_anchor, 'browser mobile DAG test')
write(path, text)

print('downward research tree patch applied')
