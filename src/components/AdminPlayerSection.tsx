import { useCallback, useEffect, useState } from 'react';
import {
  adminApi,
  type AdminPlayerStatistics as AdminPlayerStatisticsData,
  type AdminPlayerStatisticsRange,
} from '../api/admin';
import { AdminPlayerStatistics } from './AdminPlayerStatistics';
import { Button, Panel, WidgetHeading } from './ui/layout';

const RANGES: AdminPlayerStatisticsRange[] = ['7d', '30d', '90d'];

export function AdminPlayerSection({
  active,
  refreshToken,
  onError,
}: {
  active: boolean;
  refreshToken: number;
  onError: (message: string) => void;
}) {
  const [statistics, setStatistics] = useState<AdminPlayerStatisticsData | null>(null);
  const [range, setRange] = useState<AdminPlayerStatisticsRange>('30d');
  const [loading, setLoading] = useState(false);

  const loadStatistics = useCallback(async (nextRange: AdminPlayerStatisticsRange) => {
    setLoading(true);
    try {
      setStatistics(await adminApi.playerStatistics(nextRange));
      onError('');
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : '无法加载玩家运营统计');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    if (!active) return;
    void loadStatistics(range);
  }, [active, loadStatistics, range, refreshToken]);

  return (
    <div className="admin-section-stack admin-player-console">
      <Panel className="admin-panel admin-player-statistics-panel">
        <WidgetHeading
title="玩家运营分析"
action={(
  <div className="admin-player-statistics__range" role="group" aria-label="玩家统计时间范围">
    {RANGES.map((option) => (
      <Button
        className={option === range ? 'is-active' : ''}
        disabled={loading && option === range}
        key={option}
        variant="compact"
        aria-pressed={option === range}
        onClick={() => setRange(option)}
      >
        {option.replace('d', ' 日')}
      </Button>
    ))}
  </div>
)}
        />
        <AdminPlayerStatistics statistics={statistics} loading={loading} />
      </Panel>
    </div>
  );
}
