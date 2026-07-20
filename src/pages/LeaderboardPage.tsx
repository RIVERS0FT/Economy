import type { ReactNode } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { PageLayout, Panel, StatusTag } from '../components/ui/layout';
import {
  leaderboardsFromGame,
  type LeaderboardBoardId,
  type RankedLeaderboardBoard,
  type RankedLeaderboardEntry,
  type RankedLeaderboardsState,
} from '../leaderboardTypes';
import { formatCurrency, formatNumber, formatRank } from '../utils/formatters';

const BOARD_ORDER: LeaderboardBoardId[] = ['wealth', 'growth', 'production', 'trading'];
const FALLBACK_TITLES: Record<LeaderboardBoardId, string> = {
  wealth: '财富榜',
  growth: '增长榜',
  production: '生产榜',
  trading: '交易榜',
};

function formatPeriodTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

function fallbackLeaderboards(model: LoadedGameViewModel): RankedLeaderboardsState {
  const { game } = model;
  const wealthEntries = game.leaderboard.slice(0, 10).map((entry) => ({
    rank: entry.rank,
    playerName: entry.playerName,
    score: entry.totalAssets,
    secondary: entry.cashAssets,
    detail: `${formatNumber(entry.facilityCount)} 座工厂`,
    isCurrentPlayer: entry.isCurrentPlayer,
  }));
  const wealthCurrent = game.leaderboard.find((entry) => entry.isCurrentPlayer);
  const emptyBoard = (id: LeaderboardBoardId): RankedLeaderboardBoard => ({
    id,
    title: FALLBACK_TITLES[id],
    description: '周榜数据正在由服务器初始化',
    unit: id === 'growth' ? 'currency' : 'points',
    rewarded: id !== 'wealth',
    entries: [],
    currentPlayer: null,
    totalPlayers: game.leaderboard.length,
  });
  return {
    period: {
      key: 'initializing',
      startsAt: game.lastProcessedAt,
      endsAt: game.lastProcessedAt,
      partial: true,
      rewardEnabled: false,
      rewards: [30, 20, 10],
      timeZone: 'Asia/Taipei',
    },
    boards: {
      wealth: {
        id: 'wealth',
        title: '财富榜',
        description: '按最近一次订单簿真实成交价计算的实时总资产',
        unit: 'currency',
        rewarded: false,
        entries: wealthEntries,
        currentPlayer: wealthCurrent ? {
          rank: wealthCurrent.rank,
          playerName: wealthCurrent.playerName,
          score: wealthCurrent.totalAssets,
          secondary: wealthCurrent.cashAssets,
          detail: `${formatNumber(wealthCurrent.facilityCount)} 座工厂`,
          isCurrentPlayer: true,
        } : null,
        totalPlayers: game.leaderboard.length,
      },
      growth: emptyBoard('growth'),
      production: emptyBoard('production'),
      trading: emptyBoard('trading'),
    },
  };
}

function scoreValue(board: RankedLeaderboardBoard, score: number): ReactNode {
  if (board.unit === 'currency') {
    return <CurrencyAmount sign={board.id === 'growth' && score > 0 ? '+' : undefined}>{formatCurrency(score)}</CurrencyAmount>;
  }
  return `${formatNumber(score)} 分`;
}

function LeaderboardRow({ board, entry }: { board: RankedLeaderboardBoard; entry: RankedLeaderboardEntry }) {
  return (
    <li
      className={entry.isCurrentPlayer ? 'leaderboard-row current-player-row' : 'leaderboard-row'}
      aria-label={entry.detail ? `${entry.playerName}，${entry.detail}` : undefined}
    >
      <span className={`rank-number rank-${entry.rank}`} aria-label={`排名第 ${entry.rank} 名`}>{formatRank(entry.rank)}</span>
      <span className="leaderboard-player">
        <strong>{entry.playerName}</strong>
        {entry.isCurrentPlayer ? <StatusTag tone="success">你</StatusTag> : null}
      </span>
      <strong className="leaderboard-score">{scoreValue(board, entry.score)}</strong>
      {entry.rewardGems ? <span className="leaderboard-reward">◆ {entry.rewardGems}</span> : null}
    </li>
  );
}

function LeaderboardCard({ board, period }: { board: RankedLeaderboardBoard; period: RankedLeaderboardsState['period'] }) {
  const current = board.currentPlayer;
  const currentRank = current?.rank;
  return (
    <Panel className="leaderboard-board-card">
      <header className="leaderboard-board-heading">
        <div>
          <h2>{board.title}</h2>
          <p>{board.description}</p>
        </div>
        {board.rewarded ? (
          <StatusTag tone={period.rewardEnabled ? 'warning' : 'neutral'}>
            {period.rewardEnabled ? '前三名奖励' : '测试周'}
          </StatusTag>
        ) : <StatusTag>实时</StatusTag>}
      </header>

      <div className="leaderboard-column-labels" aria-hidden="true">
        <span>排名</span><span>玩家</span><span>成绩</span>
      </div>
      {board.entries.length > 0 ? (
        <ol className="leaderboard-list">
          {board.entries.map((entry) => <LeaderboardRow key={`${board.id}-${entry.rank}-${entry.playerName}`} board={board} entry={entry} />)}
        </ol>
      ) : <div className="leaderboard-empty">本周暂无成绩</div>}

      <footer className="leaderboard-current-player">
        <div>
          <span>我的排名</span>
          <strong>{formatRank(currentRank)}</strong>
        </div>
        <div>
          <span>我的成绩</span>
          <strong>{current ? scoreValue(board, current.score) : '暂无'}</strong>
        </div>
      </footer>
    </Panel>
  );
}

export function LeaderboardPage({ model }: { model: LoadedGameViewModel }) {
  const leaderboards = leaderboardsFromGame(model.game) ?? fallbackLeaderboards(model);
  const { period } = leaderboards;
  const periodLabel = period.key === 'initializing'
    ? '周榜初始化中'
    : `${formatPeriodTime(period.startsAt)} — ${formatPeriodTime(period.endsAt)}`;

  return (
    <PageLayout
      title="排行榜"
      description="四榜并列展示；财富榜实时更新，增长榜、生产榜和交易榜按台北时间每周一 00:00 结算。"
      actions={<StatusTag tone={period.partial ? 'neutral' : 'success'}>{period.partial ? '首个不完整周不发奖' : periodLabel}</StatusTag>}
    >
      <div className="leaderboard-grid-scroll" role="region" aria-label="四个排行榜" tabIndex={0}>
        <div className="leaderboard-grid">
          {BOARD_ORDER.map((boardId) => (
            <LeaderboardCard key={boardId} board={leaderboards.boards[boardId]} period={period} />
          ))}
        </div>
      </div>
      <p className="leaderboard-period-note">
        {period.partial
          ? '当前为首次上线测试周期，仅记录排名；下一个完整周开始按 30 / 20 / 10 宝石发放前三名奖励。'
          : `本期 ${periodLabel}；同一玩家可以在多个周榜分别获奖。`}
      </p>
    </PageLayout>
  );
}
