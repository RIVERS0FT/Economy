import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'src/pages/BuildingsPage.tsx';
let source = readFileSync(path, 'utf8');
const replace = (pattern, replacement, label) => {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`未匹配建筑页清理片段: ${label}`);
  source = next;
};

replace(
  /import \{\n  cancelFacilityBuildProcurement,\n  createFacilityBuildProcurement,\n  getFacilityBuildProcurementQuote,\n\} from '\.\.\/api\/game';/,
  "import { getFacilityBuildProcurementQuote } from '../api/game';",
  'procurement api imports',
);
replace(
  "import { MoneyInput, SelectInput } from '../components/ui/FormControls';",
  "import { SelectInput } from '../components/ui/FormControls';",
  'MoneyInput import',
);
replace("import type { AssetOrder, FacilityGroup } from '../types';", "import type { FacilityGroup } from '../types';", 'AssetOrder import');
replace(/import \{\n  activeFacilityBuildProcurementGroups,[\s\S]*?\} from '\.\.\/utils\/facilityBuildProcurementGroups';\n/, '', 'procurement group import');
replace("import { openOrderLimitForCatalog } from '../config/economy';\n", '', 'open order limit import');
replace(/\nfunction normalizeOrderPrice\([\s\S]*?\n}\n\nfunction openOwnCommoditySell\([\s\S]*?\n}\n/, '\n', 'legacy procurement helpers');

