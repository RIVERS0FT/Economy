from pathlib import Path

path = Path('tests/browser/admin-runtime.spec.ts')
text = path.read_text(encoding='utf-8')
old = """        funnel: {
          stages: [
            { id: 'registered', label: '完成建档', count: 10, medianHours: 0, conversionBps: 10_000 },
            { id: 'activated', label: '首次经济操作', count: 8, medianHours: 0.4, conversionBps: 8_000 },
            { id: 'facility', label: '第一座工厂', count: 6, medianHours: 3.2, conversionBps: 7_500 },
            { id: 'production', label: '首次生产', count: 5, medianHours: 4.1, conversionBps: 8_333 },
            { id: 'trade', label: '首次订单簿成交', count: 4, medianHours: 8.5, conversionBps: 8_000 },
          ],
          retained7d: { eligible: 3, retained: 2, rateBps: 6_667 },
        },"""
new = """        funnel: {
          coverageStartsAt: Date.UTC(2026, 6, 18, 4),
          stages: [
            { id: 'registered', label: '完成建档', count: 10, medianHours: 0, conversionBps: 10_000 },
            { id: 'first-action', label: '首次经济操作', count: 8, medianHours: 0.4, conversionBps: 8_000 },
            { id: 'first-facility', label: '获得第一座工厂', count: 6, medianHours: 3.2, conversionBps: 7_500 },
            { id: 'first-production', label: '完成首次生产', count: 5, medianHours: 4.1, conversionBps: 8_333 },
            { id: 'first-trade', label: '完成首次订单簿成交', count: 4, medianHours: 8.5, conversionBps: 8_000 },
            { id: 'first-research', label: '开始首次产业研发', count: 3, medianHours: 10.2, conversionBps: 7_500 },
            { id: 'first-bank-deposit', label: '完成首次银行存款', count: 2, medianHours: 12.6, conversionBps: 6_667 },
            { id: 'growth-line-complete', label: '完成经营成长线', count: 1, medianHours: 15.4, conversionBps: 5_000 },
          ],
          retained7d: { eligible: 3, retained: 2, rateBps: 6_667 },
          completion24h: { eligible: 3, retained: 1, rateBps: 3_333 },
          completion7d: { eligible: 2, retained: 1, rateBps: 5_000 },
        },"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected one old admin funnel fixture, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Admin player-statistics browser fixture updated.')
