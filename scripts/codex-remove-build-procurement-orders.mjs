import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'src/pages/BuildingsPage.tsx';
let source = readFileSync(path, 'utf8');
const replace = (from, to, label) => {
  if (!source.includes(from)) throw new Error(`缺少待替换文本: ${label}`);
  source = source.replace(from, to);
};
const replaceRegex = (pattern, to, label) => {
  if (!pattern.test(source)) throw new Error(`缺少待替换模式: ${label}`);
  pattern.lastIndex = 0;
  source = source.replace(pattern, to);
};

replace("import { CompactCurrency, CompactNumber } from '../components/ui/CompactNumber';", "import { CompactNumber } from '../components/ui/CompactNumber';", 'CompactCurrency import');
replace("import {\n  cancelFacilityBuildProcurement,\n  createFacilityBuildProcurement,\n  getFacilityBuildProcurementQuote,\n} from '../api/game';", "import { getFacilityBuildProcurementQuote } from '../api/game';", 'procurement api imports');
replace("import { MoneyInput, SelectInput } from '../components/ui/FormControls';", "import { SelectInput } from '../components/ui/FormControls';", 'MoneyInput import');
replace("  StatusTag,\n", '', 'StatusTag import');
replace("import type { AssetOrder, FacilityGroup } from '../types';", "import type { FacilityGroup } from '../types';", 'AssetOrder import');
replaceRegex(/import \{\n  activeFacilityBuildProcurementGroups,[\s\S]*?\} from '\.\.\/utils\/facilityBuildProcurementGroups';\n/, '', 'procurement group imports');
replace("import { openOrderLimitForCatalog } from '../config/economy';\n", '', 'open order limit import');
replaceRegex(/\nfunction normalizeOrderPrice\([\s\S]*?\n\}\n\nfunction openOwnCommoditySell\([\s\S]*?\n\}\n/, '\n', 'legacy order helpers');

replaceRegex(/  const \[procurementPriceDrafts,[\s\S]*?  const \[procurementQuoteState,/, '  const [procurementQuoteState,', 'legacy procurement states');
replace("  const [cancellingProcurementId, setCancellingProcurementId] = useState('');\n", '', 'cancel state');
replace("  const procurementPriceContextRef = useRef('');\n", '', 'price context ref');
replaceRegex(/\n  useEffect\(\(\) => \{\n    setProcurementGroups\([\s\S]*?\n  \}, \[game\.orders, game\.userId\]\);\n/, '\n', 'procurement group effects');
replaceRegex(/\n      if \(procurementPriceContextRef\.current !== contextKey\) \{[\s\S]*?\n      \}/, '', 'quote price draft initialization');

replaceRegex(/\n  const materialOrderPrices = [\s\S]*?  const maxOpenOrderCount = openOrderLimitForCatalog\(game\.products\.length, game\.facilityTypes\.length\);\n/, '\n', 'legacy buy-order calculations');
replaceRegex(/  const buildDisabledReason = [\s\S]*?  const actionDisabledReason = needsProcurement && procurementQuote && !procurementQuote\.complete\n    \? procurementOrderDisabledReason\n    : buildDisabledReason;/,
`  const buildDisabledReason = game.credits < buildCashCost
    ? \`建造资金不足，还需要 \${formatCurrency(buildCashCost - game.credits)}。\`
    : needsProcurement && procurementQuoteLoading
      ? '正在获取当日系统价采购报价。'
      : needsProcurement && procurementQuoteError
        ? \`采购报价加载失败：\${procurementQuoteError}\`
        : needsProcurement && !procurementQuote
          ? '当日系统价采购报价尚未就绪。'
          : needsProcurement && game.credits < estimatedTotalSpend
            ? \`建造与采购总资金不足，预计需要 \${formatCurrency(estimatedTotalSpend)}。\`
            : undefined;
  const actionDisabledReason = buildDisabledReason;`, 'build disabled rules');

replaceRegex(/\n  const submitBuildProcurementOrders = async \(\) => \{[\s\S]*?\n  const submitBuild = \(\) => \{[\s\S]*?\n  \};\n  const orderById = new Map\(game\.orders\.map\(\(order\) => \[order\.id, order\]\)\);/,
`\n  const submitBuild = () => {
    if (actionDisabledReason) return;
    if (!needsProcurement) {
      void showResult(buildFacility(selectedType.id, buildQuantity));
      return;
    }
    if (!procurementQuote) return;
    void showResult(buildFacility(selectedType.id, buildQuantity, {
      autoProcure: true,
      maxProcurementTotal: procurementQuote.estimatedTotal,
      materialPriceCaps: procurementQuote.materialPriceCaps,
    }));
  };`, 'legacy procurement actions');

replaceRegex(/        \{needsProcurement \? \(\n          <DataRow\n            label="预计采购"[\s\S]*?        \) : null\}\n        \{needsProcurement && procurementQuote && !procurementQuote\.complete && invalidOrderPriceProductIds\.length === 0 \? \([\s\S]*?        \) : null\}/,
`        {needsProcurement ? (
          <DataRow
            label="预计采购"
            value={procurementQuoteLoading
              ? '正在获取当日系统价…'
              : procurementQuoteError
                ? '报价加载失败'
                : procurementQuote
                  ? <CurrencyAmount>{formatCurrency(procurementQuote.estimatedTotal)}</CurrencyAmount>
                  : '报价尚未就绪'}
            tone={procurementQuote && !procurementQuoteError ? 'neutral' : 'danger'}
          />
        ) : null}
        {needsProcurement && procurementQuote ? (
          <DataRow
            label="预计总支出"
            value={<CurrencyAmount>{formatCurrency(estimatedTotalSpend)}</CurrencyAmount>}
            tone={game.credits >= estimatedTotalSpend ? 'neutral' : 'danger'}
          />
        ) : null}`, 'build quote rows');

replaceRegex(/\n      \{needsProcurement && procurementQuote && !procurementQuote\.complete \? \([\s\S]*?\n      \) : null\}\n\n      <Button/,
'\n\n      <Button', 'legacy material price inputs');

replaceRegex(/      <Button\n        block[\s\S]*?\n      \{procurementGroups\.length > 0 \? \([\s\S]*?\n      \) : null\}/,
`      <Button
        block
        disabled={Boolean(actionDisabledReason)}
        onClick={submitBuild}
      >
        {needsProcurement
          ? buildQuantity === 1
            ? \`一键购齐并建造\${selectedType.name}\`
            : \`一键购齐并建造 \${buildQuantity} 座\${selectedType.name}\`
          : buildQuantity === 1
            ? \`立即建造\${selectedType.name}\`
            : \`立即建造 \${buildQuantity} 座\${selectedType.name}\`}
      </Button>
      <small className="ui-helper-text">
        {actionDisabledReason ?? (needsProcurement
          ? '提交时服务器重新读取各缺失材料的当日官方系统价；任一价格超过确认上限、总额超限或资金不足时，全部采购与建造一起回滚，不创建任何待成交商品订单。'
          : <>提交后立即扣除{selectedBuildInputs.length === 0 ? '建造资金' : '资金与建造材料'}，工厂直接加入同类集群；运行中的集群保持当前进度并重新计算满员率。</>)}
      </small>`, 'build button and procurement groups');

writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
for (const target of [
  'scripts/codex-remove-build-procurement-orders.mjs',
  '.github/workflows/codex-remove-build-procurement-orders.yml',
]) if (existsSync(target)) unlinkSync(target);
