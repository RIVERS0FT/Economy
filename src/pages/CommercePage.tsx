import { useEffect, useMemo, useState } from 'react';
import { runCommercialBuildingAction } from '../api/commercial';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import { SelectInput } from '../components/ui/FormControls';
import {
  Button,
  DataList,
  DataRow,
  PageLayout,
  PagePanel,
  Panel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface CommercialInputDefinition {
  productId: string;
  quantity: number;
}

interface CommercialBuildingTypeDefinition {
  id: string;
  name: string;
  description: string;
  buildCost: number;
  cycleMs: number;
  operatingCost: number;
  profitPerCycle: number;
  consumptionInputs: CommercialInputDefinition[];
  systemValue: number;
}

type CommercialStatus = 'running' | 'stopped' | 'error';
type CommercialStatusReason = 'manual' | 'insufficient_funds' | 'insufficient_input';

interface CommercialBuildingGroup {
  commercialTypeId: string;
  provinceId: string;
  count: number;
  participatingCount: number;
  enabled: boolean;
  status: CommercialStatus;
  statusReason?: CommercialStatusReason;
  cycleStartedAt?: number;
  cycleCompletesAt?: number;
  pendingRevenue?: number;
  pendingProfit?: number;
  pendingGoodsConsumed?: number;
  lifetimeRevenue: number;
  lifetimeProfit: number;
  lifetimeGoodsConsumed: number;
}

interface CommercialStateFields {
  saveEpoch?: number;
  commercialBuildingTypes?: CommercialBuildingTypeDefinition[];
  commercialBuildingGroups?: CommercialBuildingGroup[];
}

const STATUS_LABELS: Record<CommercialStatus, string> = {
  running: '营业中',
  stopped: '已停止',
  error: '经营异常',
};

const STATUS_REASON_LABELS: Record<CommercialStatusReason, string> = {
  manual: '手动停止',
  insufficient_funds: '运营资金不足',
  insufficient_input: '消费商品不足',
};

function statusTone(status: CommercialStatus) {
  if (status === 'running') return 'success' as const;
  if (status === 'error') return 'danger' as const;
  return 'neutral' as const;
}

function profitPerMinute(type: CommercialBuildingTypeDefinition, count = 1) {
  if (type.cycleMs <= 0) return 0;
  return type.profitPerCycle * count * 60_000 / type.cycleMs;
}

export function CommercePage({
  model,
  embedded = false,
  detailCommercialTypeId,
  onDetailCommercialTypeChange,
}: {
  model: LoadedGameViewModel;
  embedded?: boolean;
  detailCommercialTypeId?: string;
  onDetailCommercialTypeChange?: (commercialTypeId: string | null) => void;
}) {
  const game = model.game as typeof model.game & CommercialStateFields;
  const types = game.commercialBuildingTypes ?? [];
  const provinceGroups = (game.commercialBuildingGroups ?? []).filter((group) => (
    group.provinceId === model.selectedProvinceId && group.count > 0
  ));
  const [selectedBuildTypeId, setSelectedBuildTypeId] = useState(types[0]?.id ?? '');
  const [buildQuantity, setBuildQuantity] = useState(1);
  const [internalDetailTypeId, setInternalDetailTypeId] = useState('');
  const [pendingAction, setPendingAction] = useState('');
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
  const productNameById = useMemo(
    () => new Map(game.products.map((product) => [product.id, product.name])),
    [game.products],
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

  const execute = async (
    key: string,
    operation: 'build' | 'start' | 'stop',
    commercialTypeId: string,
    quantity?: number,
  ) => {
    if (pendingAction) return;
    setPendingAction(key);
    try {
      const result = await runCommercialBuildingAction(Number(game.saveEpoch || 0), {
        operation,
        provinceId: model.selectedProvinceId,
        commercialTypeId,
        quantity,
      });
      await model.showResult(result);
    } finally {
      setPendingAction('');
    }
  };

  if (types.length === 0) {
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

  const buildingList = (
    <section className="facility-cluster-selector-region commercial-cluster-selector-region" aria-label="商业建筑列表">
      <div className="facility-cluster-selector-list commercial-cluster-selector-list">
        {provinceGroups.map((group) => {
          const type = typeById.get(group.commercialTypeId);
          if (!type) return null;
          return (
            <PagePanel
              className="production-surface facility-card facility-group-card commercial-building-card"
              key={group.commercialTypeId}
            >
              <WidgetHeading
                title={type.name}
                action={<StatusTag tone={statusTone(group.status)}>{STATUS_LABELS[group.status]}</StatusTag>}
              />
              <DataList>
                <DataRow label="拥有数量" value={`${formatNumber(group.count)} 座`} />
                <DataRow label="稳定利润" value={`${formatCurrency(profitPerMinute(type, group.count))} / 分钟`} />
                <DataRow
                  label="经营状态"
                  value={group.statusReason ? STATUS_REASON_LABELS[group.statusReason] : STATUS_LABELS[group.status]}
                  tone={group.status === 'error' ? 'danger' : 'neutral'}
                />
              </DataList>
              <Button block variant="secondary" onClick={() => selectDetail(type.id)}>查看经营详情</Button>
            </PagePanel>
          );
        })}
      </div>
      {provinceGroups.length === 0 ? (
        <div className="empty-state tall">尚未拥有商业建筑。先建设第一座商业建筑。</div>
      ) : null}
    </section>
  );

  const detail = selectedGroup && selectedDetailType ? (
    <div className="facility-cluster-detail-shell facility-cluster-detail-page commercial-cluster-detail-page">
      <PagePanel className="production-surface facility-card facility-group-card facility-cluster-detail-card commercial-building-detail-card">
        <WidgetHeading
          title="经营状态"
          action={<StatusTag tone={statusTone(selectedGroup.status)}>{STATUS_LABELS[selectedGroup.status]}</StatusTag>}
        />
        <DataList>
          <DataRow label="建筑数量" value={`${formatNumber(selectedGroup.count)} 座`} />
          <DataRow label="当前营业" value={`${formatNumber(selectedGroup.participatingCount)} 座`} />
          <DataRow
            label="稳定利润 / 周期"
            value={formatCurrency(selectedDetailType.profitPerCycle * selectedGroup.count)}
          />
          <DataRow
            label="稳定利润 / 分钟"
            value={formatCurrency(profitPerMinute(selectedDetailType, selectedGroup.count))}
          />
          <DataRow label="运营成本 / 周期" value={formatCurrency(selectedDetailType.operatingCost * selectedGroup.count)} />
          {selectedGroup.cycleCompletesAt && selectedGroup.status === 'running' ? (
            <DataRow
              label="本周期剩余"
              value={`${formatNumber(Math.ceil(Math.max(0, selectedGroup.cycleCompletesAt - game.lastProcessedAt) / 1000))} 秒`}
            />
          ) : null}
        </DataList>

        <WidgetHeading title="商品消耗" />
        <DataList>
          {selectedDetailType.consumptionInputs.map((input) => {
            const required = input.quantity * selectedGroup.count;
            const available = game.inventories[input.productId]?.available ?? 0;
            return (
              <DataRow
                key={input.productId}
                label={productNameById.get(input.productId) ?? input.productId}
                value={`${formatNumber(required)} / 周期 · 本地库存 ${formatNumber(available)}`}
                tone={available >= required ? 'neutral' : 'danger'}
              />
            );
          })}
        </DataList>

        <WidgetHeading title="累计经营" />
        <DataList>
          <DataRow label="累计营业收入" value={formatCurrency(selectedGroup.lifetimeRevenue)} />
          <DataRow label="累计稳定利润" value={formatCurrency(selectedGroup.lifetimeProfit)} />
          <DataRow label="累计消费商品" value={`${formatNumber(selectedGroup.lifetimeGoodsConsumed)} 件`} />
        </DataList>

        <Button
          block
          disabled={Boolean(pendingAction)}
          onClick={() => void execute(
            `${selectedGroup.enabled ? 'stop' : 'start'}:${selectedGroup.commercialTypeId}`,
            selectedGroup.enabled ? 'stop' : 'start',
            selectedGroup.commercialTypeId,
          )}
        >
          {selectedGroup.enabled ? '停止营业' : '开始营业'}
        </Button>
        <small className="ui-helper-text">
          每个营业周期在开始时按当日官方价锁定被消费商品价值，并叠加固定运营成本和固定商业利润；因此商品价格变化不会改变本周期的固定净利润。
        </small>
      </PagePanel>
    </div>
  ) : null;

  const content = selectedGroup && selectedDetailType ? detail : (
    <div className="regional-buildings-management commercial-buildings-management">
      {buildCard}
      {buildingList}
    </div>
  );

  if (embedded) return content;

  if (selectedGroup && selectedDetailType) {
    return (
      <PageLayout
        title={(
          <RegionalEntityPageTitle
            entityName={selectedDetailType.name}
            regionName={model.selectedProvince?.name || '加利福尼亚州'}
          />
        )}
        backAction={{ label: '返回商业建筑列表', onClick: closeDetail }}
      >
        {content}
      </PageLayout>
    );
  }

  return (
    <PageLayout title={`${model.selectedProvince?.name || '加利福尼亚州'}商业`}>
      {content}
    </PageLayout>
  );
}
