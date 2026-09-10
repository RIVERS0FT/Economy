import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GameApiError, postTransportTask } from '../api/game';
import { WRITE_RESULT_UNCONFIRMED } from '../api/gameWriteConfirmation';
import { getStateAuthoritySnapshot } from '../app/stateDelivery.js';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { CompactNumber } from '../components/ui/CompactNumber';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { IntegerInput, MoneyInput, SelectInput } from '../components/ui/FormControls';
import { SafeTooltip } from '../components/ui/SafeTooltip';
import { Button, StatusTag, WidgetHeading } from '../components/ui/layout';
import type { EconomyState, TransportRoute } from '../types';
import { formatCurrency } from '../utils/formatters';
import { transportTraversalStopIds } from '../utils/provinceLogistics';
import type { TransportTaskCommand, TransportTaskStatus, TransportTaskView } from './transportTaskTypes';
import '../styles/transport-business.css';

const statusNames: Record<TransportTaskStatus, string> = {
  active: '执行中', cancelling: '交付后结束', completed: '已完成', cancelled: '已取消', expired: '已到期',
};
const MAX_VALUE = 1000000000;

function Help({ children, content }: { children: ReactNode; content: ReactNode }) {
  return <SafeTooltip pinOnClick content={content}>
    {({ expanded, tooltipId }) => <button type="button" className="transport-task-help"
      aria-expanded={expanded} aria-describedby={expanded ? tooltipId : undefined}>{children}</button>}
  </SafeTooltip>;
}

/** Only current consumers are suggested; the server still recomputes actual demand. */
function consumerProducts(game: EconomyState, provinceId: string) {
  const ids = new Set<string>();
  for (const group of game.provinceFacilityGroups[provinceId] ?? []) {
    if (!group.enabled || group.count < 1) continue;
    const type = game.facilityTypes.find((entry) => entry.id === group.facilityTypeId);
    const recipe = type?.recipes.find((entry) => entry.id === group.activeRecipeId)
      ?? type?.recipes.find((entry) => entry.id === type.defaultRecipeId);
    for (const input of recipe?.inputs ?? type?.inputs ?? []) ids.add(input.productId);
  }
  for (const group of game.commercialBuildingGroups ?? []) {
    if (group.provinceId !== provinceId || !group.enabled || group.count < 1) continue;
    const type = game.commercialBuildingTypes?.find((entry) => entry.id === group.commercialTypeId);
    for (const input of type?.consumptionInputs ?? []) ids.add(input.productId);
  }
  return game.products.filter((product) => ids.has(product.id));
}

