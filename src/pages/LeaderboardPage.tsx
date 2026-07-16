import type { LoadedGameViewModel } from '../app/gameViewModel';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import {
  MetricCard,
  PageLayout,
  Panel,
  ScrollableTable,
  StatusTag,
} from '../components/ui/layout';
import { formatCurrency, formatNumber, formatRank, formatTime } from '../utils/formatters';

export function LeaderboardPage({ model }: { model: LoadedGameViewModel }) {
  const { game, derived } = model;
  const weeklyChange = derived.currentRank?.weeklyChange ?? 0;
  const currentRank = derived.currentRank?.rank;

  return (
    <PageLayout
      title="总资产排行榜"
      description="排行榜按服务器计算的总资产从高到低排序，挂牌溢价不计入估值。"
      actions={<StatusTag>更新于 {formatTime(game.lastProcessedAt)}</StatusTag>}
    >
      <div className="rank-summary-grid">
        <MetricCard
          tone="success"
          className="rank-summary primary"
          label="我的排名"
          value={<span aria-label={currentRank ? `排名第 ${currentRank} 名` : '暂无排名'}>{formatRank(currentRank)}</span>}
          detail={<>总资产 <CurrencyAmount>{formatCurrency(derived.totalAssets)}</CurrencyAmount></>}
        />
        <MetricCard
          className="rank-summary"
          label="与上一名差距"
          value={derived.previousRank ? <CurrencyAmount>{formatCurrency(derived.previousRank.totalAssets - derived.totalAssets)}</CurrencyAmount> : '榜首'}
          detail={derived.previousRank?.playerName ?? '保持领先'}
        />
        <MetricCard
          tone={weeklyChange >= 0 ? 'success' : 'danger'}
          className="rank-summary"
          label="本周资产变化"
          value={<CurrencyAmount sign={weeklyChange >= 0 ? '+' : undefined}>{formatCurrency(weeklyChange)}</CurrencyAmount>}
          detail="基于当前预览周期"
        />
      </div>
      <Panel className="leaderboard-card">
        <ScrollableTable>
          <table className="leaderboard-table">
            <thead><tr><th>排名</th><th>玩家</th><th className="numeric-cell">总资产</th><th className="numeric-cell">现金资产</th><th className="numeric-cell">生产设施</th><th className="numeric-cell">本周变化</th><th>更新时间</th></tr></thead>
            <tbody>
              {game.leaderboard.map((entry) => (
                <tr key={`${entry.playerName}-${entry.rank}`} className={entry.isCurrentPlayer ? 'current-player-row' : ''}>
                  <td><span className={`rank-number rank-${entry.rank}`} aria-label={`排名第 ${entry.rank} 名`}>{formatRank(entry.rank)}</span></td>
                  <td><strong>{entry.playerName}</strong>{entry.isCurrentPlayer ? <StatusTag tone="success" className="you-label">你</StatusTag> : null}</td>
                  <td className="numeric-cell"><strong><CurrencyAmount>{formatCurrency(entry.totalAssets)}</CurrencyAmount></strong></td>
                  <td className="numeric-cell"><CurrencyAmount>{formatCurrency(entry.cashAssets)}</CurrencyAmount></td>
                  <td className="numeric-cell">{formatNumber(entry.facilityCount)}</td>
                  <td className={`numeric-cell ${entry.weeklyChange >= 0 ? 'positive' : 'negative'}`}><CurrencyAmount sign={entry.weeklyChange >= 0 ? '+' : undefined}>{formatCurrency(entry.weeklyChange)}</CurrencyAmount></td>
                  <td>{formatTime(entry.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </Panel>
    </PageLayout>
  );
}
