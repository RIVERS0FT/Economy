from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one occurrence, found {count}: {old[:120]!r}')
    path.write_text(text.replace(old, new), encoding='utf-8')


doc = Path('docs/GIFT_CODE_AND_ADMIN_DESIGN.md')
replace_once(
    doc,
    '“服务器”顶部使用综合状态与 15 分钟／1 小时／6 小时范围切换，下方依次使用六项即时负载、四张共享 ECharts SVG 趋势图、高负载接口、世界调度、SQLite 与进程诊断；桌面高负载接口允许局部表格横向滚动，移动端必须改为紧凑卡片，不得制造页面级横向滚动。',
    '“服务器”顶部使用综合状态与最近 1 小时／1 天／1 个月范围切换；三个范围分别按分钟／小时／天形成有界趋势桶，响应延迟与事件循环趋势固定展示 P50／P95／P99。下方依次使用六项即时负载、四张共享 ECharts SVG 趋势图、高负载接口、世界调度、SQLite 与进程诊断；桌面高负载接口允许局部表格横向滚动，移动端必须改为紧凑卡片，不得制造页面级横向滚动。',
)
replace_once(
    doc,
    '“服务器”分区固定为只读运行诊断，样式标识为 `ADMIN_SERVER_STATUS_SCHEME: readonly-runtime-diagnostics`。它复用现有管理员刷新按钮，并在分区活动且页面可见时每 10 秒刷新；切换分区、页面隐藏或新请求开始时必须取消旧请求，失败时保留最后一份成功数据。趋势范围固定为最近 15 分钟、1 小时与本次进程最多 6 小时，历史只覆盖当前 Node 进程生命周期，覆盖不足必须显示“数据积累中”，不得误判为正常。',
    '“服务器”分区固定为只读运行诊断，样式标识为 `ADMIN_SERVER_STATUS_SCHEME: readonly-runtime-diagnostics`。它复用现有管理员刷新按钮，并在分区活动且页面可见时每 10 秒刷新；切换分区、页面隐藏或新请求开始时必须取消旧请求，失败时保留最后一份成功数据。趋势范围固定为最近 1 小时、1 天与 1 个月，分别按分钟、小时与天形成最多 60／24／30 个有界趋势桶；历史只覆盖当前 Node 进程生命周期，覆盖不足必须显示“数据积累中”，不得误判为正常。服务器响应必须回显请求范围、桶宽与粒度，客户端只允许匹配当前选择的响应更新对应范围缓存；被取消、过期或范围不匹配的响应不得覆盖当前图表。',
)
replace_once(
    doc,
    '页面展示进程 CPU、RSS、Heap、API 请求量与每秒请求数、P50／P95／P99、4xx／5xx、事件循环延迟、归一化高负载接口、世界调度计数与延迟、世界修订号、数据库／WAL／SHM、世界 JSON、SQLite 页与空闲页、可回收空间、磁盘剩余、Node 版本和可选部署提交。高负载接口最多返回 20 条，动态标识必须归一化，不得返回 Cookie、请求体、邮箱、IP、玩家 ID、资产、完整数据库路径、环境变量或错误堆栈。',
    '页面展示进程 CPU、RSS、Heap、API 请求量与每秒请求数、P50／P95／P99、4xx／5xx、事件循环延迟、归一化高负载接口、世界调度计数与延迟、世界修订号、数据库／WAL／SHM、世界 JSON、SQLite 页与空闲页、可回收空间、磁盘剩余、Node 版本和可选部署提交。分钟级请求延迟使用有界直方图保留分布，小时和天级 P50／P95／P99 必须合并下级直方图后重新计算，不得把下级百分位的最大值冒充上级百分位；请求数与错误数求和，CPU 使用采样加权平均并保留峰值。高负载接口最多返回 20 条，动态标识必须归一化，不得返回 Cookie、请求体、邮箱、IP、玩家 ID、资产、完整数据库路径、环境变量或错误堆栈。',
)
replace_once(
    doc,
    '- `GET /api/game/admin/server-status?range=15m|1h|6h`',
    '- `GET /api/game/admin/server-status?range=1h|1d|30d`',
)
replace_once(
    doc,
    '- 让服务器状态读取推进世界、增加修订号、打开写事务、执行数据库维护或返回敏感信息；',
    '- 让服务器状态读取推进世界、增加修订号、打开写事务、执行数据库维护或返回敏感信息；\n- 恢复 15 分钟／6 小时范围、让三个范围继续共用分钟桶、用下级 P50／P95／P99 的最大值冒充小时或天级百分位，或允许旧范围响应覆盖当前选择；',
)

