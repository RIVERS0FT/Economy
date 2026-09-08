from pathlib import Path


def replace(path, old, new):
    file = Path(path)
    text = file.read_text()
    assert text.count(old) == 1, (path, old[:100], text.count(old))
    file.write_text(text.replace(old, new))


building = 'src/pages/BuildingsPage.tsx'
replace(building, "import { useEffect, useMemo, useState } from 'react';", "import { useEffect, useMemo, useRef, useState } from 'react';")
replace(building, '''  const [procurementQuoteState, setProcurementQuoteState] = useState<{
    key: string;
    quote: FacilityBuildProcurementQuote;
  } | null>(null);
  const [procurementQuoteLoading, setProcurementQuoteLoading] = useState(false);
  const [procurementQuoteError, setProcurementQuoteError] = useState('');''', '''  const [procurementQuoteState, setProcurementQuoteState] = useState<{
    key: string;
    quote: FacilityBuildProcurementQuote | null;
    loading: boolean;
    error: string;
  } | null>(null);
  const [procurementQuoteAttempt, setProcurementQuoteAttempt] = useState(0);
  const [buildPending, setBuildPending] = useState(false);
  const buildPendingRef = useRef(false);''')
old_derived = '''  const selectedBuildInputs = selectedType.buildInputs ?? [];
  const buildCashCost = selectedType.buildCost * buildQuantity;
  const buildMaterialRequirements = selectedBuildInputs.map((item) => {
    const available = game.inventories[item.productId]?.available ?? 0;
    const required = item.quantity * buildQuantity;
    return {
      productId: item.productId,
      available,
      required,
      missing: Math.max(0, required - available),
    };
  });
  const missingBuildMaterials = buildMaterialRequirements
    .filter((item) => item.missing > 0)
    .map((item) => ({ productId: item.productId, quantity: item.missing }));
  const procurementQuoteKey = `${model.selectedProvinceId}:${selectedType.id}:${buildQuantity}`;
  const procurementQuote = procurementQuoteState?.key === procurementQuoteKey
    ? procurementQuoteState.quote
    : null;
  const needsProcurement = missingBuildMaterials.length > 0;
'''
replace(building, old_derived, '')
new_derived = '''  const selectedBuildInputs = selectedType?.buildInputs ?? [];
  const buildCashCost = (selectedType?.buildCost ?? 0) * buildQuantity;
  const buildMaterialRequirements = selectedBuildInputs.map((item) => {
    const available = game.inventories[item.productId]?.available ?? 0;
    const required = item.quantity * buildQuantity;
    return {
      productId: item.productId,
      available,
      required,
      missing: Math.max(0, required - available),
    };
  });
  const missingBuildMaterials = buildMaterialRequirements
    .filter((item) => item.missing > 0)
    .map((item) => ({ productId: item.productId, quantity: item.missing }));
  const needsProcurement = missingBuildMaterials.length > 0;
  const selectedBuildTypeId = selectedType?.id ?? '';
  const buildFormVisible = renderPart === 'build' || (renderPart !== 'cards' && !selectedFacilityEntry);
  // Compare business inputs, not partition object identities. A poll can replace
  // every inventory/market object without changing this construction's quote.
  const procurementQuoteKey = JSON.stringify([
    game.userId, game.saveEpoch, model.selectedProvinceId, selectedBuildTypeId, buildQuantity,
    missingBuildMaterials.map((item) => [
      item.productId, item.quantity, game.markets[item.productId]?.officialPrice ?? null,
    ]),
  ]);
  const currentProcurementQuote = needsProcurement && procurementQuoteState?.key === procurementQuoteKey
    ? procurementQuoteState
    : null;
  const procurementQuote = currentProcurementQuote?.quote ?? null;
  const procurementQuoteLoading = needsProcurement && (!currentProcurementQuote || currentProcurementQuote.loading);
  const procurementQuoteError = currentProcurementQuote?.error ?? '';

  useEffect(() => {
    if (!selectedBuildTypeId || !needsProcurement || !buildFormVisible) {
      setProcurementQuoteState(null);
      return undefined;
    }
    const controller = new AbortController();
    const contextKey = procurementQuoteKey;
    setProcurementQuoteState({ key: contextKey, quote: null, loading: true, error: '' });
    void getFacilityBuildProcurementQuote(
      model.selectedProvinceId,
      selectedBuildTypeId,
      buildQuantity,
      controller.signal,
    ).then((quote) => {
      if (controller.signal.aborted) return;
      if (!quote.complete || !Number.isFinite(quote.estimatedTotal) || quote.estimatedTotal < 0
        || missingBuildMaterials.some((item) => !Number.isFinite(quote.materialPriceCaps?.[item.productId])
          || quote.materialPriceCaps[item.productId] <= 0)) {
        throw new Error('服务器采购报价不完整，请重新获取');
      }
      setProcurementQuoteState({ key: contextKey, quote, loading: false, error: '' });
    }).catch((reason) => {
      if (controller.signal.aborted) return;
      setProcurementQuoteState({
        key: contextKey, quote: null, loading: false,
        error: reason instanceof Error ? reason.message : '建造采购报价加载失败',
      });
    });
    return () => controller.abort();
  }, [buildQuantity, procurementQuoteKey, procurementQuoteAttempt, needsProcurement,
    model.selectedProvinceId, selectedBuildTypeId, buildFormVisible]);
'''
old_effect = '''  useEffect(() => {
    if (!selectedType || renderPart === 'cards') return undefined;
    const contextKey = `${model.selectedProvinceId}:${selectedType.id}:${buildQuantity}`;
    const controller = new AbortController();
    setProcurementQuoteLoading(true);
    setProcurementQuoteError('');
    void getFacilityBuildProcurementQuote(
      model.selectedProvinceId,
      selectedType.id,
      buildQuantity,
      controller.signal,
    ).then((quote) => {
      if (controller.signal.aborted) return;
      setProcurementQuoteState({ key: contextKey, quote });
    }).catch((reason) => {
      if (controller.signal.aborted) return;
      setProcurementQuoteError(reason instanceof Error ? reason.message : '建造采购报价加载失败');
    }).finally(() => {
      if (!controller.signal.aborted) setProcurementQuoteLoading(false);
    });
    return () => controller.abort();
  }, [buildQuantity, game.inventories, game.markets, model.selectedProvinceId, selectedType, renderPart]);
'''
replace(building, old_effect, new_derived)
replace(building, '  const actionDisabledReason = buildDisabledReason;', '''  const canRetryProcurementQuote = needsProcurement && Boolean(procurementQuoteError) && game.credits >= buildCashCost;
  const buildAction = buildPending ? 'submitting'
    : canRetryProcurementQuote ? 'retry-quote'
      : buildDisabledReason ? 'blocked' : 'ready';
  const actionDisabledReason = buildDisabledReason;''')
