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
  const { game, showResult, upgradeWarehouse } = model;
  const [submitting, setSubmitting] = useState(false);
  const atMaxLevel = game.warehouseLevel >= game.warehouseMaxLevel;
  const canAfford = game.warehouseUpgradeCost !== null && game.credits >= game.warehouseUpgradeCost;
  const overCapacity = game.warehouseUsedCapacity > game.inventoryCapacity;
  const usagePercent = game.inventoryCapacity > 0
    ? Math.min(100, Math.round((game.warehouseUsedCapacity / game.inventoryCapacity) * 100))
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
        action={
          <StatusTag tone={overCapacity ? 'danger' : atMaxLevel ? 'success' : 'info'}>
            {overCapacity ? '容量超限' : `等级 ${game.warehouseLevel}/${game.warehouseMaxLevel}`}
          </StatusTag>
        }
      />

      <div
        className="warehouse-capacity-progress"
        aria-label={`仓库已使用 ${game.warehouseUsedCapacity}/${game.inventoryCapacity}`}
      >
        <div>
          <span>仓库使用</span>
          <strong>{game.warehouseUsedCapacity}/{game.inventoryCapacity}</strong>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${usagePercent}%` }} />
        </div>
        <small>
          {usagePercent}% 已使用 · 实物 {game.warehouseStoredQuantity} · 买单预占 {game.warehouseReservedQuantity} · 可用 {game.warehouseAvailableCapacity} · 所有商品共用容量
        </small>
      </div>

      {!compact ? (
        <div className="warehouse-upgrade-metrics">
          <MetricCard label="当前容量" value={game.inventoryCapacity} />
          <MetricCard label="实物库存" value={game.warehouseStoredQuantity} />
          <MetricCard
            label="买单预占"
            value={game.warehouseReservedQuantity}
            detail="未完成买单剩余数量"
            tone={game.warehouseReservedQuantity > 0 ? 'warning' : 'neutral'}
          />
          <MetricCard
            label="剩余容量"
            value={game.warehouseAvailableCapacity}
            tone={game.warehouseAvailableCapacity > 0 ? 'success' : 'danger'}
          />
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
          <strong>
            {overCapacity
              ? '当前占用超过容量，扩容前不能继续增加库存或新建买单'
              : atMaxLevel
                ? '仓库已经达到最高等级'
                : `下一等级增加 ${game.warehouseNextCapacity - game.inventoryCapacity} 容量`}
          </strong>
          <small>
            {atMaxLevel
              ? '无需继续扩容'
              : `费用随等级递增，当前可用资金 ¤ ${formatCurrency(game.credits)}`}
          </small>
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
