import type { CSSProperties } from 'react';

export function MarketBalanceBar({
  buyVolume,
  sellVolume,
  className = '',
}: {
  buyVolume: number;
  sellVolume: number;
  className?: string;
}) {
  const safeBuy = Math.max(0, Number(buyVolume) || 0);
  const safeSell = Math.max(0, Number(sellVolume) || 0);
  const total = safeBuy + safeSell;
  const balance = safeSell - safeBuy;
  const direction = total <= 0 ? 'inactive' : balance > 0 ? 'sell' : balance < 0 ? 'buy' : 'balanced';
  const fill = total > 0 ? Math.round(Math.min(1, Math.abs(balance) / total) * 50) : 0;
  const label = total <= 0
    ? '当前没有买卖挂单'
    : balance > 0
      ? '卖单比买单多 ' + Math.abs(balance)
      : balance < 0
        ? '买单比卖单多 ' + Math.abs(balance)
        : '买卖挂单数量相同';
  return (
    <span
      className={'market-balance-bar' + (className ? ' ' + className : '')}
      data-direction={direction}
      role="img"
      aria-label={label}
      style={{ '--market-balance-fill': fill + '%' } as CSSProperties}
    >
      <span className="market-balance-bar__fill" aria-hidden="true" />
    </span>
  );
}

export function MarketCoverageBar({
  tradedCount,
  unmetDemandCount,
  totalCount,
}: {
  tradedCount: number;
  unmetDemandCount: number;
  totalCount: number;
}) {
  const safeTotal = Math.max(0, Number(totalCount) || 0);
  const tradedCoverage = safeTotal > 0 ? Math.min(100, Math.round((Math.max(0, tradedCount) / safeTotal) * 100)) : 0;
  const unmetCoverage = safeTotal > 0 ? Math.min(100, Math.round((Math.max(0, unmetDemandCount) / safeTotal) * 100)) : 0;
  return (
    <span
      className="market-coverage-bar"
      role="img"
      aria-label={'真实成交覆盖 ' + tradedCount + ' 个地区；需求未满足 ' + unmetDemandCount + ' 个地区'}
      style={{
        '--market-traded-coverage': tradedCoverage + '%',
        '--market-unmet-coverage': unmetCoverage + '%',
      } as CSSProperties}
    >
      <span className="market-coverage-bar__track market-coverage-bar__track--traded" aria-hidden="true"><span /></span>
      <span className="market-coverage-bar__track market-coverage-bar__track--unmet" aria-hidden="true"><span /></span>
    </span>
  );
}
