from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    (ROOT / path).write_text(content, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one occurrence, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


def insert_after(path, marker, addition):
    replace_once(path, marker, marker + addition)


server = 'server/src/leaderboards.js'
replace_once(
    server,
    """  stats.leaderboardGemsIssued = safeNonNegativeInteger(player.stats.leaderboardGemsIssued);\n  return player.stats;\n}\n""",
    """  stats.leaderboardGemsIssued = safeNonNegativeInteger(player.stats.leaderboardGemsIssued);\n  if (!stats.leaderboardPersonalBests || typeof stats.leaderboardPersonalBests !== 'object' || Array.isArray(stats.leaderboardPersonalBests)) {\n    stats.leaderboardPersonalBests = {};\n  }\n  return player.stats;\n}\n\nfunction settledPersonalBestFor(player, boardId) {\n  const best = playerStats(player).leaderboardPersonalBests?.[boardId];\n  const score = Number(best?.score);\n  const periodKey = typeof best?.periodKey === 'string' ? best.periodKey : '';\n  return Number.isFinite(score) && periodKey ? { score, periodKey } : null;\n}\n\nfunction updatePersonalBest(player, boardId, score, periodKey) {\n  const normalizedScore = Number(score);\n  if (!Number.isFinite(normalizedScore) || typeof periodKey !== 'string' || !periodKey) return;\n  const stats = playerStats(player);\n  const current = settledPersonalBestFor(player, boardId);\n  if (current && normalizedScore <= current.score) return;\n  stats.leaderboardPersonalBests[boardId] = { score: normalizedScore, periodKey };\n}\n""",
)
replace_once(
    server,
    """    const current = rows.find((entry) => Number(entry.userId) === Number(currentUserId));\n    boards[boardId] = {\n      id: boardId,\n      ...definition,\n      entries: rows.slice(0, LEADERBOARD_TOP_LIMIT).map((entry) => publicEntry(entry, currentUserId, rewardEnabled)),\n      currentPlayer: current ? publicEntry(current, currentUserId, rewardEnabled) : null,\n      totalPlayers: rows.length,\n    };""",
    """    const current = rows.find((entry) => Number(entry.userId) === Number(currentUserId));\n    const currentPlayer = world.players?.[String(currentUserId)];\n    const personalBest = currentPlayer ? settledPersonalBestFor(currentPlayer, boardId) : null;\n    boards[boardId] = {\n      id: boardId,\n      ...definition,\n      entries: rows.slice(0, LEADERBOARD_TOP_LIMIT).map((entry) => publicEntry(entry, currentUserId, rewardEnabled)),\n      currentPlayer: current ? publicEntry(current, currentUserId, rewardEnabled) : null,\n      totalPlayers: rows.length,\n      personalBest: personalBest ? {\n        ...personalBest,\n        currentIsRecord: !state.partial && Boolean(current) && Number(current.score) > personalBest.score,\n      } : null,\n    };""",
)
replace_once(
    server,
    """  const historyBoards = {};\n  for (const boardId of REWARDED_BOARD_IDS) {\n    const rows = internalRowsFor(world, state, boardId).filter((entry) => entry.score > 0);""",
    """  const settledRowsByBoard = {};\n  for (const boardId of BOARD_IDS) {\n    const rows = internalRowsFor(world, state, boardId);\n    settledRowsByBoard[boardId] = rows;\n    if (!state.partial) {\n      for (const entry of rows) {\n        const player = world.players?.[String(entry.userId)];\n        if (player) updatePersonalBest(player, boardId, entry.score, state.periodKey);\n      }\n    }\n  }\n\n  const historyBoards = {};\n  for (const boardId of REWARDED_BOARD_IDS) {\n    const rows = settledRowsByBoard[boardId].filter((entry) => entry.score > 0);""",
)

replace_once(
    'src/leaderboardTypes.ts',
    """export interface RankedLeaderboardBoard {\n  id: LeaderboardBoardId;\n  title: string;\n  description: string;\n  unit: LeaderboardUnit;\n  rewarded: boolean;\n  entries: RankedLeaderboardEntry[];\n  currentPlayer: RankedLeaderboardEntry | null;\n  totalPlayers: number;\n}\n""",
    """export interface LeaderboardPersonalBest {\n  score: number;\n  periodKey: string;\n  currentIsRecord: boolean;\n}\n\nexport interface RankedLeaderboardBoard {\n  id: LeaderboardBoardId;\n  title: string;\n  description: string;\n  unit: LeaderboardUnit;\n  rewarded: boolean;\n  entries: RankedLeaderboardEntry[];\n  currentPlayer: RankedLeaderboardEntry | null;\n  totalPlayers: number;\n  personalBest?: LeaderboardPersonalBest | null;\n}\n""",
)

insert_after(
    'src/pages/LeaderboardPage.tsx',
    """      {personalGoal ? (\n        <div className=\"leaderboard-personal-goal\" aria-label={`${board.title}个人竞争目标`}>\n          <span>当前 {personalGoal.bandLabel}</span>\n          <strong>{personalGoal.targetLabel}</strong>\n          <small>{personalGoal.distance > 0 ? `距离目标还差 ${formatNumber(personalGoal.distance)} 名` : '当前目标已达成'}</small>\n        </div>\n      ) : null}\n""",
    """      <div className=\"leaderboard-personal-best\" aria-label={`${board.title}个人最好成绩`}>\n        <span>个人最好</span>\n        <strong>{board.personalBest ? scoreValue(board, board.personalBest.score) : '暂无已结算纪录'}</strong>\n        <small>{board.personalBest\n          ? board.personalBest.currentIsRecord\n            ? '本周已刷新个人纪录'\n            : `最好结算周 ${board.personalBest.periodKey}`\n          : '完整周结算后开始记录'}</small>\n      </div>\n""",
)

styles = 'src/styles/leaderboards.css'
insert_after(
    styles,
    """.leaderboard-personal-goal > small {\n  text-align: right;\n}\n""",
    """\n.leaderboard-personal-best {\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr) auto;\n  align-items: center;\n  gap: var(--space-2);\n  padding: var(--space-2) var(--space-3);\n  border: 1px solid var(--border-subtle);\n  border-radius: var(--radius-md);\n  background: var(--surface-muted);\n}\n\n.leaderboard-personal-best > span,\n.leaderboard-personal-best > small {\n  color: var(--text-muted);\n}\n\n.leaderboard-personal-best > small {\n  text-align: right;\n}\n""",
)
insert_after(
    styles,
    """  .leaderboard-personal-goal > small {\n    grid-column: 1 / -1;\n    text-align: left;\n  }\n""",
    """  .leaderboard-personal-best {\n    grid-template-columns: auto 1fr;\n  }\n  .leaderboard-personal-best > small {\n    grid-column: 1 / -1;\n    text-align: left;\n  }\n""",
)

test_path = 'server/test/leaderboards.test.js'
insert_after(
    test_path,
    """  assert.equal(new Set(ledgerEvents.map((event) => event.sourceKey)).size, 9);\n""",
    """  assert.equal(players[0].stats.leaderboardPersonalBests.growth.score, 300);\n  assert.equal(players[0].stats.leaderboardPersonalBests.production.score, 30);\n  assert.equal(players[0].stats.leaderboardPersonalBests.trading.score, 300);\n  assert.equal(players[0].stats.leaderboardPersonalBests.production.periodKey, state.periodKey);\n\n  const settledSnapshot = createLeaderboardSnapshot(world, 1, state.endsAt + 1);\n  assert.equal(settledSnapshot.boards.production.personalBest.score, 30);\n  assert.equal(settledSnapshot.boards.production.personalBest.currentIsRecord, false);\n  world.leaderboardState.production['1'] = { score: 31, quantity: 31 };\n  const recordSnapshot = createLeaderboardSnapshot(world, 1, state.endsAt + 2);\n  assert.equal(recordSnapshot.boards.production.personalBest.score, 30);\n  assert.equal(recordSnapshot.boards.production.personalBest.currentIsRecord, true);\n""",
)
insert_after(
    test_path,
    """  assert.equal(world.leaderboardHistory[0].boards.production[0].gems, 0);\n""",
    """  assert.equal(player.stats.leaderboardPersonalBests.production, undefined);\n""",
)

verify = 'scripts/verify-leaderboards.mjs'
insert_after(
    verify,
    """check(server.includes('tieBreakActivityAt: entry.activityAt'), 'weekly history must audit the tie-break timestamp');\n""",
    """check(server.includes('function updatePersonalBest(player, boardId, score, periodKey)'), 'server must maintain authoritative personal best scores');\ncheck(server.includes('currentIsRecord: !state.partial'), 'current-week record status must ignore partial weeks');\ncheck(server.includes('if (!state.partial)'), 'personal bests must only settle from complete weeks');\n""",
)
insert_after(
    verify,
    """check(page.includes('最后有效经济活动时间越近者排名越高'), 'leaderboard page must explain the tie-break rule');\n""",
    """check(page.includes('leaderboard-personal-best'), 'leaderboard page must show personal best scores');\ncheck(page.includes('本周已刷新个人纪录'), 'leaderboard page must identify a current-week record');\ncheck(leaderboardTypes.includes('LeaderboardPersonalBest'), 'leaderboard client types must expose authoritative personal bests');\n""",
)

replace_once(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    """每个排行榜在服务器当前真实名次与总玩家数基础上显示个人竞争分段和下一目标：前 50%、前 25%、前 10%、前三、榜首。距离只用名次差表达，不增加额外奖励、段位资产或浏览器本地“历史最佳”；若未来需要个人历史纪录，必须先设计服务器权威持久化。""",
    """每个排行榜在服务器当前真实名次与总玩家数基础上显示个人竞争分段和下一目标：前 50%、前 25%、前 10%、前三、榜首。距离只用名次差表达，不增加额外奖励或段位资产。四榜个人最好成绩由服务器在完整周结算时写入玩家权威统计，记录最好分数与对应结算周；首个不完整周不得成为历史最好。当前完整周成绩高于已结算最好成绩时页面显示“本周已刷新个人纪录”，但历史最好仍保持上一个已结算值，直到周结算原子更新。浏览器不得自行保存、回填或比较本地历史最佳。""",
)
replace_once(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '- 用浏览器本地记录伪造排行榜个人历史最佳、段位或奖励；',
    '- 用浏览器本地记录伪造排行榜个人历史最佳、段位或奖励，或让首个不完整周写入服务器个人最好成绩；',
)

append_marker = '### 经营决策支持与精确漏斗'
server_design = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
text = read(server_design)
needle = '公开经济事件日历额外保留结束后 24 小时的事件供事后反馈，实际需求重分配仍只在正式事件生效窗口内发生。'
replacement = needle + '\n\n排行榜个人最好成绩保存在玩家权威 `stats.leaderboardPersonalBests` 中，按 `wealth/growth/production/trading` 保存已结算最好分数与 `periodKey`。只有完整周结算可以更新该历史值；排行榜读取只比较当前完整周成绩与已结算最好成绩并返回 `currentIsRecord`，不得由 GET 请求或浏览器本地状态写入历史纪录。'
if needle not in text:
    raise SystemExit('server design personal best insertion point missing')
write(server_design, text.replace(needle, replacement, 1))

product = 'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md'
text = read(product)
needle = '经营成长线完成后的中期体验优先增加决策信息而不是新的权威资产：生产页回答原料、现金与仓库还能支持多少完整周期；研发页回答科技直接对应的产业链与当前市场事实；合同页展示真实履约历史；排行榜展示当前分位与下一竞争目标；已结束经济事件展示事件窗口内真实成交反馈。'
replacement = '经营成长线完成后的中期体验优先增加决策信息而不是新的权威资产：生产页回答原料、现金与仓库还能支持多少完整周期；研发页回答科技直接对应的产业链与当前市场事实；合同页展示真实履约历史；排行榜展示当前分位、下一竞争目标和服务器完整周结算的个人最好成绩；已结束经济事件展示事件窗口内真实成交反馈。'
if needle not in text:
    raise SystemExit('product design personal best insertion point missing')
write(product, text.replace(needle, replacement, 1))

verifier = 'scripts/verify-gameplay-decision-support.mjs'
text = read(verifier)
needle = "requireText('src/pages/LeaderboardPage.tsx', 'leaderboard-personal-goal');"
replacement = needle + "\nrequireText('src/pages/LeaderboardPage.tsx', 'leaderboard-personal-best');\nrequireText('server/src/leaderboards.js', 'leaderboardPersonalBests');"
if needle not in text:
    raise SystemExit('gameplay verifier personal best insertion point missing')
write(verifier, text.replace(needle, replacement, 1))

print('Applied leaderboard personal best patch.')
