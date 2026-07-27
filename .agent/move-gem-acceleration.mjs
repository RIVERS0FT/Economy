import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceExact(path, before, after, label) {
  const source = read(path);
  if (!source.includes(before)) throw new Error(`${path}: missing ${label}`);
  write(path, source.replace(before, after));
}

function replaceRegex(path, pattern, after, label) {
  const source = read(path);
  if (!pattern.test(source)) throw new Error(`${path}: missing ${label}`);
  write(path, source.replace(pattern, after));
}

const production = 'src/pages/ProductionPage.tsx';

replaceExact(
  production,
  `import type {\n  FacilityConstruction,\n  FacilityGroup,`,
  `import type {\n  FacilityGroup,`,
  'FacilityConstruction import',
);

replaceExact(
  production,
  `interface FacilityClusterEntry {\n  group: FacilityGroup;\n  type: FacilityTypeDefinition;\n  construction?: FacilityConstruction;\n  constructionOnly?: boolean;\n}`,
  `interface FacilityClusterEntry {\n  group: FacilityGroup;\n  type: FacilityTypeDefinition;\n}`,
  'facility cluster entry construction fields',
);

replaceExact(
  production,
  `interface FacilityClusterDetailSharedProps {\n  entry: FacilityClusterEntry;\n  products: ProductDefinition[];\n  inventories: Record<string, ProductInventory>;\n  now: number;\n  gems: number;\n  acceleratingConstruction: boolean;\n  onToggle: (enabled: boolean) => void;\n  onRecipeChange: (recipeId: string) => void;\n  onAccelerateConstruction: () => void;\n  onOpenMarket: () => void;\n}`,
  `interface FacilityClusterDetailSharedProps {\n  entry: FacilityClusterEntry;\n  products: ProductDefinition[];\n  inventories: Record<string, ProductInventory>;\n  now: number;\n  onToggle: (enabled: boolean) => void;\n  onRecipeChange: (recipeId: string) => void;\n  onOpenMarket: () => void;\n}`,
  'detail acceleration props',
);

replaceExact(production, `  const { group, type, constructionOnly } = entry;`, `  const { group, type } = entry;`, 'selector construction destructuring');
replaceExact(production, `      data-status={constructionOnly ? 'constructing' : group.status}`, `      data-status={group.status}`, 'selector construction status');
replaceExact(
  production,
  `      aria-label={constructionOnly ? \`${'${type.name}'}，施工中\` : \`${'${type.name}'}，数量 ${'${formatNumber(group.count)}'}，${'${facilityStatusLabel(group)}'}\`}`,
  `      aria-label={\`${'${type.name}'}，数量 ${'${formatNumber(group.count)}'}，${'${facilityStatusLabel(group)}'}\`}`,
  'selector construction aria label',
);
replaceExact(
  production,
  `      <span className="facility-cluster-count">{constructionOnly ? '施工中' : formatNumber(group.count)}</span>`,
  `      <span className="facility-cluster-count">{formatNumber(group.count)}</span>`,
  'selector construction count',
);

replaceExact(
  production,
  `\n  if (entry.constructionOnly) {\n    return (\n      <div className="facility-card-head facility-status-header">\n        <div className="facility-card-title-row">\n          <div className="facility-card-title-block facility-cluster-selector-heading">\n            <h2 id={titleId}>{type.name}</h2>\n            <StatusTag tone="warning">施工中</StatusTag>\n          </div>\n        </div>\n        <div className="facility-count-summary"><span>完工后新增 <strong>1</strong> 座</span></div>\n      </div>\n    );\n  }\n`,
  ``,
  'construction-only detail header',
);

replaceRegex(
  production,
  /function FacilityConstructionAcceleration\([\s\S]*?\n}\n\nfunction FacilityClusterDetailBody/,
  'function FacilityClusterDetailBody',
  'detail acceleration component',
);