replace(building, '''  const submitBuild = () => {
    if (actionDisabledReason) return;
    if (!needsProcurement) {
      void showResult(buildFacility(selectedType.id, buildQuantity));
      return;
    }
    if (!procurementQuote) return;
    void showResult(buildFacility(selectedType.id, buildQuantity, {
      autoProcure: true,
      maxProcurementTotal: procurementQuote.estimatedTotal,
      materialPriceCaps: procurementQuote.materialPriceCaps,
    }));
  };''', '''  const submitBuild = async () => {
    if (buildPendingRef.current) return;
    if (buildAction === 'retry-quote') {
      setProcurementQuoteState({ key: procurementQuoteKey, quote: null, loading: true, error: '' });
      setProcurementQuoteAttempt((attempt) => attempt + 1);
      return;
    }
    if (buildAction !== 'ready' || (needsProcurement && !procurementQuote)) return;
    buildPendingRef.current = true;
    setBuildPending(true);
    try {
      const result = await buildFacility(selectedType.id, buildQuantity, needsProcurement && procurementQuote ? {
        autoProcure: true,
        maxProcurementTotal: procurementQuote.estimatedTotal,
        materialPriceCaps: procurementQuote.materialPriceCaps,
      } : undefined);
      // The authoritative receipt ends submission; notification/state refresh is
      // not a second submission lock. The shared write layer still owns retries.
      void Promise.resolve().then(() => showResult(result)).catch(() => {});
    } catch (reason) {
      void Promise.resolve().then(() => showResult({
        ok: false, message: reason instanceof Error ? reason.message : '建造失败，请稍后重试',
      })).catch(() => {});
    } finally {
      buildPendingRef.current = false;
      setBuildPending(false);
    }
  };''')
