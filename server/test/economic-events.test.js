import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ECONOMIC_EVENT_EPOCH_MS,
  createEconomicCalendarClientState,
  economicEventClassShares,
  economicEventProductWeight,
  nextEconomicEventDeadline,
} from '../src/economic-events.js';

test('公开经济事件日历只返回当前与未来七天事件，并在同一事件窗口内保持确定性', () => {
  const now = ECONOMIC_EVENT_EPOCH_MS + 6 * 60 * 60 * 1000;
  const first = createEconomicCalendarClientState(now);
  const second = createEconomicCalendarClientState(now + 1);
  assert.deepEqual(first, second);
  assert.equal(first.version, 2);
  assert.equal(first.timeZone, 'Asia/Shanghai');
  assert.equal('visibleUntil' in first, false);
  assert.ok(first.events.length >= 2);
  assert.ok(first.events.every((event) => event.endsAt > now && event.startsAt <= now + 7 * 24 * 60 * 60 * 1000));
  assert.ok(nextEconomicEventDeadline(now) > now);
});

test('经济事件只重分配类别份额和商品选择权重，不扩大类别份额总和', () => {
  const now = ECONOMIC_EVENT_EPOCH_MS + 6 * 60 * 60 * 1000;
  const base = { staples: 0.5, protein: 0.25, 'fresh-drinks': 0.1, convenience: 0.15 };
  const adjusted = economicEventClassShares('basic', 'food', base, now);
  const total = Object.values(adjusted).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.ok(adjusted['fresh-drinks'] > base['fresh-drinks']);
  assert.ok(adjusted.convenience > base.convenience);
  assert.ok(economicEventProductWeight('beverage', now) > 1);
  assert.equal(economicEventProductWeight('machinery', now), 1);
});