replace(/\n  const \[procurementPriceDrafts,[\s\S]*?\n  const \[procurementQuoteState,/, '\n  const [procurementQuoteState,', 'procurement state prefix');
replace(/\n  const \[cancellingProcurementId,[^\n]*\n/, '\n', 'cancelling state');
replace(/\n  const procurementPriceContextRef = useRef\(''\);/, '', 'price context ref');

replace(/\n  useEffect\(\(\) => \{\n    setProcurementGroups\([\s\S]*?\n  \}, \[game\.orders, game\.userId\]\);\n/, '\n', 'procurement group effects');
replace(/\n      if \(procurementPriceContextRef\.current !== contextKey\) \{[\s\S]*?\n      \}\n/, '\n', 'quote price draft sync');

replace(/\n  const materialOrderPrices = Object\.fromEntries\([\s\S]*?\n  const maxOpenOrderCount = openOrderLimitForCatalog\(game\.products\.length, game\.facilityTypes\.length\);\n/, '\n', 'legacy order-derived procurement state');
replace(
  /  const buildDisabledReason = game\.credits < buildCashCost[\s\S]*?  const actionDisabledReason = needsProcurement && procurementQuote && !procurementQuote\.complete\n    \? procurementOrderDisabledReason\n    : buildDisabledReason;/,
  `  const buildDisabledReason = game.credits < buildCashCost\n    ? \`建造资金不足，还需要 \${formatCurrency(buildCashCost - game.credits)}。\`\n    : needsProcurement && procurementQuoteLoading\n      ? '正在获取当日官方价采购报价。'\n      : needsProcurement && procurementQuoteError\n        ? \`采购报价加载失败：\${procurementQuoteError}\`\n        : needsProcurement && !procurementQuote\n          ? '当日官方价采购报价尚未就绪。'\n          : needsProcurement && game.credits < estimatedTotalSpend\n            ? \`建造与采购总资金不足，预计需要 \${formatCurrency(estimatedTotalSpend)}。\`\n            : undefined;\n  const actionDisabledReason = buildDisabledReason;`,
  'build disabled reason',
);

replace(/\n  const submitBuildProcurementOrders = async \(\) => \{[\s\S]*?\n  const submitBuild = \(\) => \{/, '\n  const submitBuild = () => {', 'legacy procurement actions');
replace(
  /  const submitBuild = \(\) => \{[\s\S]*?\n  };\n  const orderById = new Map\(game\.orders\.map\(\(order\) => \[order\.id, order\]\)\);/,
  `  const submitBuild = () => {\n    if (actionDisabledReason) return;\n    if (!needsProcurement) {\n      void showResult(buildFacility(selectedType.id, buildQuantity));\n      return;\n    }\n    if (!procurementQuote) return;\n    void showResult(buildFacility(selectedType.id, buildQuantity, {\n      autoProcure: true,\n      maxProcurementTotal: procurementQuote.estimatedTotal,\n      materialPriceCaps: procurementQuote.materialPriceCaps,\n    }));\n  };`,
  'submit build',
);

source = source.replace("? '正在获取当前卖盘…'", "? '正在获取当日官方价…'");
source = source.replace(": procurementQuote?.complete\n              ? <CurrencyAmount>{formatCurrency(procurementQuote.estimatedTotal)}</CurrencyAmount>\n              : '卖盘不足 · 可挂买单'", ": procurementQuote\n              ? <CurrencyAmount>{formatCurrency(procurementQuote.estimatedTotal)}</CurrencyAmount>\n              : '报价尚未就绪'");
replace(/\n        \{needsProcurement && procurementQuote && !procurementQuote\.complete && invalidOrderPriceProductIds\.length === 0 \? \([\s\S]*?\n      <Button\n        block/, '\n      <Button\n        block', 'order price controls');
source = source.replace('disabled={Boolean(actionDisabledReason) || procurementPending || procurementQuoteLoading}', 'disabled={Boolean(actionDisabledReason) || procurementQuoteLoading}');
replace(
  /\{needsProcurement\n          \? procurementQuote\?\.complete[\s\S]*?: buildQuantity === 1\n            \? `立即建造\$\{selectedType\.name\}`\n            : `立即建造 \$\{buildQuantity\} 座\$\{selectedType\.name\}`}\n/,
  `{needsProcurement\n          ? buildQuantity === 1\n            ? \`一键购齐并建造\${selectedType.name}\`\n            : \`一键购齐并建造 \${buildQuantity} 座\${selectedType.name}\`\n          : buildQuantity === 1\n            ? \`立即建造\${selectedType.name}\`\n            : \`立即建造 \${buildQuantity} 座\${selectedType.name}\`}\n`,
  'build button label',
);
replace(
  /\{actionDisabledReason \?\? \(needsProcurement[\s\S]*?: <>提交后立即扣除\{selectedBuildInputs\.length === 0 \? '建造资金' : '资金与建造材料'\}，工厂直接加入同类集群；运行中的集群保持当前进度并重新计算满员率。<\/\>\)}/,
  `{actionDisabledReason ?? (needsProcurement\n          ? '提交时服务器按建造州各缺失材料的当日官方系统价即时购齐并建造；任一价格保护、资金或建设校验失败时整笔事务回滚，不产生待成交商品订单。'\n          : <>提交后立即扣除{selectedBuildInputs.length === 0 ? '建造资金' : '资金与建造材料'}，工厂直接加入同类集群；运行中的集群保持当前进度并重新计算满员率。</>)}`,
  'build helper text',
);
replace(/\n      \{procurementGroups\.length > 0 \? \([\s\S]*?\n      \) : null}\n    <\/PagePanel>/, '\n    </PagePanel>', 'procurement groups UI');

for (const token of ['procurementGroups', 'procurementPriceDrafts', 'procurementPending', 'cancellingProcurementId', 'openOrderLimitForCatalog', 'createFacilityBuildProcurement(', 'cancelFacilityBuildProcurement(', '<MoneyInput', '买单价格', '待采购', '取消全部', '交叉卖单']) {
  if (source.includes(token)) throw new Error(`建筑页仍残留挂单采购语义: ${token}`);
}
writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
if (existsSync('src/utils/facilityBuildProcurementGroups.ts')) unlinkSync('src/utils/facilityBuildProcurementGroups.ts');
for (const temp of ['scripts/codex-remove-build-procurement-orders-ui.mjs', '.github/workflows/codex-remove-build-procurement-orders-ui.yml']) {
  if (existsSync(temp)) unlinkSync(temp);
}