replace(building, '''        onClick={submitBuild}
        disabled={Boolean(actionDisabledReason) || procurementQuoteLoading}
      >
        {needsProcurement''', '''        onClick={() => void submitBuild()}
        disabled={buildAction === 'blocked' || buildAction === 'submitting'}
        aria-busy={buildPending}
      >
        {buildPending ? '正在建造…' : buildAction === 'retry-quote' ? '重试采购报价' : needsProcurement''')

shop = 'src/pages/GemShopPage.tsx'
replace(shop, "import { useEffect, useMemo, useState } from 'react';", "import { useEffect, useMemo, useRef, useState } from 'react';")
replace(shop, 'const QUICK_AMOUNTS = [1, 5, 10, 25];', '''const QUICK_AMOUNTS = [1, 5, 10, 25];

type ConfirmedQuoteDecision = Pick<GemShopSummary, 'quoteDateKey' | 'nextRateAt'> & {
  decision: 'accepted' | 'rejected';
};

function sameQuoteDay(left: Pick<GemShopSummary, 'quoteDateKey' | 'nextRateAt'>, right: Pick<GemShopSummary, 'quoteDateKey' | 'nextRateAt'>) {
  if (left.quoteDateKey && right.quoteDateKey) return left.quoteDateKey === right.quoteDateKey;
  return left.nextRateAt === right.nextRateAt && left.quoteDateKey === right.quoteDateKey;
}''')
replace(shop, '''  async function load() {
    try {
      setSummary(await getGemShopSummary());
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法读取商店');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);''', '''  const pendingDecisionRef = useRef(false);
  const confirmedDecisionRef = useRef<ConfirmedQuoteDecision | null>(null);
  const summaryRequestRef = useRef(0);
  const mountedRef = useRef(false);

  async function load(background = false) {
    const generation = ++summaryRequestRef.current;
    try {
      const incoming = await getGemShopSummary();
      if (!mountedRef.current || generation !== summaryRequestRef.current) return;
      const confirmed = confirmedDecisionRef.current;
      // A late same-day preview may not reopen a decision already acknowledged.
      setSummary(confirmed && sameQuoteDay(incoming, confirmed)
        ? { ...incoming, quoteDecision: confirmed.decision }
        : incoming);
      setError('');
    } catch (reason) {
      if (!mountedRef.current || generation !== summaryRequestRef.current) return;
      const message = reason instanceof Error ? reason.message : '无法读取商店';
      if (background) model.notify(`操作已完成，但商店数据刷新失败：${message}`);
      else setError(message);
    } finally {
      if (mountedRef.current && generation === summaryRequestRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => { mountedRef.current = false; summaryRequestRef.current += 1; };
  }, []);

  function acknowledgeQuote(decision: ConfirmedQuoteDecision['decision']) {
    if (!summary) return;
    const confirmed = { quoteDateKey: summary.quoteDateKey, nextRateAt: summary.nextRateAt, decision };
    confirmedDecisionRef.current = confirmed;
    summaryRequestRef.current += 1;
    setSummary((current) => current && sameQuoteDay(current, confirmed)
      ? { ...current, quoteDecision: decision }
      : current);
  }''')
