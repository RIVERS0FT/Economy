import { CompactCurrency, CompactNumber } from '../ui/CompactNumber';
import type { ReactNode } from 'react';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { getAuctionState } from '../../auctions/types';
import type { ProductionContract } from '../../contracts/types';
import type { GameTutorialController } from '../../game-guide/useGameTutorial';
import { useNow } from '../../hooks/useNow';
import type { PendingNotificationItem } from '../../notifications/notificationCenter';
import type { EconomicCalendarEvent } from '../../types';
import { formatCurrency, formatDuration, formatNumber } from '../../utils/formatters';
import { GameGuideStrip } from '../GameGuideStrip';
import {
  NavigationIcon,
  PinIcon,
  type NavigationIconName,
} from '../icons/GameIcons';
import {
  createStrategicOutlinerPin,
  type StrategicOutlinerPin,
  type StrategicOutlinerSectionId,
  useStrategicOutliner,
} from './useStrategicOutliner';

type OutlinerTone = 'neutral' | 'info' | 'warning' | 'danger' | 'success';

type ContractGameState = LoadedGameViewModel['game'] & {
  productionContracts?: ProductionContract[];
};

interface OutlinerSectionProps {
  id: StrategicOutlinerSectionId;
  title: string;
  count?: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}

function OutlinerSection({
  id,
  title,
  count,
  collapsed,
  onToggle,
  children,
  className = '',
}: OutlinerSectionProps) {
  return (
    <section
      className={`strategic-outliner-section${className ? ` ${className}` : ''}`}
      data-outliner-section={id}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <button
        type="button"
        className="strategic-outliner-section__toggle"
        aria-expanded={!collapsed}
        aria-controls={`strategic-outliner-section-${id}`}
        onClick={onToggle}
      >
        <span>{title}</span>
        {typeof count === 'number' ? <small>{<CompactNumber value={count} />}</small> : null}
        <span className="strategic-outliner-section__chevron" aria-hidden="true" />
      </button>
      {collapsed ? null : (
        <div className="strategic-outliner-section__content" id={`strategic-outliner-section-${id}`}>
          {children}
        </div>
      )}
    </section>
  );
}

function OutlinerRow({
  title,
  detail,
  meta,
  icon,
  tone = 'neutral',
  onOpen,
  pin,
  pinned,
  onTogglePin,
}: {
  title: string;
  detail?: string;
  meta?: string;
  icon: NavigationIconName;
  tone?: OutlinerTone;
  onOpen: () => void;
  pin?: StrategicOutlinerPin;
  pinned?: boolean;
  onTogglePin?: (pin: StrategicOutlinerPin) => void;
}) {
  return (
    <div className="strategic-outliner-row" data-tone={tone}>
      <button type="button" className="strategic-outliner-row__main" onClick={onOpen}>
        <span className="strategic-outliner-row__icon" aria-hidden="true">
          <NavigationIcon name={icon} />
        </span>
        <span className="strategic-outliner-row__copy">
          <strong>{title}</strong>
          {detail ? <small>{detail}</small> : null}
        </span>
        {meta ? <span className="strategic-outliner-row__meta">{meta}</span> : null}
      </button>
      {pin && onTogglePin ? (
        <button
          type="button"
          className="strategic-outliner-row__pin"
          data-pinned={pinned ? 'true' : 'false'}
          aria-label={pinned ? `取消关注${title}` : `关注${title}`}
          aria-pressed={Boolean(pinned)}
          onClick={() => onTogglePin(pin)}
        >
          <PinIcon />
        </button>
      ) : null}
    </div>
  );
}

function pendingTone(severity: PendingNotificationItem['severity']): OutlinerTone {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
}

function pendingIcon(category: PendingNotificationItem['category']): NavigationIconName {
  switch (category) {
    case 'production': return 'buildings';
    case 'market': return 'market';
    case 'auction': return 'auction';
    case 'contracts': return 'contracts';
    case 'bank': return 'bank';
  }
}

function pendingPin(item: PendingNotificationItem): StrategicOutlinerPin | undefined {
  if (item.category === 'auction') {
    const id = item.key.match(/^auction:outbid:(.+)$/)?.[1];
    return id ? createStrategicOutlinerPin('auction', id) : undefined;
  }
  if (item.category === 'contracts') {
    const id = item.key.match(/^contract:issue:(.+)$/)?.[1];
    return id ? createStrategicOutlinerPin('contract', id) : undefined;
  }
  return undefined;
}