replaceRegex(
  production,
  /function FacilityClusterDetailBody\(\{\n  entry,\n  products,\n  inventories,\n  now,\n  gems,\n  acceleratingConstruction,\n  onRecipeChange,\n  onAccelerateConstruction,\n}: Omit<FacilityClusterDetailSharedProps, 'onToggle' \| 'onOpenMarket'>\) \{\n  const \{ group, type \} = entry;\n  if \(entry\.constructionOnly\) \{[\s\S]*?\n  }\n  const recipeState = resolveFacilityDetailRecipeState\(entry\);/,
  `function FacilityClusterDetailBody({\n  entry,\n  products,\n  inventories,\n  now,\n  onRecipeChange,\n}: Omit<FacilityClusterDetailSharedProps, 'onToggle' | 'onOpenMarket'>) {\n  const { group, type } = entry;\n  const recipeState = resolveFacilityDetailRecipeState(entry);`,
  'detail body acceleration props',
);

replaceRegex(
  production,
  /\n      <FacilityConstructionAcceleration\n        entry=\{entry\}\n        gems=\{gems\}\n        now=\{now\}\n        acceleratingConstruction=\{acceleratingConstruction\}\n        onAccelerateConstruction=\{onAccelerateConstruction\}\n      \/>/,
  '',
  'detail body acceleration rendering',
);

for (const [before, after, label] of [
  [`  gems,\n  acceleratingConstruction,\n`, ``, 'detail content acceleration destructuring'],
  [`  onAccelerateConstruction,\n`, ``, 'detail content acceleration callback'],
  [`        gems={gems}\n        acceleratingConstruction={acceleratingConstruction}\n`, ``, 'detail content acceleration values'],
  [`        onAccelerateConstruction={onAccelerateConstruction}\n`, ``, 'detail content acceleration handler'],
  [`      {entry.constructionOnly ? null : <FacilityMarketAction onOpenMarket={onOpenMarket} />}`, `      <FacilityMarketAction onOpenMarket={onOpenMarket} />`, 'detail market construction condition'],
]) replaceExact(production, before, after, label);

replaceExact(
  production,
  `          {entry.constructionOnly ? null : <FacilityMarketAction onOpenMarket={() => requestClose(onOpenMarket)} />}`,
  `          <FacilityMarketAction onOpenMarket={() => requestClose(onOpenMarket)} />`,
  'mobile footer construction condition',
);

replaceExact(
  production,
  `  const orderedFacilityGroups = useMemo<FacilityClusterEntry[]>(() => {\n    const groupsByTypeId = new Map<string, FacilityGroup>(\n      game.facilityGroups.map((group) => [group.facilityTypeId, group]),\n    );\n\n    return game.facilityTypes.flatMap((type): FacilityClusterEntry[] => {\n      const group = groupsByTypeId.get(type.id);\n      const construction = game.facilityConstruction?.facilityTypeId === type.id\n        ? game.facilityConstruction\n        : undefined;\n      if (group && group.count > 0) return [{ type, group, construction }];\n      if (!construction) return [];\n      return [{\n        type,\n        construction,\n        constructionOnly: true,\n        group: {\n          facilityTypeId: type.id,\n          count: 0,\n          participatingCount: 0,\n          pendingJoinCount: 0,\n          listedCount: 0,\n          frozenCount: 0,\n          mortgagedCount: 0,\n          availableCount: 0,\n          nextCycleCount: 0,\n          enabled: false,\n          status: 'stopped',\n          statusReason: 'manual',\n          lifetimeOutput: 0,\n          activeRecipeId: type.defaultRecipeId,\n        },\n      }];\n    });\n  }, [game.facilityConstruction, game.facilityGroups, game.facilityTypes]);`,
  `  const orderedFacilityGroups = useMemo<FacilityClusterEntry[]>(() => {\n    const groupsByTypeId = new Map<string, FacilityGroup>(\n      game.facilityGroups.map((group) => [group.facilityTypeId, group]),\n    );\n\n    return game.facilityTypes.flatMap((type): FacilityClusterEntry[] => {\n      const group = groupsByTypeId.get(type.id);\n      return group && group.count > 0 ? [{ type, group }] : [];\n    });\n  }, [game.facilityGroups, game.facilityTypes]);`,
  'temporary construction detail entry',
);

replaceExact(production, `      if (!entry.constructionOnly) summary[entry.group.status] += 1;`, `      summary[entry.group.status] += 1;`, 'construction status count condition');
replaceExact(production, `    if (!selectedFacilityEntry || selectedFacilityEntry.constructionOnly) return;`, `    if (!selectedFacilityEntry) return;`, 'market construction-only condition');
replaceExact(production, `    if (!selectedFacilityEntry?.construction || acceleratingConstruction) return;`, `    if (!game.facilityConstruction || acceleratingConstruction) return;`, 'acceleration selected detail dependency');

replaceExact(
  production,
  `  const constructionAwaitingConfirmation = Boolean(game.facilityConstruction && constructionRemaining === 0);`,
  `  const constructionAwaitingConfirmation = Boolean(game.facilityConstruction && constructionRemaining === 0);\n  const constructionAccelerationMs = game.facilityConstruction?.gemAccelerationMs ?? 30 * 60 * 1000;\n  const constructionAccelerationCost = game.facilityConstruction?.gemAccelerationCost ?? 1;\n  const constructionRemainingAfterAcceleration = Math.max(0, constructionRemaining - constructionAccelerationMs);`,
  'construction acceleration preview values',
);

replaceExact(
  production,
  `              <span>\n                {constructionAwaitingConfirmation\n                  ? '正在同步服务器结算结果'\n                  : \`剩余 ${'${formatDuration(constructionRemaining)}'}\`}\n              </span>\n              <small>建成后不会重置当前集群进度，将在下一生产周期加入。</small>`,
  `              <span>\n                {constructionAwaitingConfirmation\n                  ? '正在同步服务器结算结果'\n                  : \`剩余 ${'${formatDuration(constructionRemaining)}'}\`}\n              </span>\n              <strong>宝石加速</strong>\n              <span>\n                {constructionAwaitingConfirmation\n                  ? '等待服务器确认完工'\n                  : \`使用后${'${constructionRemainingAfterAcceleration > 0 ? `剩余 ${formatDuration(constructionRemainingAfterAcceleration)}` : `立即完工`}'}\`}\n              </span>\n              <Button\n                block\n                disabled={\n                  constructionAwaitingConfirmation ||\n                  game.gems < constructionAccelerationCost ||\n                  acceleratingConstruction\n                }\n                onClick={() => void accelerateSelectedConstruction()}\n              >\n                {acceleratingConstruction\n                  ? '加速处理中…'\n                  : \`${'${formatNumber(constructionAccelerationCost)}'} 宝石 · 加速 ${'${formatDuration(constructionAccelerationMs)}'}\`}\n              </Button>\n              <small>建成后不会重置当前集群进度，将在下一生产周期加入；每次固定减少 30m，剩余不足 30m 时直接完工。</small>`,
  'build card acceleration controls',
);

for (const [before, after, label] of [
  [`                gems={game.gems}\n                acceleratingConstruction={acceleratingConstruction}\n`, ``, 'desktop detail acceleration values'],
  [`                onAccelerateConstruction={() => void accelerateSelectedConstruction()}\n`, ``, 'desktop detail acceleration handler'],
  [`        gems={game.gems}\n        acceleratingConstruction={acceleratingConstruction}\n`, ``, 'mobile detail acceleration values'],
  [`        onAccelerateConstruction={() => void accelerateSelectedConstruction()}\n`, ``, 'mobile detail acceleration handler'],
]) replaceExact(production, before, after, label);

const productionSource = read(production);
for (const forbidden of [
  'FacilityConstructionAcceleration',
  'constructionOnly',
  'entry.construction',
  'gems={game.gems}',
  'onAccelerateConstruction=',
]) {
  if (productionSource.includes(forbidden)) throw new Error(`${production}: forbidden remains: ${forbidden}`);
}
for (const required of [
  'className="production-surface build-card production-build-card"',
  '<strong>宝石加速</strong>',
  'game.facilityConstruction || acceleratingConstruction',
  'constructionRemainingAfterAcceleration',
  'accelerateFacilityConstruction()',
]) {
  if (!productionSource.includes(required)) throw new Error(`${production}: required missing: ${required}`);
}

replaceExact(
  'tests/browser/production-status-summary.spec.ts',
  `    const buildConstruction = page.locator('.production-build-card .construction-status');\n    await expect(buildConstruction).toHaveCount(1);\n    await expect(buildConstruction).toContainText('施工中');\n\n    const detailAcceleration = page.locator('.facility-cluster-detail-card .construction-status');\n    await expect(detailAcceleration).toHaveCount(1);\n    await expect(detailAcceleration).toContainText('宝石加速');`,
  `    const buildConstruction = page.locator('.production-build-card .construction-status');\n    await expect(buildConstruction).toHaveCount(1);\n    await expect(buildConstruction).toContainText('施工中');\n    await expect(buildConstruction).toContainText('宝石加速');\n    await expect(buildConstruction.getByRole('button', { name: '1 宝石 · 加速 30m' })).toHaveCount(1);\n\n    await expect(page.locator('.facility-cluster-detail-card')).not.toContainText('宝石加速');\n    await expect(page.locator('.facility-cluster-selector-card[data-status="constructing"]')).toHaveCount(0);`,
  'production browser acceleration assertions',
);

replaceExact(
  'scripts/verify-gem-shop.mjs',
  `for (const text of ['宝石加速', '加速处理中', 'accelerateFacilityConstruction']) {\n  requireText('src/pages/ProductionPage.tsx', text);\n}`,
  `for (const text of [\n  'className="production-surface build-card production-build-card"',\n  '<strong>宝石加速</strong>',\n  'constructionRemainingAfterAcceleration',\n  '加速处理中',\n  'accelerateFacilityConstruction',\n]) requireText('src/pages/ProductionPage.tsx', text);\nfor (const text of ['FacilityConstructionAcceleration', 'constructionOnly', 'onAccelerateConstruction=']) {\n  forbidText('src/pages/ProductionPage.tsx', text);\n}`,
  'gem shop production entry verification',
);

replaceExact(
  'scripts/verify-unified-factory-recipes-grid.mjs',
  `  'game.facilityTypes.flatMap((type): FacilityClusterEntry[] =>',\n  'constructionOnly: true',\n  'if (!construction) return [];',\n  'group && group.count > 0',`,
  `  'game.facilityTypes.flatMap((type): FacilityClusterEntry[] =>',\n  'return group && group.count > 0 ? [{ type, group }] : [];',`,
  'factory grid temporary construction requirements',
);
replaceExact(
  'scripts/verify-unified-factory-recipes-grid.mjs',
  `  "data-status={constructionOnly ? 'constructing' : group.status}",\n  'aria-label={constructionOnly ? \`${'${type.name}'}，施工中\` : \`${'${type.name}'}，数量 ${'${formatNumber(group.count)}'}，${'${facilityStatusLabel(group)}'}\`}',`,
  `  'data-status={group.status}',\n  'aria-label={\`${'${type.name}'}，数量 ${'${formatNumber(group.count)}'}，${'${facilityStatusLabel(group)}'}\`}',`,
  'factory selector construction requirements',
);
replaceExact(
  'scripts/verify-unified-factory-recipes-grid.mjs',
  `  'if (event.target === event.currentTarget) requestClose();',\n])`,
  `  'if (event.target === event.currentTarget) requestClose();',\n  'constructionOnly',\n  'FacilityConstructionAcceleration',\n])`,
  'factory detail acceleration forbids',
);

replaceExact(
  'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
  '2. 工厂详情中以 1 宝石减少当前唯一施工任务 30 分钟。',
  '2. “建设新工厂”卡中以 1 宝石减少当前唯一施工任务 30 分钟。',
  'gem design feature location',
);
replaceExact(
  'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
  '- 工厂详情公开 `gemAccelerationMs` 与 `gemAccelerationCost` 供客户端预览；实际扣费和完成时间必须由服务器重新计算。\n- 施工中但尚无同类工厂时，生产页提供临时“施工中”工厂详情入口；该入口不计入运行、停止或异常集群统计。',
  '- “建设新工厂”卡在存在施工任务时公开 `gemAccelerationMs` 与 `gemAccelerationCost`，并显示当前剩余时间、使用后剩余时间和权威加速按钮；实际扣费和完成时间必须由服务器重新计算。\n- 工厂集群选择器与桌面／移动工厂详情只展示当前已经拥有且 `count > 0` 的工厂集群，不得为施工任务创建临时工厂详情入口。',
  'gem design UI location rules',
);
replaceExact(
  'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
  '浏览器本地完成施工或不写审计的宝石扣费。',
  '浏览器本地完成施工、不写审计的宝石扣费、把宝石加速入口移回工厂详情或为施工任务恢复临时工厂详情卡。',
  'gem design anti rollback location',
);

replaceExact(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '工厂详情允许消耗 **1 宝石减少当前施工 30 分钟**。',
  '“建设新工厂”卡在存在施工任务时允许消耗 **1 宝石减少当前施工 30 分钟**。',
  'product gem acceleration location',
);

replaceExact(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '施工任务不进入标题区状态汇总；建设卡继续显示当前施工任务、施工状态和剩余时间，概览施工提醒也继续保留。',
  '施工任务不进入标题区状态汇总；建设卡统一显示当前施工任务、施工状态、剩余时间、1 宝石减少 30 分钟的预览与权威按钮，概览施工提醒也继续保留。',
  'page construction summary location',
);
replaceExact(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '- 当前施工任务；\n- 产成品直接入仓；',
  '- 当前施工任务、剩余时间与宝石加速；\n- 产成品直接入仓；',
  'page build card requirements',
);
replaceExact(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '当前施工属于对应工厂类型详情；详情显示剩余时间、1 宝石减少 30 分钟的服务器报价和权威按钮。尚无同类工厂时提供临时“施工中”详情入口，但不计入运行／停止／异常集群统计。',
  '当前施工与宝石加速唯一归属“建设新工厂”卡。工厂集群选择器、桌面详情和移动底部详情只展示已拥有且 `count > 0` 的工厂，不得显示施工剩余时间、宝石加速按钮或临时“施工中”详情入口。',
  'page factory detail acceleration rule',
);

replaceExact(
  'README.md',
  '→ 在工厂详情使用 1 宝石减少当前施工 30 分钟',
  '→ 在建设新工厂卡使用 1 宝石减少当前施工 30 分钟',
  'readme gameplay loop acceleration location',
);
replaceExact(
  'README.md',
  '商店按每日终端报价单向兑换普通货币；工厂详情允许 1 宝石减少当前施工 30 分钟。',
  '商店按每日终端报价单向兑换普通货币；建设新工厂卡在施工期间允许 1 宝石减少当前施工 30 分钟。',
  'readme key acceleration location',
);

console.log('gem acceleration entry moved to the build card');
