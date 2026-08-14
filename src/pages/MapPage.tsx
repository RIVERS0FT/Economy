import type { LoadedGameViewModel } from '../app/gameViewModel';
import { FactoryIcon, MarketIcon, WarehouseIcon } from '../components/icons/GameIcons';
import { ProvinceSelect } from '../components/provinces/ProvinceSelect';
import { Button, PageLayout, Panel, StatusTag, WidgetHeading } from '../components/ui/layout';
import { formatNumber } from '../utils/formatters';

const MAP_BOUNDS = { minLongitude: 80, maxLongitude: 134, minLatitude: 18, maxLatitude: 54 };
const MAP_LABEL_POSITIONS: Record<string, { left: string; top: string }> = {
  '110000': { left: '66%', top: '21%' },
  '120000': { left: '73%', top: '27%' },
  '130000': { left: '64%', top: '30%' },
  '140000': { left: '55%', top: '34%' },
  '150000': { left: '44%', top: '18%' },
  '210000': { left: '76%', top: '17%' },
  '220000': { left: '84%', top: '13%' },
  '230000': { left: '91%', top: '7%' },
  '310000': { left: '86%', top: '48%' },
  '320000': { left: '77%', top: '44%' },
  '330000': { left: '78%', top: '55%' },
  '340000': { left: '68%', top: '47%' },
  '350000': { left: '73%', top: '65%' },
  '360000': { left: '67%', top: '57%' },
  '370000': { left: '72%', top: '36%' },
  '410000': { left: '61%', top: '43%' },
  '420000': { left: '57%', top: '52%' },
  '430000': { left: '56%', top: '61%' },
  '440000': { left: '62%', top: '71%' },
  '450000': { left: '50%', top: '73%' },
  '460000': { left: '58%', top: '91%' },
  '500000': { left: '47%', top: '57%' },
  '510000': { left: '38%', top: '54%' },
  '520000': { left: '45%', top: '65%' },
  '530000': { left: '33%', top: '70%' },
  '540000': { left: '12%', top: '58%' },
  '610000': { left: '46%', top: '43%' },
  '620000': { left: '30%', top: '34%' },
  '630000': { left: '25%', top: '46%' },
  '640000': { left: '41%', top: '36%' },
  '650000': { left: '10%', top: '25%' },
  '710000': { left: '84%', top: '68%' },
  '810000': { left: '66%', top: '79%' },
  '820000': { left: '56%', top: '81%' },
};

function mapPosition(provinceId: string, longitude: number, latitude: number) {
  if (MAP_LABEL_POSITIONS[provinceId]) return MAP_LABEL_POSITIONS[provinceId];
  const left = ((longitude - MAP_BOUNDS.minLongitude) / (MAP_BOUNDS.maxLongitude - MAP_BOUNDS.minLongitude)) * 100;
  const top = (1 - (latitude - MAP_BOUNDS.minLatitude) / (MAP_BOUNDS.maxLatitude - MAP_BOUNDS.minLatitude)) * 100;
  return { left: `${Math.max(2, Math.min(98, left))}%`, top: `${Math.max(3, Math.min(97, top))}%` };
}

export function MapPage({ model }: { model: LoadedGameViewModel }) {
  const { game, selectedProvince, selectedProvinceId, setSelectedProvinceId } = model;
  const selectedSummary = game.provinceAssetSummaries[selectedProvinceId];

  return (
    <PageLayout
      title="中国地图"
      description="选择省级地区，进入对应的本地市场并管理当地仓库与工厂。"
      actions={(
        <ProvinceSelect
          provinces={game.provinces}
          value={selectedProvinceId}
          onChange={setSelectedProvinceId}
        />
      )}
    >
      <div className="province-map-layout">
        <Panel className="widget province-map-panel">
          <WidgetHeading title="省级经营地图" action={<StatusTag tone="info">34 个省级地区</StatusTag>} />
          <p className="province-map-help">点击地区名称切换经营位置；地图只表达游戏经营位置，不改变现实行政信息。</p>
          <div className="province-map-canvas" role="group" aria-label="中国省级经营地图">
            <svg className="province-map-silhouette" viewBox="0 0 760 520" aria-hidden="true" focusable="false">
              <path d="M92 92 155 58l92 18 62-34 105 29 83-8 80 51 64 21 20 55 48 54-33 45 18 60-72 18-34 58-93 29-70 37-81-17-78 27-54-49-74-17-22-74-47-51 25-58-18-69 39-43-4-64Z" />
              <path d="M571 411c24 8 38 27 31 51-20 3-38-7-48-25 2-12 7-20 17-26Z" />
            </svg>
            {game.provinces.map((province) => {
              const summary = game.provinceAssetSummaries[province.id];
              const active = province.id === selectedProvinceId;
              const hasAssets = Number(summary?.facilityCount || 0) > 0 || Number(summary?.storedQuantity || 0) > 0;
              const blocked = Number(summary?.blockedFacilityCount || 0) > 0;
              return (
                <button
                  key={province.id}
                  type="button"
                  data-ui-interactive="surface"
                  className={`province-map-marker${active ? ' is-selected' : ''}${hasAssets ? ' has-assets' : ''}${blocked ? ' has-blocked' : ''}`}
                  style={mapPosition(province.id, province.longitude, province.latitude)}
                  onClick={() => setSelectedProvinceId(province.id)}
                  aria-pressed={active}
                  aria-label={`${province.name}，工厂 ${summary?.facilityCount || 0}，库存 ${summary?.storedQuantity || 0}`}
                >
                  <span>{province.shortName}</span>
                  {hasAssets ? <i aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel className="widget province-detail-panel">
          <WidgetHeading title={selectedProvince.name} action={<StatusTag tone="success">本地经营</StatusTag>} />
          <div className="province-detail-metrics">
            <div><WarehouseIcon /><span>本地库存</span><strong>{formatNumber(selectedSummary?.storedQuantity || 0)}</strong></div>
            <div><FactoryIcon /><span>工厂总数</span><strong>{formatNumber(selectedSummary?.facilityCount || 0)}</strong></div>
            <div><FactoryIcon /><span>运行中</span><strong>{formatNumber(selectedSummary?.runningFacilityCount || 0)}</strong></div>
            <div><MarketIcon /><span>本地挂单</span><strong>{formatNumber(selectedSummary?.openOrderCount || 0)}</strong></div>
          </div>
          {Number(selectedSummary?.blockedFacilityCount || 0) > 0 ? (
            <p className="province-detail-alert">有 {formatNumber(selectedSummary.blockedFacilityCount)} 座工厂处于异常状态。</p>
          ) : (
            <p className="province-detail-note">当地商品只进入本地仓库，订单只与当地盘口撮合。</p>
          )}
          <div className="province-detail-actions">
            <Button variant="primary" onClick={() => model.setTab('market')}>进入本地市场</Button>
            <Button variant="secondary" onClick={() => model.setTab('production')}>管理本地生产</Button>
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
}
