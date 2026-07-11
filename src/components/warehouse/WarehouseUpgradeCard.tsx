import { useState } from 'react';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { Button, MetricCard, Panel, StatusTag, WidgetHeading } from '../ui/layout';
import { formatCurrency } from '../../utils/formatters';

export function WarehouseUpgradeCard({
  model,
  className = '',
  compact = false,
}: {
  model: LoadedGameViewModel;
  className?: string;
  compact?: boolean;
}) {
  const { game, inventoryUsed, showResult, upgradeWarehouse } = model;
  const [submitting, setSubmitting] = useState(false);
  const atMaxLevel = game.warehouseLevel >= game.warehouseMaxLevel;
  const canAfford = game.warehouseUpgradeCost !== null && game.credits >= game.warehouseUpgradeCost;
  const usagePercent = game.inventoryCapacity > 0
    ? Math.min(100, Math.round((inventoryUsed / game.inventoryCapacity) * 100))
    : 0;

  async function upgrade() {
    if (submitting || atMaxLevel) return;
    setSubmitting(true);
    try {
      await showResult(upgradeWarehouse());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel className={`warehouse-upgrade-card ${compact ? 'compact' : ''} ${className}`.trim()}>
      <WidgetHeading
        title="共享仓库"
        action={<StatusTag tone={atMaxLevel ? 'success' : 'info'}>等级 {game.warehouseLevel}/{game.warehouseMaxLevel}</StatusTag>}
      />

      <div className="warehouse-capacity-progress" aria-label={`仓库已使用 ${inventoryUsed}/${game.inventoryCapacity}`}>
        <div>
          <span>仓库使用</span>
          <strong>{inventoryUsed}/{game.inventoryCapacity}</strong>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${usagePercent}%` }} />
        </div>
        <small>{usagePercent}% 已使用 · 所有商品共用容量</small>
      </div>

      {!compact ? (
        <div className="warehouse-upgrade-metrics">
          <MetricCard label="当前容量" value={game.inventoryCapacity} />
          <MetricCard
            label={atMaxLevel ? '最高容量' : '扩容后容量'}
            value={atMaxLevel ? game.inventoryCapacity : game.warehouseNextCapacity}
            tone={atMaxLevel ? 'success' : 'info'}
          />
          <MetricCard
            label="本次扩容费用"
            value={atMaxLevel ? '已满级' : `¤ ${formatCurrency(game.warehouseUpgradeCost ?? 0)}`}
            tone={atMaxLevel ? 'success' : 'warning'}
          />
        </div>
      ) : null}

      <div className="warehouse-upgrade-action">
        <div>
          <strong>{atMaxLevel ? '仓库已经达到最高等级' : `下一等级增加 ${game.warehouseNextCapacity - game.inventoryCapacity} 容量`}</strong>
          <small>{atMaxLevel ? '无需继续扩容' : `费用随等级递增，当前可用资金 ¤ ${formatCurrency(game.credits)}`}</small>
        </div>
        <Button
          onClick={() => void upgrade()}
          disabled={submitting || atMaxLevel || !canAfford}
        >
          {submitting
            ? '正在扩容…'
            : atMaxLevel
              ? '已达最高等级'
              : canAfford
                ? `支付 ¤ ${formatCurrency(game.warehouseUpgradeCost ?? 0)} 扩容`
                : `资金不足 · 需要 ¤ ${formatCurrency(game.warehouseUpgradeCost ?? 0)}`}
        </Button>
      </div>
    </Panel>
  );
}
