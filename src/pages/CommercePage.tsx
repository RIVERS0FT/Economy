import { useEffect, useMemo, useRef, useState } from 'react';
import { runCommercialBuildingAction, type CommercialBuildingOperation } from '../api/commercial';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { BuildingDetailPage } from '../components/buildings/BuildingDetailPage';
import { usePlayerPageNavigation } from '../components/ui/PageNavigationContext';
import { SelectInput } from '../components/ui/FormControls';
import {
  Button,
  DataList,
  DataRow,
  PageLayout,
  PagePanel,
  Panel,
  WidgetHeading,
} from '../components/ui/layout';
import { formatCurrency, formatNumber } from '../utils/formatters';

import { BuildingClusterCard } from '../components/buildings/BuildingClusterCard';
import { CommercialBuildingArtwork } from '../components/commercial/CommercialBuildingArtwork';
import { CommercialBuildingDetail } from '../components/commercial/CommercialBuildingDetail';
import { CompactCurrency } from '../components/ui/CompactNumber';
import type { CommercialStateFields, CommercialAutoOperationPolicy } from '../types/commercial';
import { commercialProfitPerMinute as profitPerMinute, commercialStatusLabel } from '../utils/commercialPresentation';
import '../styles/commercial-buildings.css';

export function CommercePage({
  model,
  embedded = false,
  renderPart,
  detailCommercialTypeId,
  onDetailCommercialTypeChange,
}: {
  model: LoadedGameViewModel;
  embedded?: boolean;
  renderPart?: 'build' | 'cards';
  detailCommercialTypeId?: string;
  onDetailCommercialTypeChange?: (commercialTypeId: string | null) => void;
}) {
  const navigation = usePlayerPageNavigation();
  const game = model.game as typeof model.game & CommercialStateFields;
  const types = game.commercialBuildingTypes ?? [];
  const provinceGroups = (game.commercialBuildingGroups ?? []).filter((group) => (
    group.provinceId === model.selectedProvinceId && group.count > 0
  ));
  const [selectedBuildTypeId, setSelectedBuildTypeId] = useState(types[0]?.id ?? '');
  const [buildQuantity, setBuildQuantity] = useState(1);
  const [internalDetailTypeId, setInternalDetailTypeId] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const pendingActionRef = useRef(false);
  const [actionError, setActionError] = useState('');
  const activeDetailTypeId = onDetailCommercialTypeChange
    ? detailCommercialTypeId ?? ''
    : internalDetailTypeId;

  useEffect(() => {
    if (types.some((type) => type.id === selectedBuildTypeId)) return;
    setSelectedBuildTypeId(types[0]?.id ?? '');
  }, [selectedBuildTypeId, types]);

  const typeById = useMemo(
    () => new Map(types.map((type) => [type.id, type])),
    [types],
  );
  const selectedBuildType = typeById.get(selectedBuildTypeId) ?? types[0];
  const selectedGroup = provinceGroups.find((group) => group.commercialTypeId === activeDetailTypeId);
  const selectedDetailType = selectedGroup ? typeById.get(selectedGroup.commercialTypeId) : undefined;

  useEffect(() => {
    if (!activeDetailTypeId || (selectedGroup && selectedDetailType)) return;
    if (onDetailCommercialTypeChange) onDetailCommercialTypeChange(null);
    else setInternalDetailTypeId('');
  }, [activeDetailTypeId, onDetailCommercialTypeChange, selectedDetailType, selectedGroup]);

  const selectDetail = (commercialTypeId: string) => {
    if (onDetailCommercialTypeChange) onDetailCommercialTypeChange(commercialTypeId);
    else setInternalDetailTypeId(commercialTypeId);
  };

  const closeDetail = () => {
    if (onDetailCommercialTypeChange) onDetailCommercialTypeChange(null);
    else setInternalDetailTypeId('');
  };

  useEffect(() => { setActionError(''); }, [activeDetailTypeId, model.selectedProvinceId]);

  const execute = async (
    key: string,
    operation: CommercialBuildingOperation,
    commercialTypeId: string,
    quantity?: number,
    policy?: CommercialAutoOperationPolicy,
  ) => {
    if (pendingActionRef.current) return;
    pendingActionRef.current = true;
    setPendingAction(key);
    setActionError('');
    try {
      const result = await runCommercialBuildingAction(Number(game.saveEpoch || 0), {
        operation,
        provinceId: model.selectedProvinceId,
        commercialTypeId,
        quantity,
        policy,
      });
      if (!result.ok) setActionError(result.message);
      await model.showResult(result);
    } catch {
      setActionError('商业建筑操作未能完成确认，请刷新状态后重试。');
    } finally {
      pendingActionRef.current = false;
      setPendingAction('');
    }
  };

  if (types.length === 0) {
    if (renderPart === 'cards') return null;
    const empty = <Panel className="empty-state">服务器尚未返回商业建筑目录。</Panel>;
    return embedded ? empty : <PageLayout title="商业">{empty}</PageLayout>;
  }

  const buildCard = selectedBuildType ? (
    <PagePanel className="production-surface build-card production-build-card commercial-build-card">
      <WidgetHeading title="建设新商业建筑" />
      <SelectInput
        label="商业建筑类型"
        value={selectedBuildType.id}
        onChange={(event) => setSelectedBuildTypeId(event.target.value)}
      >
        {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
      </SelectInput>
      <SelectInput
        label="建造数量"
        value={String(buildQuantity)}
        onChange={(event) => setBuildQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1)))}
      >
        {[1, 5, 10, 25, 50, 100].map((quantity) => (
          <option value={quantity} key={quantity}>{quantity}</option>
        ))}
      </SelectInput>
      <DataList>
        <DataRow label="建造资金" value={formatCurrency(selectedBuildType.buildCost * buildQuantity)} />
        <DataRow
          label="单座稳定利润"
          value={`${formatCurrency(selectedBuildType.profitPerCycle)} / ${formatNumber(selectedBuildType.cycleMs / 60_000)} 分钟`}
        />
        <DataRow
          label="建成后稳定利润"
          value={`${formatCurrency(profitPerMinute(selectedBuildType, buildQuantity))} / 分钟`}
        />
      </DataList>
      <Button
        block
        disabled={Boolean(pendingAction) || game.credits < selectedBuildType.buildCost * buildQuantity}
        onClick={() => void execute(
          `build:${selectedBuildType.id}`,
          'build',
          selectedBuildType.id,
          buildQuantity,
        )}
      >
        {buildQuantity === 1
          ? `立即建造${selectedBuildType.name}`
          : `立即建造 ${buildQuantity} 座${selectedBuildType.name}`}
      </Button>
      <small className="ui-helper-text">
        商业建筑即时建成并默认停止营业；开始营业后只消耗当前州本地仓库商品，不会隐式跨州调货或创建商品挂单。
      </small>
    </PagePanel>
  ) : null;

  const buildingCards = provinceGroups.map((group) => {
          const type = typeById.get(group.commercialTypeId);
          if (!type) return null;
          const profit = profitPerMinute(type);
          return (
            <BuildingClusterCard kind="commercial" key={group.commercialTypeId} className="commercial-building-card"
              name={type.name} status={group.status} count={group.count}
              artwork={<CommercialBuildingArtwork commercialTypeId={type.id} className="facility-cluster-icon" />}
              profitValue={<CompactCurrency value={profit} />}
              profitTone={profit > 0 ? 'positive' : 'neutral'}
              profitTitle={`${type.name}单座稳定利润／分钟；不含集群数量倍数`}
              ariaLabel={`${type.name}，数量 ${formatNumber(group.count)}，${commercialStatusLabel(group)}，单座稳定利润每分钟：${formatCurrency(profit)}`}
              onSelect={() => selectDetail(type.id)}
            />
          );
        });

  const buildingList = (
    <section className="facility-cluster-selector-region commercial-cluster-selector-region" aria-label="商业建筑列表">
      <div className="facility-cluster-selector-list commercial-cluster-selector-list">
        {buildingCards}
      </div>
      {provinceGroups.length === 0 ? (
        <div className="empty-state tall">尚未拥有商业建筑。先建设第一座商业建筑。</div>
      ) : null}
    </section>
  );

  const openProductDetail = (productId: string) => {
    const current = navigation?.currentLocation;
    if (navigation && current?.type === 'regional-commercial') {
      navigation.pushPage({ type: 'regional-product', host: current.host === 'buildings' ? 'market' : 'province', provinceId: current.provinceId, productId });
      return;
    }
    model.selectMarketAsset('commodity', productId);
  };

  const detail = selectedGroup && selectedDetailType ? (
    <BuildingDetailPage kind="commercial" name={selectedDetailType.name}
      provinceName={model.selectedProvince?.name || '当前地区'} embedded={embedded} onBack={closeDetail}>
      {actionError ? <p className="commercial-action-error" role="alert">{actionError}</p> : null}
      <CommercialBuildingDetail group={selectedGroup} type={selectedDetailType}
        products={game.products} inventories={game.inventories} markets={game.markets} now={game.lastProcessedAt}
        pending={Boolean(pendingAction)} onOpenProductMarket={openProductDetail}
        onAutoOperationChange={(policy) => void execute('auto-operation', 'auto-operation', selectedGroup.commercialTypeId, undefined, policy)}
        onToggle={(enabled) => void execute(
          `${enabled ? 'start' : 'stop'}:${selectedGroup.commercialTypeId}`,
          enabled ? 'start' : 'stop', selectedGroup.commercialTypeId,
        )}
      />
    </BuildingDetailPage>
  ) : null;

  if (renderPart === 'build') return <>{actionError ? <p className="commercial-action-error" role="alert">{actionError}</p> : null}{buildCard}</>;
  if (renderPart === 'cards') return <>{buildingCards}</>;
  if (selectedGroup && selectedDetailType) return detail;

  const content = <>
    {actionError ? <p className="commercial-action-error" role="alert">{actionError}</p> : null}
    {selectedGroup && selectedDetailType ? detail : (
      <div className="regional-buildings-management commercial-buildings-management">
        {buildCard}
        {buildingList}
      </div>
    )}
  </>;

  if (embedded) return content;

  return (
    <PageLayout title={`${model.selectedProvince?.name || '加利福尼亚州'}商业`}>
      {content}
    </PageLayout>
  );
}
