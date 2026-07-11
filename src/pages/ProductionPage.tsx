import type { ChangeEvent } from 'react';
import { facilityStatusNames, type LoadedGameViewModel } from '../app/gameViewModel';
import { FacilityProgress } from '../components/facilities/FacilityProgress';
import {
  Button,
  DataList,
  DataRow,
  PageLayout,
  Panel,
  StatusTag,
  type StatusTone,
  WidgetHeading,
} from '../components/ui/layout';
import { economyConstants } from '../config/economy';

function facilityTone(status: string): StatusTone {
  if (status === 'running') return 'success';
  if (status === 'constructing') return 'warning';
  if (status === 'listed') return 'info';
  if (status === 'full' || status === 'insufficient_funds') return 'danger';
  return 'neutral';
}

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
      actions={<StatusTag>{`设施槽位 ${game.facilities.length}/${game.facilitySlots}`}</StatusTag>}
    >
      <div className="production-grid">
        <Panel className="widget build-card">
          <WidgetHeading eyebrow="新建设施" title="建造基础生产设施" />
          <DataList>
            <DataRow label="建造费用" value={`¤ ${economyConstants.buildCost}`} tone="danger" />
            <DataRow label="施工时间" value="5 分钟" tone="warning" />
            <DataRow label="生产周期" value="30 秒" />
            <DataRow label="周期产量" value={`1 个${game.commodityName}`} />
            <DataRow label="运营费用" value="¤ 1 / 周期" />
            <DataRow label="内部容量" value="20" />
          </DataList>
          <Button
            block
            onClick={() => void showResult(buildFacility())}
            disabled={game.facilities.length >= game.facilitySlots}
          >
            开始施工
          </Button>
          <small className="ui-helper-text">建造费由系统回收，施工期间持续占用设施槽位。</small>
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
                    <StatusTag tone={facilityTone(facility.status)}>{facilityStatusNames[facility.status]}</StatusTag>
                    <h2>{facility.name}</h2>
                    <p>编号 {facility.id.slice(-8)} · 等级 {facility.level}</p>
                  </div>
                  <MetricOutput value={`${facility.internalGoods}/${facility.internalCapacity}`} label="内部商品" />
                </div>
                <FacilityProgress facility={facility} now={now} />
                <div className="facility-specs ui-spec-grid">
                  <span>周期 <strong>{facility.cycleMs / 1000} 秒</strong></span>
                  <span>周期产量 <strong>{facility.outputPerCycle}</strong></span>
                  <span>运营费 <strong>¤ {facility.operatingCost}</strong></span>
                  <span>累计产量 <strong>{facility.lifetimeOutput}</strong></span>
                  <span>参考估值 <strong>¤ {facility.systemValue}</strong></span>
                  <span>预计回本 <strong>{payback ? `${payback} 小时` : '--'}</strong></span>
                </div>
                <div className="facility-actions ui-inline-actions">
                  {facility.status === 'running' ? (
                    <Button variant="secondary" onClick={() => void showResult(pauseFacility(facility.id))}>暂停生产</Button>
                  ) : null}
                  {['ready', 'paused', 'full', 'insufficient_funds'].includes(facility.status) ? (
                    <Button onClick={() => void showResult(startFacility(facility.id))}>启动生产</Button>
                  ) : null}
                  <Button variant="secondary" onClick={() => void showResult(collectFacility(facility.id))}>领取商品</Button>
                </div>
                {['ready', 'paused', 'full', 'insufficient_funds'].includes(facility.status) ? (
                  <div className="listing-control">
                    <input
                      aria-label={`${facility.name}挂牌价格`}
                      type="number"
                      min={Math.ceil(facility.systemValue * 0.5)}
                      max={facility.systemValue * 2}
                      value={listingPrice}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setListingPrices((current) => ({ ...current, [facility.id]: Number(event.target.value) }))}
                    />
                    <Button variant="secondary" onClick={() => void showResult(listFacility(facility.id, listingPrice))}>挂牌出售</Button>
                  </div>
                ) : null}
                {facility.status === 'listed' && facility.listedOrderId ? (
                  <Button
                    block
                    variant="danger"
                    className="facility-cancel-listing"
                    onClick={() => void showResult(cancelFacilityListing(facility.listedOrderId as string))}
                  >
                    撤销设施挂牌
                  </Button>
                ) : null}
              </Panel>
            );
          })}
          {game.facilities.length === 0 ? (
            <Panel className="empty-state tall">尚未拥有生产设施。建造一座新设施，或前往市场收购其他玩家的现成资产。</Panel>
          ) : null}
        </div>
      </div>
    </PageLayout>
  );
}

function MetricOutput({ value, label }: { value: string; label: string }) {
  return (
    <div className="facility-output">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}