function contextPinFor(model: LoadedGameViewModel) {
  if (model.tab === 'market' && model.marketViewMode === 'detail') {
    return createStrategicOutlinerPin(
      model.marketAssetKind === 'commodity' ? 'commodity' : 'facility',
      model.marketAssetId,
      model.selectedProvinceId,
    );
  }
  if (
    model.tab === 'buildings'
    && model.game.facilityTypes.some((facility) => facility.id === model.selectedFacilityTypeId)
  ) {
    return createStrategicOutlinerPin('facility', model.selectedFacilityTypeId, model.selectedProvinceId);
  }
  return createStrategicOutlinerPin('province', model.selectedProvinceId);
}

function contextPinLabel(model: LoadedGameViewModel, pin: StrategicOutlinerPin) {
  if (pin.kind === 'province') return model.selectedProvince?.name ?? '当前地区';
  if (pin.kind === 'commodity') {
    return model.game.products.find((product) => product.id === pin.id)?.name ?? pin.id;
  }
  if (pin.kind === 'facility') {
    return model.game.facilityTypes.find((facility) => facility.id === pin.id)?.name ?? pin.id;
  }
  return pin.id;
}

function contractTitle(model: LoadedGameViewModel, contract: ProductionContract) {
  if (contract.kind === 'loan') {
    return `${contract.publisherSide === 'lender' ? '放贷' : '贷款'}合同`;
  }
  if (contract.kind === 'facility_lease') {
    const facilityName = contract.facilityTypeId
      ? model.game.facilityTypes.find((facility) => facility.id === contract.facilityTypeId)?.name
      : undefined;
    return `${contract.publisherSide === 'lessor' ? '出租' : '租赁'}合同 · ${facilityName ?? contract.facilityTypeId ?? contract.id}`;
  }
  const productName = model.game.products.find((product) => product.id === contract.productId)?.name
    ?? contract.productId;
  return `${productName}${contract.publisherRole === 'supplier' ? '供应' : '采购'}合同`;
}

function contractDeadline(contract: ProductionContract) {
  if (contract.kind === 'loan') return contract.dueAt ?? contract.nextDueAt;
  return contract.nextDueAt;
}

function eventTiming(event: EconomicCalendarEvent, now: number) {
  if (now < event.startsAt) return `${formatDuration(event.startsAt - now)} 后开始`;
  if (now < event.endsAt) return `进行中 · ${formatDuration(event.endsAt - now)}`;
  return '已结束';
}

function CompactEventRow({
  event,
  now,
  productNames,
}: {
  event: EconomicCalendarEvent;
  now: number;
  productNames: ReadonlyMap<string, string>;
}) {
  const active = event.startsAt <= now && now < event.endsAt;
  const completed = event.endsAt <= now;
  return (
    <details
      className="strategic-outliner-event"
      data-active={active ? 'true' : 'false'}
      data-completed={completed ? 'true' : 'false'}
    >
      <summary>
        <span className="strategic-outliner-event__status" aria-hidden="true" />
        <strong>{event.title}</strong>
        <small>{eventTiming(event, now)}</small>
      </summary>
      <div className="strategic-outliner-event__details">
        <p>{event.description}</p>
        {event.classLabels.length > 0 ? <small>类别：{event.classLabels.join('、')}</small> : null}
        {event.productIds.length > 0 ? (
          <small>
            商品：{event.productIds.map((id) => productNames.get(id) ?? id).join('、')}
          </small>
        ) : null}
      </div>
    </details>
  );
}

