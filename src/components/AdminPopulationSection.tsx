import { useCallback, useEffect, useState } from 'react';
import { adminApi, type PopulationEconomyAdminSummary } from '../api/admin';
import { AdminPopulationControl } from './AdminPopulationControl';
import { EmptyState, Panel, WidgetHeading } from './ui/layout';

export function AdminPopulationSection({
  active,
  refreshToken,
  onNotice,
  onError,
}: {
  active: boolean;
  refreshToken: number;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [economy, setEconomy] = useState<PopulationEconomyAdminSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPopulationEconomy = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await adminApi.populationEconomy();
      setEconomy(summary.populationEconomy);
      onError('');
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : '无法加载人口经济');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    if (!active) return;
    void loadPopulationEconomy();
  }, [active, loadPopulationEconomy, refreshToken]);

  return (
    <div className="admin-section-stack admin-population-console">
      <Panel className="admin-panel admin-population-economy">
        <WidgetHeading title="人口经济总览" />
        {economy ? (
<AdminPopulationControl
  economy={economy}
  onChanged={loadPopulationEconomy}
  onNotice={onNotice}
/>
        ) : <EmptyState>{loading ? '正在加载人口经济…' : '人口经济数据尚未初始化。'}</EmptyState>}
      </Panel>
    </div>
  );
}
