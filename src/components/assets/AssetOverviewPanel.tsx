import { CompactCurrency, CompactNumber } from '../ui/CompactNumber';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { AssetAllocationChart } from '../charts/AssetAllocationChart';
import { PagePanel, WidgetHeading } from '../ui/layout';
import { buildAssetAllocation } from '../../utils/assetAllocation';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import '../../styles/entity-list-header.css';

export function AssetOverviewPanel({ model }: { model: LoadedGameViewModel }) {
  const { game, derived } = model;
  const commercialValue = game.assetSummary.commercialValue ?? 0;
  const commercialBuildingCount = ((game as typeof game & {
    commercialBuildingGroups?: Array<{ count: number }>;
  }).commercialBuildingGroups ?? []).reduce(
    (sum, group) => sum + Math.max(0, Number(group.count || 0)),
    0,
  );
  const { cashShare, commodityShare, facilityShare } = buildAssetAllocation(
    derived.cashValue,
    derived.commodityValue,
    derived.facilityValue + commercialValue,
  );
  const frozenInventory = Object.values(game.inventories).reduce((sum, inventory) => sum + inventory.frozen, 0);
  const totalFacilities = game.facilityGroups.reduce((sum, group) => sum + group.count, 0);
  const frozenFacilities = game.facilityGroups.reduce((sum, group) => sum + Number(group.frozenCount || 0), 0);
  const mortgagedFacilities = game.facilityGroups.reduce((sum, group) => sum + Number(group.mortgagedCount || 0), 0);
  const frozenAssetValue = game.assetSummary.frozenAssetValue ?? game.frozenCredits;
  const availableAssetValue = game.assetSummary.availableAssetValue ?? (derived.totalAssets - frozenAssetValue);
  const grossAssetValue = game.assetSummary.grossAssetValue ?? (derived.totalAssets + (game.assetSummary.liabilityValue || 0));
  const liabilityValue = game.assetSummary.liabilityValue ?? 0;
  const bankDepositValue = game.assetSummary.bankDepositValue ?? game.bankAccount.depositCredits;
  const availableCommodityValue = game.assetSummary.availableCommodityValue ?? derived.commodityValue;
  const frozenCommodityValue = game.assetSummary.frozenCommodityValue ?? 0;
  const availableFacilityValue = game.assetSummary.availableFacilityValue ?? derived.facilityValue;
  const mortgagedFacilityValue = game.assetSummary.mortgagedFacilityValue ?? 0;
  const frozenFacilityValue = game.assetSummary.frozenFacilityValue ?? 0;

  return (
    <PagePanel className="asset-overview-card">
      <WidgetHeading
        title="资产总览"
        action={<span className="muted">商品按当日官方价、工厂按最近产权成交价、商业建筑按目录系统价值估值</span>}
      />

      <div className="asset-overview-body">
        <section className="asset-total-summary" aria-label="当前净资产">
          <span className="asset-summary-label">当前净资产</span>
          <strong className="asset-total-value">
            <CurrencyAmount>{formatCurrency(derived.totalAssets)}</CurrencyAmount>
          </strong>
          <div className="asset-total-splits">
            <span>
              <small>可支配净资产</small>
              <strong><CurrencyAmount>{formatCurrency(availableAssetValue)}</CurrencyAmount></strong>
            </span>
            <span>
              <small>资产毛值</small>
              <strong><CurrencyAmount>{formatCurrency(grossAssetValue)}</CurrencyAmount></strong>
            </span>
            <span>
              <small>贷款负债</small>
              <strong><CurrencyAmount>{formatCurrency(liabilityValue)}</CurrencyAmount></strong>
            </span>
            <span>
              <small>冻结资产</small>
              <strong><CurrencyAmount>{formatCurrency(frozenAssetValue)}</CurrencyAmount></strong>
            </span>
          </div>
        </section>

        <section className="asset-allocation-summary" aria-label="资产配置比例">
          <AssetAllocationChart
            cash={derived.cashValue}
            commodities={derived.commodityValue}
            facilities={derived.facilityValue + commercialValue}
          />
          <div className="allocation-legend">
            <span><i className="cash-dot" />现金 <strong>{cashShare}%</strong></span>
            <span><i className="commodity-dot" />商品 <strong>{commodityShare}%</strong></span>
            <span><i className="facility-dot" />建筑 <strong>{facilityShare}%</strong></span>
          </div>
        </section>

        <section className="asset-composition-section" aria-labelledby="asset-composition-title">
          <h3 id="asset-composition-title">资产构成</h3>
          <div className="asset-composition-table" role="table" aria-label="资产构成明细">
            <div className="entity-list-header asset-composition-header" role="row">
              <span role="columnheader">类型</span>
              <span role="columnheader">总计</span>
              <span role="columnheader">可用</span>
              <span role="columnheader">冻结</span>
            </div>
            <div
              className="asset-composition-row cash"
              role="row"
              aria-label={`现金，总计 ${formatCurrency(derived.cashValue)}，可用与存款 ${formatCurrency(game.credits + bankDepositValue)}，冻结 ${formatCurrency(game.frozenCredits)}，其中银行存款 ${formatCurrency(bankDepositValue)}`}
            >
              <span className="asset-composition-name" role="cell"><i className="cash-dot" /><span>现金<small>银行存款 {<CompactCurrency value={bankDepositValue} />}</small></span></span>
              <strong role="cell" data-label="总计"><CurrencyAmount>{formatCurrency(derived.cashValue)}</CurrencyAmount></strong>
              <span role="cell" data-label="可用"><CurrencyAmount>{formatCurrency(game.credits + bankDepositValue)}</CurrencyAmount></span>
              <span role="cell" data-label="冻结"><CurrencyAmount>{formatCurrency(game.frozenCredits)}</CurrencyAmount></span>
            </div>
            <div
              className="asset-composition-row commodity"
              role="row"
              aria-label={`商品，总计 ${formatCurrency(derived.commodityValue)}，可用 ${formatCurrency(availableCommodityValue)}，冻结 ${formatCurrency(frozenCommodityValue)}，冻结数量 ${formatNumber(frozenInventory)}`}
            >
              <span className="asset-composition-name" role="cell">
                <i className="commodity-dot" />
                <span>商品<small>冻结数量 {<CompactNumber value={frozenInventory} />}</small></span>
              </span>
              <strong role="cell" data-label="总计"><CurrencyAmount>{formatCurrency(derived.commodityValue)}</CurrencyAmount></strong>
              <span role="cell" data-label="可用"><CurrencyAmount>{formatCurrency(availableCommodityValue)}</CurrencyAmount></span>
              <span role="cell" data-label="冻结"><CurrencyAmount>{formatCurrency(frozenCommodityValue)}</CurrencyAmount></span>
            </div>
            <div
              className="asset-composition-row facility"
              role="row"
              aria-label={`工厂，总计 ${formatCurrency(derived.facilityValue)}，可转让 ${formatCurrency(availableFacilityValue)}，抵押 ${formatCurrency(mortgagedFacilityValue)}，交易冻结 ${formatCurrency(frozenFacilityValue)}，冻结 ${formatNumber(frozenFacilities)} 座，抵押 ${formatNumber(mortgagedFacilities)} 座，共 ${formatNumber(totalFacilities)} 座`}
            >
              <span className="asset-composition-name" role="cell">
                <i className="facility-dot" />
                <span>工厂<small>交易冻结 {<CompactNumber value={frozenFacilities} />} · 抵押 {<CompactNumber value={mortgagedFacilities} />} · 共 {<CompactNumber value={totalFacilities} />}</small></span>
              </span>
              <strong role="cell" data-label="总计"><CurrencyAmount>{formatCurrency(derived.facilityValue)}</CurrencyAmount></strong>
              <span role="cell" data-label="可用"><CurrencyAmount>{formatCurrency(availableFacilityValue)}</CurrencyAmount></span>
              <span role="cell" data-label="冻结"><CurrencyAmount>{formatCurrency(frozenFacilityValue + mortgagedFacilityValue)}</CurrencyAmount></span>
            </div>
            <div
              className="asset-composition-row commercial"
              role="row"
              aria-label={`商业建筑，总计 ${formatCurrency(commercialValue)}，可用 ${formatCurrency(commercialValue)}，冻结 ${formatCurrency(0)}，共 ${formatNumber(commercialBuildingCount)} 座`}
            >
              <span className="asset-composition-name" role="cell">
                <i className="facility-dot" />
                <span>商业建筑<small>共 {<CompactNumber value={commercialBuildingCount} />} 座</small></span>
              </span>
              <strong role="cell" data-label="总计"><CurrencyAmount>{formatCurrency(commercialValue)}</CurrencyAmount></strong>
              <span role="cell" data-label="可用"><CurrencyAmount>{formatCurrency(commercialValue)}</CurrencyAmount></span>
              <span role="cell" data-label="冻结"><CurrencyAmount>{formatCurrency(0)}</CurrencyAmount></span>
            </div>
          </div>
        </section>
      </div>

      <p className="ui-helper-text asset-freeze-note">冻结资产和抵押工厂仍归当前玩家所有并计入资产毛值；商业建筑第一版没有冻结、抵押或产权交易状态；贷款负债从资产毛值中扣除形成净资产。</p>
    </PagePanel>
  );
}