replace(shop, '''  async function exchange() {
    if (!validAmount || exchanging || parsedAmount === null) return;
    setExchanging(true);
    try {
      const result = await model.exchangeGems(parsedAmount);
      await model.showResult(result);
      if (result.ok) {
        setAmountValue(1);
        await load();
      }
    } finally {
      setExchanging(false);
    }
  }

  async function rejectQuote() {
    if (!summary || quoteDecision !== 'pending' || rejecting || exchanging) return;
    setRejecting(true);
    try {
      const response = await gameActions.rejectGemShopQuote();
      await model.showResult(response.result);
      if (response.result.ok) await load();
    } catch (reason) {
      model.notify(reason instanceof Error ? reason.message : '无法放弃今日报价');
    } finally {
      setRejecting(false);
    }
  }''', '''  async function exchange() {
    if (!validAmount || pendingDecisionRef.current || parsedAmount === null) return;
    pendingDecisionRef.current = true;
    setExchanging(true);
    try {
      const result = await model.exchangeGems(parsedAmount);
      if (result.ok) {
        acknowledgeQuote('accepted');
        setAmountValue(1);
        void load(true);
      }
      void Promise.resolve().then(() => model.showResult(result)).catch(() => {});
    } catch (reason) {
      model.notify(reason instanceof Error ? reason.message : '无法兑换宝石');
    } finally {
      pendingDecisionRef.current = false;
      setExchanging(false);
    }
  }

  async function rejectQuote() {
    if (!summary || quoteDecision !== 'pending' || pendingDecisionRef.current) return;
    pendingDecisionRef.current = true;
    setRejecting(true);
    try {
      const response = await gameActions.rejectGemShopQuote();
      if (response.result.ok) {
        acknowledgeQuote('rejected');
        void load(true);
      }
      void Promise.resolve().then(() => model.showResult(response.result)).catch(() => {});
    } catch (reason) {
      model.notify(reason instanceof Error ? reason.message : '无法放弃今日报价');
    } finally {
      pendingDecisionRef.current = false;
      setRejecting(false);
    }
  }''')

page_design = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
anchor = '建设卡不显示施工时间、施工任务、剩余时间、确认完工或宝石施工加速。'
replace(page_design, anchor, '''工业建设表单只有存在当前建材缺口且表单实际可见时才读取采购报价；无需材料或材料齐全时立即允许符合资金等业务条件的直接建造，不得被采购报价的加载、错误或旧结果禁用。报价上下文按玩家、存档世代、地区、工厂类型、数量、实际缺口与相关官方价格隔离；无关商品库存、行情变化或相同业务内容的对象引用替换不得重取报价。上下文变化或退出采购需求后，旧响应不得覆盖当前报价或重新锁住直接建造。失败或不完整报价不允许采购建造，原按钮可以显示“重试采购报价”并只重发只读查询；不得把重试报价当作建设提交。建设提交期间以局部提交状态阻止重复点击，报价、提交和通知／确认后状态补拉互不冒充；不新增正文结果区。行为回归由 `tests/browser/build-action-readiness.spec.ts` 覆盖无需报价、缺口变化、无关分区变化、乱序、失败重试与提交恢复。

''' + anchor)
anchor = '## 11. 设置与教程'
replace(page_design, anchor, '''商店收到接受或放弃报价的明确成功回执后，立即显示该报价日的已接受／已放弃状态并结束提交等待；余额、累计兑换与记录等数据继续后台读取，不得把摘要请求或通知等待当作操作仍在提交。背景读取失败只通过通知说明，保留已经确认的决策，不伪造资产和历史；同一报价日的迟到摘要不得恢复“待决定”或重新允许兑换，新的服务器报价日不沿用旧日决策。失败回执不得被标记为成功决策。通用提交与状态恢复边界见 `AUTHORITATIVE_COUNTDOWN_DESIGN.md`；行为回归见 `tests/browser/build-action-readiness.spec.ts`。

''' + anchor)
authority = 'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md'
anchor = '状态恢复沿用 8 秒读取截止时间，失败、超时和 reset 均必须释放协调状态'
replace(authority, anchor, '''操作提交状态只覆盖该逻辑写请求及其同键确认，不包含无关的只读报价、摘要、历史、通知或已确认后的补拉等待。页面不得以后台读取 busy 替代提交 busy；明确回执与最近权威状态继续按各页面规则展示，后台读取失败不撤销已确认结果。只读请求的状态须与当前查询上下文绑定，清理或迟到响应不得结束另一个上下文的请求；已有读取时限及经济写幂等确认机制保持不变。

''' + anchor)
print('Applied scoped construction, shop, and authoritative design updates.')