verify = Path('scripts/verify-admin-navigation.mjs')
replace_once(
    verify,
    "  'requestRef.current?.abort()',\n]);",
    "  'requestRef.current?.abort()',\n  \"const RANGES: AdminServerStatusRange[] = ['1h', '1d', '30d']\",\n  'requestSequenceRef',\n  'nextStatus.range.key !== nextRange',\n  'admin-server-range-summary',\n  'P50／P95／P99',\n]);",
)
replace_once(
    verify,
    "  \"import { EconomyChart } from './EconomyChart'\",\n  \"type: 'line'\",",
    "  \"import { EconomyChart } from './EconomyChart'\",\n  'AdminServerStatusGranularity',\n  'granularity',\n  \"type: 'line'\",",
)
replace_once(
    verify,
    "  '.admin-server-route-cards',\n  '@media (max-width: 720px)',",
    "  '.admin-server-route-cards',\n  '.admin-server-range-summary',\n  '@media (max-width: 720px)',",
)
replace_once(
    verify,
    "  \"export type AdminServerStatusRange = '15m' | '1h' | '6h'\",",
    "  \"export type AdminServerStatusRange = '1h' | '1d' | '30d'\",\n  \"export type AdminServerStatusGranularity = 'minute' | 'hour' | 'day'\",\n  'bucketMilliseconds',\n  'granularity',",
)
replace_once(
    verify,
    "  'DEFAULT_HISTORY_WINDOWS = 360',\n  'snapshot(extraSummary = {})',",
    "  'DEFAULT_HISTORY_WINDOWS = 360',\n  'createLatencyHistogram',\n  'durationHistogram',\n  'latencyHistogramPercentile',\n  'snapshot(extraSummary = {})',",
)
replace_once(
    verify,
    "  'DEFAULT_HISTORY_MINUTES = 360',\n  'process.cpuUsage',",
    "  'DEFAULT_HISTORY_MINUTES = 360',\n  'MINUTE_TREND_LIMIT = 60',\n  'HOUR_TREND_LIMIT = 24',\n  'DAY_TREND_LIMIT = 30',\n  \"'30d': Object.freeze\",\n  'bucketMilliseconds',\n  'granularity',\n  'process.cpuUsage',",
)
replace_once(
    verify,
    "  'server status is read-only and returns bounded diagnostics',\n  'assert.deepEqual(after, before)',",
    "  'server status is read-only and returns bounded diagnostics',\n  'server status changes bucket granularity for hour, day, and month ranges',\n  'runtime collector rolls completed minutes into bounded hour and day buckets',\n  'assert.deepEqual(after, before)',",
)
replace_once(
    verify,
    "  'admin server status renders runtime trends and read-only diagnostics',",
    "  'admin server status switches hour, day, and month trend granularity',\n  \"getByRole('button', { name: '1 天', exact: true })\",\n  \"getByRole('button', { name: '1 个月', exact: true })\",\n  '按分钟聚合',\n  '按小时聚合',\n  '按天聚合',",
)
replace_once(
    verify,
    "  '不得运行 `quick_check`、`wal_checkpoint`、`PRAGMA optimize`、`VACUUM`',\n]);",
    "  '不得运行 `quick_check`、`wal_checkpoint`、`PRAGMA optimize`、`VACUUM`',\n  '最近 1 小时、1 天与 1 个月',\n  '分钟级请求延迟使用有界直方图',\n  '`GET /api/game/admin/server-status?range=1h|1d|30d`',\n]);",
)

print('Patched authoritative admin design and anti-regression checks.')
