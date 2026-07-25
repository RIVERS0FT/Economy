import { readFileSync, writeFileSync } from 'node:fs';

function replaceExact(path, before, after) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`${path} 未找到预期片段:\n${before}`);
  }
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${path} 预期片段出现 ${occurrences} 次，必须恰好一次`);
  }
  writeFileSync(path, source.replace(before, after));
}

replaceExact(
  'src/pages/ProductionPage.tsx',
  `  }, [game.facilityGroups, game.facilityTypes]);\n  const selectedFacilityEntry =`,
  `  }, [game.facilityGroups, game.facilityTypes]);\n  const facilityClusterStatusCounts = useMemo(() => {\n    const summary: Record<FacilityGroup['status'], number> = {\n      running: 0,\n      stopped: 0,\n      error: 0,\n    };\n    for (const { group } of orderedFacilityGroups) summary[group.status] += 1;\n    return summary;\n  }, [orderedFacilityGroups]);\n  const selectedFacilityEntry =`,
);

replaceExact(
  'src/pages/ProductionPage.tsx',
  `        <>\n          <StatusTag tone="success">运行 {formatNumber(model.derived.runningFacilities)}</StatusTag>\n          <StatusTag tone="neutral">停止 {formatNumber(model.derived.stoppedFacilities)}</StatusTag>\n          <StatusTag tone={model.derived.blockedFacilities > 0 ? 'danger' : 'neutral'}>\n            异常 {formatNumber(model.derived.blockedFacilities)}\n          </StatusTag>\n          {model.derived.constructingFacilities > 0 ? (\n            <StatusTag tone="warning">施工 {formatNumber(model.derived.constructingFacilities)}</StatusTag>\n          ) : null}\n        </>`,
  `        <>\n          <StatusTag tone="success">运行 {formatNumber(facilityClusterStatusCounts.running)}</StatusTag>\n          <StatusTag tone="neutral">停止 {formatNumber(facilityClusterStatusCounts.stopped)}</StatusTag>\n          <StatusTag tone={facilityClusterStatusCounts.error > 0 ? 'danger' : 'neutral'}>\n            异常 {formatNumber(facilityClusterStatusCounts.error)}\n          </StatusTag>\n        </>`,
);

replaceExact(
  'tests/browser/runtime-harness.tsx',
  `    next.game.products = [\n      { id: 'steel', name: '钢材', category: 'industrial', basePrice: 29 },\n      ...next.game.products,\n    ];\n    Object.assign(next, {`,
  `    next.game.products = [\n      { id: 'steel', name: '钢材', category: 'industrial', basePrice: 29 },\n      ...next.game.products,\n    ];\n    if (scenario === 'cluster-summary') {\n      const baseType = next.game.facilityTypes[0];\n      const baseGroup = next.game.facilityGroups[0];\n      next.game.facilityTypes = [\n        baseType,\n        { ...baseType, id: 'sawmill', name: '锯木厂' },\n        { ...baseType, id: 'flour-mill', name: '磨坊' },\n        { ...baseType, id: 'electronics-factory', name: '电子工厂' },\n      ];\n      next.game.facilityGroups = [\n        baseGroup,\n        {\n          ...baseGroup,\n          facilityTypeId: 'sawmill',\n          count: 7,\n          participatingCount: 5,\n          pendingJoinCount: 2,\n          availableCount: 7,\n          nextCycleCount: 7,\n          status: 'running',\n          statusReason: undefined,\n        },\n        {\n          ...baseGroup,\n          facilityTypeId: 'flour-mill',\n          count: 4,\n          participatingCount: 0,\n          pendingJoinCount: 0,\n          availableCount: 4,\n          nextCycleCount: 4,\n          enabled: false,\n          status: 'stopped',\n          statusReason: 'manual',\n        },\n        {\n          ...baseGroup,\n          facilityTypeId: 'electronics-factory',\n          count: 3,\n          participatingCount: 0,\n          pendingJoinCount: 0,\n          availableCount: 3,\n          nextCycleCount: 3,\n          status: 'error',\n          statusReason: 'insufficient_input',\n        },\n      ];\n      next.game.facilityConstruction = {\n        facilityTypeId: 'machinery-plant',\n        startedAt: fixedNow - 10_000,\n        completesAt: fixedNow + 50_000,\n        buildCost: 500,\n      };\n      next.derived.constructingFacilities = 1;\n    }\n    Object.assign(next, {`,
);

replaceExact(
  'scripts/verify-page-content.mjs',
  `  'src/pages/ProductionPage.tsx',\n  'src/pages/AssetsPage.tsx',`,
  `  'src/pages/ProductionPage.tsx',\n  'tests/browser/production-status-summary.spec.ts',\n  'src/pages/AssetsPage.tsx',`,
);

replaceExact(
  'scripts/verify-page-content.mjs',
  `  '运行 {formatNumber(model.derived.runningFacilities)}',\n  '停止 {formatNumber(model.derived.stoppedFacilities)}',\n  '异常 {formatNumber(model.derived.blockedFacilities)}',`,
  `  'const facilityClusterStatusCounts = useMemo(() => {',\n  "const summary: Record<FacilityGroup['status'], number> = {",\n  'summary[group.status] += 1;',\n  '运行 {formatNumber(facilityClusterStatusCounts.running)}',\n  '停止 {formatNumber(facilityClusterStatusCounts.stopped)}',\n  '异常 {formatNumber(facilityClusterStatusCounts.error)}',`,
);

replaceExact(
  'scripts/verify-page-content.mjs',
  `]) requireText('src/pages/ProductionPage.tsx', text);\nfor (const text of [\n  'facility-formula-input-group',`,
  `]) requireText('src/pages/ProductionPage.tsx', text);\nfor (const text of [\n  '运行 {formatNumber(model.derived.runningFacilities)}',\n  '停止 {formatNumber(model.derived.stoppedFacilities)}',\n  '异常 {formatNumber(model.derived.blockedFacilities)}',\n  '施工 {formatNumber(model.derived.constructingFacilities)}',\n]) forbidText('src/pages/ProductionPage.tsx', text);\nrequireText(\n  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',\n  '标题区状态汇总固定只显示“运行 N／停止 N／异常 N”',\n);\nfor (const text of [\n  'facility-formula-input-group',`,
);

replaceExact(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  `   ├─ 左侧：建设新工厂\n   └─ 右侧：工厂类型集群卡\n\`\`\`\n\n共享仓库、建设新工厂和工厂集群是生产页同一一级平面的卡片，统一使用 \`.production-surface\`。`,
  `   ├─ 左侧：建设新工厂\n   └─ 右侧：工厂类型集群卡\n\`\`\`\n\n标题区状态汇总固定只显示“运行 N／停止 N／异常 N”。三个数字都按当前拥有且 \`count > 0\` 的工厂类型集群数量统计，每个集群只根据服务器权威 \`status\` 计入运行、停止或异常中的一项，不得按工厂座数、\`participatingCount\` 或 \`nextCycleCount\` 求和。施工任务不进入标题区状态汇总；建设卡继续显示当前施工任务、施工状态和剩余时间，概览施工提醒也继续保留。\n\n共享仓库、建设新工厂和工厂集群是生产页同一一级平面的卡片，统一使用 \`.production-surface\`。`,
);

writeFileSync(
  'tests/browser/production-status-summary.spec.ts',
  `import { expect, test } from '@playwright/test';\n\ntest.describe('production cluster status summary', () => {\n  test.use({ viewport: { width: 1440, height: 900 } });\n\n  test('counts running, stopped and error clusters while omitting construction from the heading', async ({ page }) => {\n    await page.goto('runtime-test.html?view=production&scenario=cluster-summary');\n\n    const summary = page.locator('.page-heading-actions');\n    await expect(summary).toContainText('运行 2');\n    await expect(summary).toContainText('停止 1');\n    await expect(summary).toContainText('异常 1');\n    await expect(summary).not.toContainText('施工');\n\n    await expect(page.locator('.construction-status')).toContainText('施工中');\n  });\n});\n`,
);

console.log('生产页集群状态统计修改已应用。');