export function TransportBusinessPanel({ route, model, busy = false }: {
  route: TransportRoute;
  model: OnlineAutoTradeAwareGameViewModel;
  busy?: boolean;
}) {
  const { game } = model;
  const business = route.transportBusiness;
  const [creatingSupply, setCreatingSupply] = useState(false);
  const traversal = useMemo(() => transportTraversalStopIds(route), [route.sourceProvinceId, route.destinationProvinceId, route.viaProvinceIds]);
  const stops = [...new Set(traversal)];
  const [source, setSource] = useState(route.sourceProvinceId);
  const [destination, setDestination] = useState(stops.find((id) => id !== route.sourceProvinceId) ?? '');
  const [productId, setProductId] = useState('');
  const [quantityDraft, setQuantityDraft] = useState('200');
  const [budgetDraft, setBudgetDraft] = useState('100');
  const [pending, setPending] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(false);
  const modelRef = useRef(model);
  modelRef.current = model;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const userId = game.userId;
  const saveEpoch = game.saveEpoch;
  const availableProducts = useMemo(() => consumerProducts(game, destination), [game, destination]);
  const selectedProductId = availableProducts.some((product) => product.id === productId)
    ? productId : availableProducts[0]?.id ?? '';
  const quantity = Number(quantityDraft);
  const budget = Number(budgetDraft);
  const validSpan = source !== destination && traversal.indexOf(destination, traversal.indexOf(source) + 1) > traversal.indexOf(source);
  const valid = validSpan && selectedProductId !== '' && quantityDraft.trim() !== '' && budgetDraft.trim() !== ''
    && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= MAX_VALUE
    && Number.isFinite(budget) && budget >= 0.01 && budget <= MAX_VALUE;
  const disabled = busy || pending || unconfirmed;
  const provinceName = (id: string) => game.provinces.find((entry) => entry.id === id)?.name ?? id;
  const productName = (id: string) => game.products.find((entry) => entry.id === id)?.name ?? id;

  function currentScope() {
    const authority = getStateAuthoritySnapshot().state;
    return mounted.current && modelRef.current.game.userId === userId && modelRef.current.game.saveEpoch === saveEpoch
      && (!authority || (authority.userId === userId && authority.saveEpoch === saveEpoch));
  }

  async function submit(command: TransportTaskCommand) {
    if (disabled || submitting.current || !currentScope()) return false;
    submitting.current = true;
    setPending(true);
    try {
      const response = await postTransportTask(command);
      if (!currentScope()) return false;
      // A confirmed write stays confirmed even if the subsequent read fails.
      try { await modelRef.current.refresh({ mode: 'authoritative' }); } catch { /* Normal state synchronization retries the read. */ }
      if (!currentScope()) return false;
      await modelRef.current.showResult(response.result);
      return response.result.ok;
    } catch (error) {
      if (!currentScope()) return false;
      const uncertain = !(error instanceof GameApiError) || error.code === WRITE_RESULT_UNCONFIRMED
        || error.status === 0 || error.status >= 500;
      if (uncertain) setUnconfirmed(true);
      await modelRef.current.showResult({ ok: false,
        message: uncertain ? '运输操作结果待核对，请刷新页面确认后再操作。' : error.message });
      return false;
    } finally {
      submitting.current = false;
      if (currentScope()) setPending(false);
    }
  }

  async function createSupply() {
    if (!valid) return;
    const ok = await submit({ operation: 'task-supply-create', routeId: route.id,
      sourceProvinceId: source, destinationProvinceId: destination, productId: selectedProductId,
      targetQuantity: quantity, budget });
    if (ok && currentScope()) setCreatingSupply(false);
  }

  function taskRow(task: TransportTaskView) {
    return <li className="transport-task-row" key={task.id} data-transport-task-id={task.id}>
      <div className="transport-task-heading">
        <strong>{task.kind === 'freight' ? '货运委托' : '产业补给'} · {productName(task.productId)}</strong>
        <StatusTag tone={task.status === 'active' ? 'info' : 'neutral'}>{statusNames[task.status]}</StatusTag>
      </div>
      <span>{provinceName(task.sourceProvinceId)} → {provinceName(task.destinationProvinceId)}</span>
      <div className="transport-task-metrics">
        <span>已交付 <CompactNumber value={task.deliveredQuantity} />{task.kind === 'freight' ? <> / <CompactNumber value={task.quantity ?? 0} /></> : null}</span>
        <span>在途 <CompactNumber value={task.inTransitQuantity} /></span>
        <span>{task.kind === 'freight' ? '待承运' : '待运冻结'} <CompactNumber value={task.reservedQuantity} /></span>
        {task.kind === 'supply' ? <span>保障上限 <CompactNumber value={task.targetQuantity ?? 0} /></span> : null}
      </div>
      <div className="transport-task-metrics">
        {task.kind === 'freight' ? <span>已收运费 <CurrencyAmount>{formatCurrency(task.paid ?? 0)}</CurrencyAmount> / <CurrencyAmount>{formatCurrency(task.reward ?? 0)}</CurrencyAmount></span> : null}
        <span>运输支出 <CurrencyAmount>{formatCurrency(task.spent)}</CurrencyAmount></span>
        {task.kind === 'supply' ? <span>预算余额 <CurrencyAmount>{formatCurrency(Math.max(0, (task.budget ?? 0) - task.spent))}</CurrencyAmount></span> : null}
        {task.deadlineAt ? <span>交付截止 {new Date(task.deadlineAt).toLocaleString()}</span> : null}
      </div>
      {task.status === 'active' ? <Button variant="text" disabled={disabled}
        onClick={() => void submit({ operation: 'task-cancel', routeId: route.id, taskId: task.id })}>结束任务</Button> : null}
    </li>;
  }

  if (!business) return null;
  const activeTasks = business.tasks.filter((task) => task.status === 'active' || task.status === 'cancelling');
  const history = business.tasks.filter((task) => task.status !== 'active' && task.status !== 'cancelling');
  return <section className="transport-page-section transport-business-panel" data-transport-business={route.id}>
    <WidgetHeading title="运输业务" action={!creatingSupply && !route.deletionPending
      ? <Button variant="secondary" disabled={disabled || activeTasks.length >= 12} onClick={() => setCreatingSupply(true)}>新增产业补给</Button> : undefined} />
    <div className="transport-task-metrics">
      <Help content="任务商品和下一趟燃料按真实来源冻结，只能由对应任务或路线使用。不会自动买货或买油；已有建筑、合同的冻结不能被运输挪用。">运输保障</Help>
      <span>已保障燃料 <CompactNumber value={business.reservedFuel} /></span>
      <Help content="产业补给只调运目标地区运行中建筑的真实缺口，先扣除当地保障库存和已在途货物，再受设置上限限制。源地区先保留自身所需原料。">按缺口补给</Help>
    </div>
    {creatingSupply ? <form className="transport-supply-form" aria-label="新增产业补给"
      onSubmit={(event) => { event.preventDefault(); void createSupply(); }}>
      <div className="transport-supply-fields">
        <SelectInput label="供货地区" value={source} disabled={disabled} onChange={(event) => setSource(event.target.value)}>
          {stops.map((id) => <option key={id} value={id}>{provinceName(id)}</option>)}
        </SelectInput>
        <SelectInput label="收货地区" value={destination} disabled={disabled} onChange={(event) => setDestination(event.target.value)}>
          {stops.map((id) => <option key={id} value={id} disabled={id === source}>{provinceName(id)}</option>)}
        </SelectInput>
        <SelectInput label="补给商品" value={selectedProductId} disabled={disabled || availableProducts.length === 0}
          onChange={(event) => setProductId(event.target.value)}>
          {availableProducts.length ? availableProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)
            : <option value="">该地区暂无运行中的商品消耗</option>}
        </SelectInput>
        <IntegerInput label="保障数量上限" value={quantityDraft} fallbackValue={200} min={1} max={MAX_VALUE}
          disabled={disabled} onValueChange={setQuantityDraft} />
        <MoneyInput label="累计运费预算" value={budgetDraft} fallbackValue={100} min={0.01} max={MAX_VALUE}
          disabled={disabled} onValueChange={setBudgetDraft} />
      </div>
      <Help content="预算限制该补给任务的累计现金运费，不是预扣资金。真实燃料另从路线起点保障库存扣除；燃料估值不会再扣一次钱。">预算口径</Help>
      <div className="transport-route-editor-actions">
        <Button type="submit" variant="primary" disabled={disabled || !valid || route.deletionPending}>建立补给</Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => setCreatingSupply(false)}>取消</Button>
      </div>
    </form> : null}
    {activeTasks.length ? <ul className="transport-task-list" aria-label="执行中的运输任务">{activeTasks.map(taskRow)}</ul> : <p className="transport-empty">暂无运输任务，路线仍可自动进行贸易调货。</p>}
    {!route.deletionPending ? <div className="transport-freight-offers">
      <WidgetHeading title="可承接委托" action={<Help content="委托货物属于委托方，不计入你的库存或财富，不能出售和生产。按截止前实际交付数量支付运费，延误货物仍须交付但不再付费。取消、删线或重建路线不会恢复当日已占用的奖励额度。">交付规则</Help>} />
      {business.offers.length ? <ul className="transport-task-list">
        {business.offers.map((offer) => <li className="transport-task-row" key={offer.id} data-transport-offer-id={offer.id}>
          <div className="transport-task-heading"><strong>{productName(offer.productId)} ×<CompactNumber value={offer.quantity} /></strong>
            <span>总运费收入 <CurrencyAmount>{formatCurrency(offer.reward)}</CurrencyAmount></span></div>
          <span>{provinceName(offer.sourceProvinceId)} → {provinceName(offer.destinationProvinceId)}</span>
          <div className="transport-task-heading"><span>交付截止 {new Date(offer.deadlineAt).toLocaleString()}</span>
            <Button variant="secondary" disabled={disabled || activeTasks.length >= 12}
              onClick={() => void submit({ operation: 'task-freight-accept', routeId: route.id, offerId: offer.id })}>承接委托</Button></div>
        </li>)}
      </ul> : <p className="transport-empty">暂无可承接委托。</p>}
    </div> : null}
    {history.length ? <details className="transport-history-details"><summary>已结束任务</summary><ul className="transport-task-list">{history.map(taskRow)}</ul></details> : null}
  </section>;
}
