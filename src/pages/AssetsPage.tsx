import type { LoadedGameViewModel } from '../app/gameViewModel';
import {
  Button,
  DataList,
  DataRow,
  MetricCard,
  PageLayout,
  Panel,
  WidgetHeading,
} from '../components/ui/layout';
import { ledgerCategoryNames } from '../config/labels';
import { formatCurrency, formatTime } from '../utils/formatters';

export function AssetsPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
    derived,
    cashShare,
    commodityShare,
    facilityShare,
    allocationStyle,
    inventoryUsed,
    setSelectedProductId,
    setTab,
  } = model;

  return (
    <PageLayout
      title="资产"
      description="查看现金、各类商品、工厂与冻结资产的服务器估值。"
    >
      <div className="asset-overview-grid">
        <Panel className="widget allocation-card">
          <WidgetHeading title="资产配置" action={<strong>¤ {formatCurrency(derived.totalAssets)}</strong>} />
          <div className="allocation-visual" style={allocationStyle}><div><strong>{cashShare}%</strong><span>现金占比</span></div></div>
          <div className="allocation-legend">
            <span><i className="cash-dot" />现金 <strong>{cashShare}%</strong></span>
            <span><i className="commodity-dot" />商品 <strong>{commodityShare}%</strong></span>
            <span><i className="facility-dot" />工厂 <strong>{facilityShare}%</strong></span>
          </div>
        </Panel>

        <Panel className="widget asset-breakdown span-2">
          <WidgetHeading title="资产估值明细" action={<span className="muted">按各商品最近成交价和工厂系统估值计算</span>} />
          <div className="asset-card-grid">
            <MetricCard label="可用现金" value={`¤ ${formatCurrency(game.credits)}`} detail="可用于建设、运营和交易" tone="success" />
            <MetricCard label="冻结资金" value={`¤ ${formatCurrency(game.frozenCredits)}`} detail="用于未成交买单" tone="warning" />
            <MetricCard label="全部商品估值" value={`¤ ${formatCurrency(derived.commodityValue)}`} detail={`仓库 ${inventoryUsed}/${game.inventoryCapacity}`} />
            <MetricCard label="工厂资产估值" value={`¤ ${formatCurrency(derived.facilityValue)}`} detail={`${game.facilities.length} 座工厂及内部产成品`} tone="info" />
          </div>
        </Panel>

        <Panel className="widget span-3">
          <WidgetHeading title="商品库存与估值" action={<span className="muted">点击商品进入对应市场</span>} />
          <div className="product-asset-grid">
            {game.products.map((product) => {
              const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
              const price = game.markets[product.id]?.lastPrice ?? product.basePrice;
              const value = (inventory.available + inventory.frozen) * price;
              return (
                <button
                  type="button"
                  className="product-asset-card"
                  key={product.id}
                  onClick={() => {
                    setSelectedProductId(product.id);
                    setTab('market');
                  }}
                >
                  <span>{product.name}</span>
                  <strong>¤ {formatCurrency(value)}</strong>
                  <small>可用 {inventory.available} · 冻结 {inventory.frozen} · 参考价 ¤ {price}</small>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel className="widget">
          <WidgetHeading title="货币发行与回收" />
          <DataList>
            <DataRow label="工作发行" value={`+¤ ${game.stats.workIssued}`} tone="success" />
            <DataRow label="需求发行" value={`+¤ ${game.stats.populationIssued}`} tone="success" />
            <DataRow label="系统回收" value={`-¤ ${game.stats.systemSinks}`} tone="danger" />
            <DataRow label="当前净变化" value={`¤ ${formatCurrency(game.stats.workIssued + game.stats.populationIssued - game.stats.systemSinks)}`} />
          </DataList>
        </Panel>

        <Panel className="widget span-2">
          <WidgetHeading
            title="最近资产变化"
            action={<Button variant="text" onClick={() => setTab('records')}>完整流水</Button>}
          />
          <div className="ledger-list compact-ledger">
            {game.ledger.slice(0, 8).map((entry) => (
              <div key={entry.id}>
                <span className="ledger-time">{formatTime(entry.createdAt)}</span>
                <div><strong>{entry.description}</strong><small>{ledgerCategoryNames[entry.category]}</small></div>
                <span className={entry.amount > 0 ? 'positive' : entry.amount < 0 ? 'negative' : ''}>
                  {entry.amount > 0 ? '+' : ''}{entry.amount ? `¤ ${entry.amount}` : '状态'}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
}
