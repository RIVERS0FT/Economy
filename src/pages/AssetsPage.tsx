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
    setTab,
  } = model;

  return (
    <PageLayout
      eyebrow="资产组合"
      title="资产"
      description="查看财富构成、系统估值和经济资金流。"
    >
      <div className="asset-overview-grid">
        <Panel className="widget allocation-card">
          <WidgetHeading eyebrow="资产配置" title="资产配置" action={<strong>¤ {formatCurrency(derived.totalAssets)}</strong>} />
          <div className="allocation-visual" style={allocationStyle}><div><strong>{cashShare}%</strong><span>现金占比</span></div></div>
          <div className="allocation-legend">
            <span><i className="cash-dot" />现金 <strong>{cashShare}%</strong></span>
            <span><i className="commodity-dot" />商品 <strong>{commodityShare}%</strong></span>
            <span><i className="facility-dot" />设施 <strong>{facilityShare}%</strong></span>
          </div>
        </Panel>

        <Panel className="widget asset-breakdown span-2">
          <WidgetHeading eyebrow="资产估值" title="资产估值明细" action={<span className="muted">使用市场参考价和设施系统估值</span>} />
          <div className="asset-card-grid">
            <MetricCard label="可用现金" value={`¤ ${formatCurrency(game.credits)}`} detail="立即可用于建造和交易" tone="success" />
            <MetricCard label="冻结资金" value={`¤ ${formatCurrency(game.frozenCredits)}`} detail="用于未成交买单" tone="warning" />
            <MetricCard label="商品库存估值" value={`¤ ${formatCurrency(derived.commodityValue)}`} detail={`${game.inventory + game.frozenInventory} × 参考价 ¤ ${game.marketPrice}`} />
            <MetricCard label="生产设施估值" value={`¤ ${formatCurrency(derived.facilityValue)}`} detail={`${game.facilities.length} 座设施及内部商品`} tone="info" />
          </div>
        </Panel>

        <Panel className="widget">
          <WidgetHeading eyebrow="经济资金流" title="货币发行与回收" />
          <DataList>
            <DataRow label="工作发行" value={`+¤ ${game.stats.workIssued}`} tone="success" />
            <DataRow label="人口发行" value={`+¤ ${game.stats.populationIssued}`} tone="success" />
            <DataRow label="系统回收" value={`-¤ ${game.stats.systemSinks}`} tone="danger" />
            <DataRow label="当前净变化" value={`¤ ${formatCurrency(game.stats.workIssued + game.stats.populationIssued - game.stats.systemSinks)}`} />
          </DataList>
        </Panel>

        <Panel className="widget span-2">
          <WidgetHeading
            eyebrow="资产动态"
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