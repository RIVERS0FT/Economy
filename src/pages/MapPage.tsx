import type { LoadedGameViewModel } from '../app/gameViewModel';
import { FactoryIcon, MarketIcon, WarehouseIcon } from '../components/icons/GameIcons';
import { UsMainlandMap } from '../components/provinces/UsMainlandMap';
import { ProvinceSelect } from '../components/provinces/ProvinceSelect';
import { Button, Panel, StatusTag, WidgetHeading } from '../components/ui/layout';
import { formatNumber } from '../utils/formatters';

export function MapPage({ model }: { model: LoadedGameViewModel }) {
  const { game, selectedProvince, selectedProvinceId, setSelectedProvinceId } = model;
  const selectedSummary = game.provinceAssetSummaries[selectedProvinceId];

  return (
    <section className="province-map-page" aria-labelledby="province-map-page-title">
      <div className="province-map-canvas" role="group" aria-label="美国本土州级经营地图">
        <UsMainlandMap
          provinces={game.provinces}
          summaries={game.provinceAssetSummaries}
          selectedProvinceId={selectedProvinceId}
          onSelectProvince={setSelectedProvinceId}
        />
      </div>

      <Panel className="widget province-map-command-panel">
        <div className="province-map-command-heading">
          <div>
            <span className="ui-eyebrow">战略经营地图</span>
            <h1 id="province-map-page-title">美国本土地图</h1>
          </div>
          <StatusTag tone="info">48 个州级地区</StatusTag>
        </div>
        <p className="province-map-help">点击州级区域切换经营位置；滚轮或双指缩放，拖动平移地图。</p>
        <div className="province-map-command-select">
          <ProvinceSelect
            provinces={game.provinces}
            value={selectedProvinceId}
            onChange={setSelectedProvinceId}
          />
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

      <Panel className="widget province-map-meta">
        <div className="province-map-legend" aria-label="地图图例">
          <span className="current"><i aria-hidden="true" />当前地区</span>
          <span className="assets"><i aria-hidden="true" />已有资产</span>
          <span className="blocked"><i aria-hidden="true" />工厂异常</span>
        </div>
        <p className="province-map-source">
          交互底图数据：<a href="https://github.com/topojson/us-atlas" target="_blank" rel="noreferrer">us-atlas</a>（ISC）；仅保留美国连续 48 州，用于游戏经营位置选择，不作为测绘、导航或行政边界依据。
        </p>
      </Panel>
    </section>
  );
}
