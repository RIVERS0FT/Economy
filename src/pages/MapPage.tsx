import type { LoadedGameViewModel } from '../app/gameViewModel';
import { ProvinceSelect } from '../components/provinces/ProvinceSelect';
import { Panel, StatusTag } from '../components/ui/layout';

export function MapPage({ model }: { model: LoadedGameViewModel }) {
  const { game, selectedProvince, selectedProvinceId, setSelectedProvinceId } = model;

  return (
    <section className="province-map-page" aria-labelledby="province-map-page-title">
      <Panel className="widget province-map-command-panel">
        <div className="province-map-command-heading">
          <div>
            <span className="ui-eyebrow">战略经营地图</span>
            <h1 id="province-map-page-title">美国本土地图</h1>
          </div>
          <StatusTag tone="info">48 个州级地区</StatusTag>
        </div>
        <p className="province-map-help">地图在所有玩家页面持续运行。点击州级区域切换经营位置；滚轮或双指缩放，拖动平移地图。</p>
        <div className="province-map-command-select">
          <ProvinceSelect
            provinces={game.provinces}
            value={selectedProvinceId}
            onChange={setSelectedProvinceId}
          />
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
        <p className="province-map-current">当前地区：<strong>{selectedProvince.name}</strong></p>
      </Panel>
    </section>
  );
}
