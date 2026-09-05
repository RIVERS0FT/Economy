## it
ℹ tests 558
ℹ suites 0
ℹ pass 558
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13209.493308


## dt

> economy@0.4.0 validate:dt
> node scripts/verify-contract-renewal-economic-events.mjs && npm run verify:provincial-economy && npm run verify:architecture && npm run test:nginx-config && npm run server:check && npm run test:coverage:dt && tsc && vite build

Legacy contract renewal compatibility and strategic economic event verification passed.

> economy@0.4.0 verify:provincial-economy
> node scripts/verify-provincial-economy.mjs && node scripts/verify-commercial-buildings.mjs

Strategic map pruned 10m topology verified: 1030765 bytes
Strategic map pruned 110m topology verified: 16996 bytes
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: 州级页面设计权威缺少: 概览｜市场｜商业｜工业｜仓库
    at file:///home/runner/work/Economy/Economy/scripts/verify-provincial-economy.mjs:496:11
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v24.20.0


## contracts

FAILED:  node --experimental-strip-types scripts/verify-runtime-architecture.mjs  
  运行时架构验证失败:
- ProvincePage.tsx 必须动态导入地区页面 ./BuildingsPage


FAILED:  node scripts/verify-page-content.mjs  
  页面内容与职责验证失败:
- docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: 建筑固定采用“工厂目录 → 工厂地区列表 → 地区工厂详情”的工厂优先钻取
- docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: 默认态保持正式工厂目录顺序
- docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: 表头允许按工厂名称、平均利润和拥有数量
- docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: `ProvincePage` 内的市场、商业与工业分区仍始终是地图所打开当前州的本地视图
- docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: 商业、工业与仓库直接显示本地经营内容
- docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: 一级市场商品的地区行情列表与一级建筑工厂的地区列表覆盖连续 48 州
- src/pages/ProvincePage.tsx 缺少: <EmbeddedCommercePage
- src/pages/GlobalBuildingsPage.tsx 缺少: onClick={() => openGlobalFacility(row.facilityTypeId)}
- docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: 商业、工业与仓库直接显示本地经营内容


FAILED:  node scripts/verify-ui-architecture-runner.mjs  
 共享 UI、唯一开关、导航完全不透明状态色、独立工厂 SVG 与统一商品图标验证通过。
downward prerequisite research DAG, three-state icon-and-name technology nodes, edge-to-edge desktop canvas, stable hover geometry, ordinary wheel zoom, drag pan, double-click current focus, shared workspace card with transparent research canvas, shared mobile pan/zoom viewport, stable selection, no below-tree page-flow card, detail sheet and design verification passed
地区实体标题导航验证通过：商品、商业建筑与工厂详情共享两行地区标题与可点击地区名，统一通过受限页面栈 push 到对应地区概览并保留原详情返回路径，40px 标题轨道紧凑例外与浏览器回归均已锁定。
 工厂目录扁平列表验证失败:
- docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md 缺少: 目录表头固定显示“建筑｜利润｜拥有”


FAILED:  npm run verify:product-artwork  
 
> economy@0.4.0 verify:product-artwork
> npm run generate:product-artwork && node scripts/verify-product-artwork.mjs


> economy@0.4.0 generate:product-artwork
> node scripts/generate-product-artwork-thumbnails.mjs

商品运行时缩略图生成完成：38 种 128×128 RGBA PNG，总计 850.3 KiB，更新 38 个文件。
 商品图片视觉与资源验证失败:
- 生产公式必须使用 ProductArtwork PNG 且不得渲染商品 SVG


FAILED:  node scripts/verify-interaction-modality.mjs  
  全局输入方式与共享交互状态验证失败：
- src/pages/BuildingsPage.tsx 缺少: className="facility-cluster-detail-shell facility-cluster-detail-page"


FAILED:  node scripts/verify-unified-factory-recipes-grid.mjs  
  node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: 生产公式缺少: <strong>title={<GameConcept concept="production-settlement" />}</strong>

false !== true

    at file:///home/runner/work/Economy/Economy/scripts/verify-unified-factory-recipes-grid.mjs:195:11
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v24.20.0


FAILED:  node scripts/verify-facility-groups.mjs  
  工厂三态、生产公式、自动恢复与统一开关验证失败:
- src/components/facilities/FacilityProductionFormula.tsx 缺少: facility-formula-top
- src/components/facilities/FacilityProductionFormula.tsx 缺少: facility-formula-input-side
- src/components/facilities/FacilityProductionFormula.tsx 缺少: facility-formula-meta
- src/components/facilities/FacilityProductionFormula.tsx 缺少: facility-formula-progress
- src/components/facilities/FacilityProductionFormula.tsx 缺少: facility-formula-meta-icon
- src/components/facilities/FacilityProductionFormula.tsx 缺少: CycleIcon
- src/components/facilities/FacilityProductionFormula.tsx 缺少: CreditsIcon
- src/components/facilities/FacilityProductionFormula.tsx 缺少: WarehouseIcon
- src/components/facilities/FacilityProductionFormula.tsx 缺少: role="group"
- src/components/facilities/FacilityProductionFormula.tsx 缺少: aria-label={description}


FAILED: node scripts/verify-provincial-economy.mjs  
 Strategic map pruned 10m topology verified: 1030765 bytes
Strategic map pruned 110m topology verified: 16996 bytes
 node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: 州级页面设计权威缺少: 概览｜市场｜商业｜工业｜仓库
    at file:///home/runner/work/Economy/Economy/scripts/verify-provincial-economy.mjs:496:11
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v24.20.0



## browser

Running 31 tests using 4 workers

[1/31] [chromium] › tests/browser/buildings-ledger-layout.spec.ts:71:1 › factory card opens second-level detail without changing header height
[2/31] [chromium] › tests/browser/buildings-ledger-layout.spec.ts:16:1 › regional buildings shows build first and three factory cards per row
[3/31] [chromium] › tests/browser/buildings-ledger-layout.spec.ts:119:1 › mobile factory cards remain three columns without horizontal clipping
[4/31] [chromium] › tests/browser/commercial-buildings-layout.spec.ts:24:3 › commercial cards and details reuse industrial geometry at 320px








[5/31] [chromium] › tests/browser/commercial-buildings-layout.spec.ts:24:3 › commercial cards and details reuse industrial geometry at 390px
[6/31] [chromium] › tests/browser/commercial-buildings-layout.spec.ts:24:3 › commercial cards and details reuse industrial geometry at 720px
[7/31] [chromium] › tests/browser/commercial-buildings-layout.spec.ts:24:3 › commercial cards and details reuse industrial geometry at 1440px




[8/31] [chromium] › tests/browser/commercial-buildings-layout.spec.ts:70:1 › commercial cards show per-building profit and details show server-locked totals






[9/31] [chromium] › tests/browser/commercial-buildings-layout.spec.ts:87:1 › commercial switch prevents repeated requests and preserves an invested cycle after stop


[10/31] [chromium] › tests/browser/commercial-buildings-layout.spec.ts:115:3 › commercial network failure leaves the authoritative switch intact
[11/31] [chromium] › tests/browser/commercial-buildings-layout.spec.ts:115:3 › commercial server failure leaves the authoritative switch intact
[12/31] [chromium] › tests/browser/commercial-buildings-layout.spec.ts:133:1 › commercial countdown waits for the server and does not settle or restart locally

[13/31] [chromium] › tests/browser/commercial-buildings-layout.spec.ts:147:1 › commercial empty state and long names remain usable at 320px



[14/31] [chromium] › tests/browser/production-methods.spec.ts:4:3 › factory production methods › renders compact selectors and switches the active recipe immediately
[15/31] [chromium] › tests/browser/production-methods.spec.ts:138:5 › factory production methods › keeps mobile production controls and settlement in one non-overlapping page detail flow at 320px
[16/31] [chromium] › tests/browser/production-methods.spec.ts:138:5 › factory production methods › keeps mobile production controls and settlement in one non-overlapping page detail flow at 360px









[17/31] [chromium] › tests/browser/production-methods.spec.ts:138:5 › factory production methods › keeps mobile production controls and settlement in one non-overlapping page detail flow at 390px

[18/31] [chromium] › tests/browser/production-methods.spec.ts:138:5 › factory production methods › keeps mobile production controls and settlement in one non-overlapping page detail flow at 430px
[19/31] [chromium] › tests/browser/province-map.spec.ts:30:1 › persistent strategy map uses one static SVG world for 48 states and Chinese labels
[20/31] [chromium] › tests/browser/production-methods.spec.ts:138:5 › factory production methods › keeps mobile production controls and settlement in one non-overlapping page detail flow at 720px











[21/31] [chromium] › tests/browser/province-map.spec.ts:111:1 › state selection opens local context without resetting the static camera


[22/31] [chromium] › tests/browser/province-map.spec.ts:158:1 › mobile static map keeps labels, touch gestures and hidden tooltip behavior
[23/31] [chromium] › tests/browser/unified-buildings.spec.ts:34:3 › global catalog filters both building kinds at 320px

[24/31] [chromium] › tests/browser/unified-buildings.spec.ts:52:3 › regional directory and both shared details remain usable at 320px