export function StrategicOutliner({
  model,
  tutorial,
  pendingItems,
}: {
  model: LoadedGameViewModel;
  tutorial?: GameTutorialController;
  pendingItems: PendingNotificationItem[];
}) {
  const preferences = useStrategicOutliner(model.user.id);
  const now = useNow(model.game.lastProcessedAt);
  const auctions = getAuctionState(model.game).assetAuctions;
  const contracts = (model.game as ContractGameState).productionContracts ?? [];
  const showTutorial = Boolean(tutorial?.isVisible && tutorial.currentStep);
  const contextPin = contextPinFor(model);
  const contextLabel = contextPinLabel(model, contextPin);
  const contextPinned = preferences.isPinned(contextPin);
  const research = model.game.research.active;
  const construction = model.game.facilityConstruction;
  const productNames = new Map(model.game.products.map((product) => [product.id, product.name]));
  const events = [...(model.game.economicCalendar?.events ?? [])].sort((left, right) => (
    left.startsAt - right.startsAt || left.id.localeCompare(right.id)
  ));
  const currentEvents = events.filter((event) => event.endsAt > now);
  const completedEvents = events
    .filter((event) => event.endsAt <= now)
    .sort((left, right) => right.endsAt - left.endsAt)
    .slice(0, 3);
  const activityCount = pendingItems.length + (research ? 1 : 0) + (construction ? 1 : 0);

  const toggleSection = (section: StrategicOutlinerSectionId) => preferences.toggleSection(section);
  const isSectionCollapsed = (section: StrategicOutlinerSectionId) => preferences.collapsedSections.has(section);

  const navigatePin = (pin: StrategicOutlinerPin) => {
    if (pin.kind === 'province') {
      model.setSelectedProvinceId(pin.id);
      model.setTab('province');
      return;
    }
    if (pin.kind === 'commodity') {
      if (pin.provinceId) model.setSelectedProvinceId(pin.provinceId);
      model.selectMarketAsset('commodity', pin.id, true);
      return;
    }
    if (pin.kind === 'facility') {
      if (pin.provinceId) model.setSelectedProvinceId(pin.provinceId);
      model.setSelectedFacilityTypeId(pin.id);
      model.setTab('buildings');
      return;
    }
    model.setTab(pin.kind === 'auction' ? 'auction' : 'contracts');
  };

  const renderPinned = (pin: StrategicOutlinerPin) => {
    if (pin.kind === 'province') {
      const province = model.game.provinces.find((candidate) => candidate.id === pin.id);
      const summary = model.game.provinceAssetSummaries?.[pin.id];
      return (
        <OutlinerRow
          key={pin.key}
          title={province?.name ?? `地区 ${pin.id}`}
          detail={summary
            ? `工厂 ${formatNumber(summary.facilityCount)} · 异常 ${formatNumber(summary.blockedFacilityCount)} · 挂单 ${formatNumber(summary.openOrderCount)}`
            : '地区数据暂不可用'}
          icon="map"
          onOpen={() => navigatePin(pin)}
          pin={pin}
          pinned
          onTogglePin={preferences.togglePin}
        />
      );
    }
    if (pin.kind === 'commodity') {
      const product = model.game.products.find((candidate) => candidate.id === pin.id);
      const market = (pin.provinceId ? model.game.provinceMarkets?.[pin.provinceId]?.[pin.id] : undefined)
        ?? model.game.markets?.[pin.id];
      const price = market?.lastTradePrice ?? market?.lastPrice;
      const change = market?.lastPriceChangeBps;
      const changeLabel = typeof change === 'number'
        ? `${change > 0 ? '+' : change < 0 ? '−' : ''}${(Math.abs(change) / 100).toFixed(1)}%`
        : '暂无变化数据';
      return (
        <OutlinerRow
          key={pin.key}
          title={product?.name ?? pin.id}
          detail={typeof price === 'number' ? `${formatCurrency(price)} · ${changeLabel}` : '暂无真实成交'}
          icon="market"
          tone={typeof change === 'number' && change > 0 ? 'success' : typeof change === 'number' && change < 0 ? 'danger' : 'neutral'}
          onOpen={() => navigatePin(pin)}
          pin={pin}
          pinned
          onTogglePin={preferences.togglePin}
        />
      );
    }
    if (pin.kind === 'facility') {
      const facility = model.game.facilityTypes.find((candidate) => candidate.id === pin.id);
      const groups = pin.provinceId
        ? model.game.provinceFacilityGroups?.[pin.provinceId] ?? []
        : model.game.facilityGroups;
      const group = groups.find((candidate) => candidate.facilityTypeId === pin.id);
      const status = group?.status === 'running' ? '运行中' : group?.status === 'error' ? '异常' : group ? '已停止' : '未建成';
      return (
        <OutlinerRow
          key={pin.key}
          title={facility?.name ?? pin.id}
          detail={`${group ? `${formatNumber(group.count)} 座 · ` : ''}${status}`}
          icon="buildings"
          tone={group?.status === 'running' ? 'success' : group?.status === 'error' ? 'danger' : 'neutral'}
          onOpen={() => navigatePin(pin)}
          pin={pin}
          pinned
          onTogglePin={preferences.togglePin}
        />
      );
    }
    if (pin.kind === 'auction') {
      const auction = auctions.find((candidate) => candidate.id === pin.id);
      const name = auction?.itemSummaries?.[0]?.name ?? auction?.asset?.name ?? `拍卖 ${pin.id}`;
      const meta = typeof auction?.endsAt === 'number' && auction.endsAt > now
        ? formatDuration(auction.endsAt - now)
        : undefined;
      return (
        <OutlinerRow
          key={pin.key}
          title={name}
          detail={auction?.status === 'open' ? '拍卖进行中' : auction ? '拍卖已结束' : '拍卖状态暂不可用'}
          meta={meta}
          icon="auction"
          onOpen={() => navigatePin(pin)}
          pin={pin}
          pinned
          onTogglePin={preferences.togglePin}
        />
      );
    }
    const contract = contracts.find((candidate) => candidate.id === pin.id);
    const deadline = contract ? contractDeadline(contract) : null;
    const meta = typeof deadline === 'number' && deadline > now
      ? formatDuration(deadline - now)
      : undefined;
    return (
      <OutlinerRow
        key={pin.key}
        title={contract ? contractTitle(model, contract) : `合同 ${pin.id}`}
        detail={contract?.issue || (contract?.status === 'active' ? '履约中' : contract ? '合同已结束' : '合同状态暂不可用')}
        meta={meta}
        icon="contracts"
        tone={contract?.issue ? 'warning' : 'neutral'}
        onOpen={() => navigatePin(pin)}
        pin={pin}
        pinned
        onTogglePin={preferences.togglePin}
      />
    );
  };

  return (
    <aside
      className="strategic-outliner"
      aria-label="战略追踪器"
      data-tutorial-visible={showTutorial ? 'true' : 'false'}
      data-event-log-visible="true"
    >
      <header className="strategic-outliner__header">
        <div className="strategic-outliner__identity">
          <strong>追踪器</strong>
        </div>
        <button
          type="button"
          className="strategic-outliner__context-pin"
          data-pinned={contextPinned ? 'true' : 'false'}
          aria-label={contextPinned ? `取消关注${contextLabel}` : `关注${contextLabel}`}
          aria-pressed={contextPinned}
          title={contextPinned ? `取消关注${contextLabel}` : `关注${contextLabel}`}
          onClick={() => preferences.togglePin(contextPin)}
        >
          <PinIcon />
        </button>
      </header>

      <div className="strategic-outliner__scroll">
        {showTutorial && tutorial ? (
          <OutlinerSection
            id="tutorial"
            title="教程"
            count={tutorial.totalSteps}
            collapsed={isSectionCollapsed('tutorial')}
            onToggle={() => toggleSection('tutorial')}
            className="strategic-outliner-section--tutorial"
          >
            <GameGuideStrip tutorial={tutorial} variant="outliner" />
          </OutlinerSection>
        ) : null}

        <OutlinerSection
          id="activity"
          title="进行中"
          count={activityCount}
          collapsed={isSectionCollapsed('activity')}
          onToggle={() => toggleSection('activity')}
        >
          {research ? (
            <OutlinerRow
              title={research.technologyName
                ?? model.game.researchTechnologies?.find((technology) => technology.id === research.technologyId)?.name
                ?? `${research.targetComplexity} 阶段研发`}
              detail="产业科技研发"
              meta={research.completesAt > now ? formatDuration(research.completesAt - now) : '确认中'}
              icon="research"
              tone="info"
              onOpen={() => model.setTab('research')}
            />
          ) : null}
          {construction ? (
            <OutlinerRow
              title={model.game.facilityTypes.find((facility) => facility.id === construction.facilityTypeId)?.name ?? construction.facilityTypeId}
              detail="工厂建设"
              meta={construction.completesAt > now ? formatDuration(construction.completesAt - now) : '确认中'}
              icon="buildings"
              tone="warning"
              onOpen={() => model.setTab('buildings')}
            />
          ) : null}
          {pendingItems.map((item) => {
            const pin = pendingPin(item);
            return (
              <OutlinerRow
                key={item.key}
                title={item.title}
                detail={item.message}
                icon={pendingIcon(item.category)}
                tone={pendingTone(item.severity)}
                onOpen={() => model.setTab(item.targetTab)}
                pin={pin}
                pinned={pin ? preferences.isPinned(pin) : false}
                onTogglePin={preferences.togglePin}
              />
            );
          })}
          {activityCount === 0 ? <p className="strategic-outliner-empty">当前没有需要持续关注的进行中事项。</p> : null}
        </OutlinerSection>

        <OutlinerSection
          id="pinned"
          title="关注"
          count={preferences.pins.length}
          collapsed={isSectionCollapsed('pinned')}
          onToggle={() => toggleSection('pinned')}
        >
          {preferences.pins.length > 0
            ? preferences.pins.map(renderPinned)
            : <p className="strategic-outliner-empty">使用图钉固定当前地区、商品、工厂、合同或拍卖。</p>}
        </OutlinerSection>

        <OutlinerSection
          id="events"
          title="公开经济事件"
          count={currentEvents.length}
          collapsed={isSectionCollapsed('events')}
          onToggle={() => toggleSection('events')}
          className="strategic-outliner-section--events"
        >
          {currentEvents.map((event) => (
            <CompactEventRow key={event.id} event={event} now={now} productNames={productNames} />
          ))}
          {currentEvents.length === 0 ? <p className="strategic-outliner-empty">近期没有正在进行或即将开始的公开经济事件。</p> : null}
          {completedEvents.length > 0 ? (
            <details className="strategic-outliner-recent-events">
              <summary>最近结束 {<CompactNumber value={completedEvents.length} />}</summary>
              <div>
                {completedEvents.map((event) => (
                  <CompactEventRow key={event.id} event={event} now={now} productNames={productNames} />
                ))}
              </div>
            </details>
          ) : null}
        </OutlinerSection>
      </div>
    </aside>
  );
}
