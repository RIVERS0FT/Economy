import type { LoadedGameViewModel } from '../app/gameViewModel';
import { PageLayout, Panel, ScrollableTable } from '../components/ui/layout';
import { formatCurrency, formatTime } from '../utils/formatters';

export function LeaderboardPage({ model }: { model: LoadedGameViewModel }) {
  const { game, derived } = model;

  return (
    <PageLayout
      eyebrow="Wealth competition"
      title="总资产排行榜"
      description="排行榜按服务器计算的总资产从高到低排序，挂牌溢价不计入估值。"
      actions={<span>更新于 {formatTime(game.lastProcessedAt)}</span>}
    >
      <div className="rank-summary-grid">
        <Panel className="rank-summary primary"><span>我的排名</span><strong>#{derived.currentRank?.rank ?? '--'}</strong><small>总资产 ¤ {formatCurrency(derived.totalAssets)}</small></Panel>
        <Panel className="rank-summary"><span>与上一名差距</span><strong>{derived.previousRank ? `¤ ${formatCurrency(derived.previousRank.totalAssets - derived.totalAssets)}` : '榜首'}</strong><small>{derived.previousRank?.playerName ?? '保持领先'}</small></Panel>
        <Panel className="rank-summary"><span>本周资产变化</span><strong className={(derived.currentRank?.weeklyChange ?? 0) >= 0 ? 'positive' : 'negative'}>{(derived.currentRank?.weeklyChange ?? 0) >= 0 ? '+' : ''}¤ {formatCurrency(derived.currentRank?.weeklyChange ?? 0)}</strong><small>基于当前预览周期</small></Panel>
      </div>
      <Panel className="leaderboard-card">
        <ScrollableTable>
          <table className="leaderboard-table">
            <thead><tr><th>排名</th><th>玩家</th><th>总资产</th><th>现金资产</th><th>生产设施</th><th>本周变化</th><th>更新时间</th></tr></thead>
            <tbody>
              {game.leaderboard.map((entry) => (
                <tr key={`${entry.playerName}-${entry.rank}`} className={entry.isCurrentPlayer ? 'current-player-row' : ''}>
                  <td><span className={`rank-number rank-${entry.rank}`}>{entry.rank}</span></td>
                  <td><strong>{entry.playerName}</strong>{entry.isCurrentPlayer ? <small className="you-label">你</small> : null}</td>
                  <td><strong>¤ {formatCurrency(entry.totalAssets)}</strong></td>
                  <td>¤ {formatCurrency(entry.cashAssets)}</td>
                  <td>{entry.facilityCount}</td>
                  <td className={entry.weeklyChange >= 0 ? 'positive' : 'negative'}>{entry.weeklyChange >= 0 ? '+' : ''}¤ {formatCurrency(entry.weeklyChange)}</td>
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
