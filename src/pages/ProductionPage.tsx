import type { ChangeEvent } from 'react';
import { facilityStatusNames, type LoadedGameViewModel } from '../app/gameViewModel';
import { FacilityProgress } from '../components/facilities/FacilityProgress';
import { PageLayout, Panel } from '../components/ui/layout';
import { economyConstants } from '../store/gameStore';

export function ProductionPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
    now,
    listingPrices,
    setListingPrices,
    buildFacility,
    startFacility,
    pauseFacility,
    collectFacility,
    listFacility,
    cancelFacilityListing,
    showResult,
  } = model;

  return (
    <PageLayout
      eyebrow="生产资产"
      title="生产"
      description="建造、运行、暂停、领取或挂牌你的生产设施。"
      actions={<span>设施槽位 {game.facilities.length}/{game.facilitySlots}</span>}
    >
      <div className="production-grid">
        <Panel className="widget build-card">
          <h2>建造基础生产设施</h2>
          <dl className="detail-list">
            <div><dt>建造费用</dt><dd>¤ {economyConstants.buildCost}</dd></div>
            <div><dt>施工时间</dt><dd>5 分钟</dd></div>
            <div><dt>生产周期</dt><dd>30 秒</dd></div>
            <div><dt>周期产量</dt><dd>1 个{game.commodityName}</dd></div>
            <div><dt>运营费用</dt><dd>¤ 1 / 周期</dd></div>
            <div><dt>内部容量</dt><dd>20</dd></div>
          </dl>
          <button onClick={() => showResult(buildFacility())} disabled={game.facilities.length >= game.facilitySlots}>开始施工</button>
          <small className="muted">建造费由系统回收，施工期间持续占用设施槽位。</small>
        </Panel>

        <div className="facility-list">
          {game.facilities.map((facility) => {
            const listingPrice = listingPrices[facility.id] ?? facility.systemValue;
            const hourlyOutput = Math.floor(3_600_000 / facility.cycleMs) * facility.outputPerCycle;
            const hourlyCost = Math.floor(3_600_000 / facility.cycleMs) * facility.operatingCost;
            const estimatedProfit = hourlyOutput * game.marketPrice - hourlyCost;
            const payback = estimatedProfit > 0 ? Math.ceil(facility.systemValue / estimatedProfit) : null;
            return (
              <Panel className="facility-card" key={facility.id}>
                <div className="facility-card-head">
                  <div>
                    <span className={`status-chip status-${facility.status}`}>{facilityStatusNames[facility.status]}</span>
                    <h2>{facility.name}</h2>
                    <p>编号 {facility.id.slice(-8)} · 等级 {facility.level}</p>
                  </div>
                  <div className="facility-output"><strong>{facility.internalGoods}/{facility.internalCapacity}</strong><span>内部商品</span></div>
                </div>
                <FacilityProgress facility={facility} now={now} />
                <div className="facility-specs">
                  <span>周期 <strong>{facility.cycleMs / 1000} 秒</strong></span>
                  <span>周期产量 <strong>{facility.outputPerCycle}</strong></span>
                  <span>运营费 <strong>¤ {facility.operatingCost}</strong></span>
                  <span>累计产量 <strong>{facility.lifetimeOutput}</strong></span>
                  <span>参考估值 <strong>¤ {facility.systemValue}</strong></span>
                  <span>预计回本 <strong>{payback ? `${payback} 小时` : '--'}</strong></span>
                </div>
                <div className="facility-actions">
                  {facility.status === 'running' ? <button className="ghost-button" onClick={() => pauseFacility(facility.id)}>暂停生产</button> : null}
                  {['ready', 'paused', 'full', 'insufficient_funds'].includes(facility.status) ? <button onClick={() => startFacility(facility.id)}>启动生产</button> : null}
                  <button className="ghost-button" onClick={() => showResult(collectFacility(facility.id))}>领取商品</button>
                </div>
                {['ready', 'paused', 'full', 'insufficient_funds'].includes(facility.status) ? (
                  <div className="listing-control">
                    <input
                      type="number"
                      min={Math.ceil(facility.systemValue * 0.5)}
                      max={facility.systemValue * 2}
                      value={listingPrice}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setListingPrices((current) => ({ ...current, [facility.id]: Number(event.target.value) }))}
                    />
                    <button className="ghost-button" onClick={() => showResult(listFacility(facility.id, listingPrice))}>挂牌出售</button>
                  </div>
                ) : null}
                {facility.status === 'listed' && facility.listedOrderId ? (
                  <button className="danger-button full-button" onClick={() => cancelFacilityListing(facility.listedOrderId as string)}>撤销设施挂牌</button>
                ) : null}
              </Panel>
            );
          })}
          {game.facilities.length === 0 ? <Panel className="empty-state tall">尚未拥有生产设施。建造一座新设施，或前往市场收购其他玩家的现成资产。</Panel> : null}
        </div>
      </div>
    </PageLayout>
  );
}