[25/31] [chromium] › tests/browser/unified-buildings.spec.ts:34:3 › global catalog filters both building kinds at 1440px

[26/31] [chromium] › tests/browser/unified-buildings.spec.ts:52:3 › regional directory and both shared details remain usable at 1440px
[27/31] (retries) [chromium] › tests/browser/unified-buildings.spec.ts:34:3 › global catalog filters both building kinds at 320px (retry #1)





[28/31] [chromium] › tests/browser/unified-buildings.spec.ts:85:1 › global commerce restores its region, detail and filtered catalog

[29/31] (retries) [chromium] › tests/browser/unified-buildings.spec.ts:34:3 › global catalog filters both building kinds at 1440px (retry #1)




[30/31] [chromium] › tests/browser/unified-buildings.spec.ts:105:1 › commercial automatic operation is independent and prevents duplicate requests
  1) [chromium] › tests/browser/unified-buildings.spec.ts:34:3 › global catalog filters both building kinds at 320px 

    Error: [{"tag":"svg","cls":"commercial-building-artwork global-facility-catalog-row__artwork","width":302,"right":4.796875,"scroll":302,"client":302},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"svg","cls":"commercial-building-artwork global-facility-catalog-row__artwork","width":302,"right":4.796875,"scroll":302,"client":302},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"svg","cls":"commercial-building-artwork global-facility-catalog-row__artwork","width":302,"right":4.796875,"scroll":302,"client":302},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0}]

    expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 303
    Received:    307

      23 |   );
      24 |   expect(widths.length).toBeGreaterThan(0);
    > 25 |   for (const width of widths) expect(width.scroll, JSON.stringify(await page.locator('.global-buildings-page').evaluateAll((roots) => roots.flatMap((root) => Array.from(root.querySelectorAll('*')).filter((el) => el.getBoundingClientRect().right > root.getBoundingClientRect().right + 1).slice(0, 20).map((el) => ({ tag: el.tagName, cls: el.getAttribute('class'), width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right - root.getBoundingClientRect().right, scroll: el.scrollWidth, client: el.clientWidth })))))).toBeLessThanOrEqual(width.client + 1);
         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          ^
      26 | }
      27 | async function openConvenienceDetail(page: Page) {
      28 |   await openRegional(page);
        at assertNoOverflow (/home/runner/work/Economy/Economy/tests/browser/unified-buildings.spec.ts:25:538)
        at /home/runner/work/Economy/Economy/tests/browser/unified-buildings.spec.ts:45:5

    Error Context: test-results/unified-buildings-global-c-eebb8-oth-building-kinds-at-320px-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-global-c-eebb8-oth-building-kinds-at-320px-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-global-c-eebb8-oth-building-kinds-at-320px-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: [{"tag":"svg","cls":"commercial-building-artwork global-facility-catalog-row__artwork","width":302,"right":4.796875,"scroll":302,"client":302},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"svg","cls":"commercial-building-artwork global-facility-catalog-row__artwork","width":302,"right":4.796875,"scroll":302,"client":302},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"svg","cls":"commercial-building-artwork global-facility-catalog-row__artwork","width":302,"right":4.796875,"scroll":302,"client":302},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0},{"tag":"path","cls":null,"width":302,"right":4.796875,"scroll":0,"client":0}]

    expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 303
    Received:    307

      23 |   );
      24 |   expect(widths.length).toBeGreaterThan(0);
    > 25 |   for (const width of widths) expect(width.scroll, JSON.stringify(await page.locator('.global-buildings-page').evaluateAll((roots) => roots.flatMap((root) => Array.from(root.querySelectorAll('*')).filter((el) => el.getBoundingClientRect().right > root.getBoundingClientRect().right + 1).slice(0, 20).map((el) => ({ tag: el.tagName, cls: el.getAttribute('class'), width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right - root.getBoundingClientRect().right, scroll: el.scrollWidth, client: el.clientWidth })))))).toBeLessThanOrEqual(width.client + 1);
         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          ^
      26 | }
      27 | async function openConvenienceDetail(page: Page) {
      28 |   await openRegional(page);
        at assertNoOverflow (/home/runner/work/Economy/Economy/tests/browser/unified-buildings.spec.ts:25:538)
        at /home/runner/work/Economy/Economy/tests/browser/unified-buildings.spec.ts:45:5

    Error Context: test-results/unified-buildings-global-c-eebb8-oth-building-kinds-at-320px-chromium-retry1/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-global-c-eebb8-oth-building-kinds-at-320px-chromium-retry1/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-global-c-eebb8-oth-building-kinds-at-320px-chromium-retry1/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────


[31/31] [chromium] › tests/browser/unified-buildings.spec.ts:133:1 › failed commercial policy save preserves the authoritative setting

[32/31] [chromium] › tests/browser/unified-buildings.spec.ts:142:1 › commercial goods open the same local product and return without trading

  2) [chromium] › tests/browser/unified-buildings.spec.ts:34:3 › global catalog filters both building kinds at 1440px 

    Error: [{"tag":"svg","cls":"commercial-building-artwork global-facility-catalog-row__artwork","width":384,"right":6.390625,"scroll":384,"client":384},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"svg","cls":"commercial-building-artwork global-facility-catalog-row__artwork","width":384,"right":6.390625,"scroll":384,"client":384},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"svg","cls":"commercial-building-artwork global-facility-catalog-row__artwork","width":384,"right":6.390625,"scroll":384,"client":384},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0}]

    expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 385
    Received:    390

      23 |   );
      24 |   expect(widths.length).toBeGreaterThan(0);
    > 25 |   for (const width of widths) expect(width.scroll, JSON.stringify(await page.locator('.global-buildings-page').evaluateAll((roots) => roots.flatMap((root) => Array.from(root.querySelectorAll('*')).filter((el) => el.getBoundingClientRect().right > root.getBoundingClientRect().right + 1).slice(0, 20).map((el) => ({ tag: el.tagName, cls: el.getAttribute('class'), width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right - root.getBoundingClientRect().right, scroll: el.scrollWidth, client: el.clientWidth })))))).toBeLessThanOrEqual(width.client + 1);
         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          ^
      26 | }
      27 | async function openConvenienceDetail(page: Page) {
      28 |   await openRegional(page);
        at assertNoOverflow (/home/runner/work/Economy/Economy/tests/browser/unified-buildings.spec.ts:25:538)
        at /home/runner/work/Economy/Economy/tests/browser/unified-buildings.spec.ts:45:5

    Error Context: test-results/unified-buildings-global-c-c9bab-th-building-kinds-at-1440px-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-global-c-c9bab-th-building-kinds-at-1440px-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-global-c-c9bab-th-building-kinds-at-1440px-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: [{"tag":"svg","cls":"commercial-building-artwork global-facility-catalog-row__artwork","width":384,"right":6.390625,"scroll":384,"client":384},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"svg","cls":"commercial-building-artwork global-facility-catalog-row__artwork","width":384,"right":6.390625,"scroll":384,"client":384},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"svg","cls":"commercial-building-artwork global-facility-catalog-row__artwork","width":384,"right":6.390625,"scroll":384,"client":384},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0},{"tag":"path","cls":null,"width":384,"right":6.390625,"scroll":0,"client":0}]

    expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 385
    Received:    390

      23 |   );
      24 |   expect(widths.length).toBeGreaterThan(0);
    > 25 |   for (const width of widths) expect(width.scroll, JSON.stringify(await page.locator('.global-buildings-page').evaluateAll((roots) => roots.flatMap((root) => Array.from(root.querySelectorAll('*')).filter((el) => el.getBoundingClientRect().right > root.getBoundingClientRect().right + 1).slice(0, 20).map((el) => ({ tag: el.tagName, cls: el.getAttribute('class'), width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right - root.getBoundingClientRect().right, scroll: el.scrollWidth, client: el.clientWidth })))))).toBeLessThanOrEqual(width.client + 1);
         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          ^
      26 | }
      27 | async function openConvenienceDetail(page: Page) {
      28 |   await openRegional(page);
        at assertNoOverflow (/home/runner/work/Economy/Economy/tests/browser/unified-buildings.spec.ts:25:538)
        at /home/runner/work/Economy/Economy/tests/browser/unified-buildings.spec.ts:45:5

    Error Context: test-results/unified-buildings-global-c-c9bab-th-building-kinds-at-1440px-chromium-retry1/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/unified-buildings-global-c-c9bab-th-building-kinds-at-1440px-chromium-retry1/trace.zip
    Usage:

        npx playwright show-trace test-results/unified-buildings-global-c-c9bab-th-building-kinds-at-1440px-chromium-retry1/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────


[33/31] [chromium] › tests/browser/unified-buildings.spec.ts:155:1 › legacy unknown settlement detail stays unknown and empty commerce retains construction









  2 failed
    [chromium] › tests/browser/unified-buildings.spec.ts:34:3 › global catalog filters both building kinds at 320px 
    [chromium] › tests/browser/unified-buildings.spec.ts:34:3 › global catalog filters both building kinds at 1440px 
  29 passed (1.9m)