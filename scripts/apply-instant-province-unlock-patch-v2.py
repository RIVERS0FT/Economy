from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once_text(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}: {old[:100]!r}')
    return text.replace(old, new, 1)


def replace_once(path, old, new):
    text = read(path)
    write(path, replace_once_text(text, old, new, path))


# Province access changes only the current player's authoritative state and must never fall back to a full-world draft.
replace_once(
    'server/src/world-storage-v2.js',
    "const LOCAL_PLAYER_ACTIONS = new Set([\n  'startResearch',",
    "const LOCAL_PLAYER_ACTIONS = new Set([\n  'chooseStartingProvince',\n  'unlockProvince',\n  'startResearch',",
)

# Ordinary actions finish for the caller on the compact authoritative ACK; state reconciliation continues in the background.
path = 'src/app/gameViewModel.ts'
text = read(path)
start = text.index('  const runAction = useCallback(')
end = text.index('\n\n  const runAcknowledgedAction = useCallback(', start)
block = text[start:end]
block = replace_once_text(
    block,
    """    if (action === 'checkIn') {
      checkInPendingRef.current = true;
      setIsCheckingIn(true);
    }
    try {""",
    """    if (action === 'checkIn') {
      checkInPendingRef.current = true;
      setIsCheckingIn(true);
    }
    const finish = () => {
      actionsInFlightRef.current = Math.max(0, actionsInFlightRef.current - 1);
      if (action === 'work') {
        workPendingRef.current = false;
        setIsWorking(false);
      }
      if (action === 'checkIn') {
        checkInPendingRef.current = false;
        setIsCheckingIn(false);
      }
    };
    try {""",
    f'{path}:runAction pending block',
)
block = replace_once_text(
    block,
    '      await syncConfirmedAction(response, action);',
    '      void syncConfirmedAction(response, action).finally(finish);',
    f'{path}:runAction sync',
)
block = replace_once_text(
    block,
    """    } catch (reason) {
      if (reason instanceof GameApiError && reason.status === 401) handleUnauthorized();""",
    """    } catch (reason) {
      finish();
      if (reason instanceof GameApiError && reason.status === 401) handleUnauthorized();""",
    f'{path}:runAction catch',
)
error_return = "      return { ok: false, message: messageFromError(reason) };\n"
error_return_end = block.index(error_return, block.index('    } catch (reason) {')) + len(error_return)
expected_suffix = """    } finally {
      actionsInFlightRef.current = Math.max(0, actionsInFlightRef.current - 1);
      if (action === 'work') {
        workPendingRef.current = false;
        setIsWorking(false);
      }
      if (action === 'checkIn') {
        checkInPendingRef.current = false;
        setIsCheckingIn(false);
      }
    }
  }, [handleUnauthorized, syncConfirmedAction]);"""
if block[error_return_end:] != expected_suffix:
    raise SystemExit(f'{path}:runAction finally block no longer matches expected source')
block = block[:error_return_end] + "    }\n  }, [handleUnauthorized, syncConfirmedAction]);"
write(path, text[:start] + block + text[end:])

# Province unlock gets immediate local pending feedback and exits the locked view as soon as the server ACKs success.
path = 'src/pages/ProvincePage.tsx'
text = read(path)
text = replace_once_text(
    text,
    """function ProvinceUnlockPanel({
  model,
  provinceName,
  unlockCost,
  distanceKm,
  section,
}: {
  model: OnlineAutoTradeAwareGameViewModel;
  provinceName: string;
  unlockCost: number;
  distanceKm: number;
  section: 'buildings' | 'warehouse';
}) {""",
    """function ProvinceUnlockPanel({
  model,
  provinceName,
  unlockCost,
  distanceKm,
  section,
  unlocking,
  onUnlock,
}: {
  model: OnlineAutoTradeAwareGameViewModel;
  provinceName: string;
  unlockCost: number;
  distanceKm: number;
  section: 'buildings' | 'warehouse';
  unlocking: boolean;
  onUnlock: () => void;
}) {""",
    f'{path}:unlock panel props',
)
text = replace_once_text(
    text,
    """      <Button
        block
        className="province-unlock-button"
        disabled={model.game.credits < unlockCost}
        onClick={() => void model.showResult(model.unlockProvince(model.selectedProvinceId))}
      >
        {model.game.credits < unlockCost
          ? `资金不足，需要 ${formatCurrency(unlockCost)}`
          : `解锁${provinceName}（${formatCurrency(unlockCost)}）`}
      </Button>""",
    """      <Button
        block
        className="province-unlock-button"
        disabled={unlocking || model.game.credits < unlockCost}
        onClick={onUnlock}
      >
        {unlocking
          ? '正在解锁…'
          : model.game.credits < unlockCost
            ? `资金不足，需要 ${formatCurrency(unlockCost)}`
            : `解锁${provinceName}（${formatCurrency(unlockCost)}）`}
      </Button>""",
    f'{path}:unlock button',
)
text = replace_once_text(
    text,
    """  const [fallbackSection, setFallbackSection] = useState<ProvinceSection>('overview');
  const [fallbackFacilityDetailTypeId, setFallbackFacilityDetailTypeId] = useState<string | null>(null);""",
    """  const [fallbackSection, setFallbackSection] = useState<ProvinceSection>('overview');
  const [fallbackFacilityDetailTypeId, setFallbackFacilityDetailTypeId] = useState<string | null>(null);
  const [confirmedUnlockedProvinceIds, setConfirmedUnlockedProvinceIds] = useState<string[]>([]);
  const [unlockingProvinceIds, setUnlockingProvinceIds] = useState<string[]>([]);""",
    f'{path}:unlock state',
)
text = replace_once_text(
    text,
    """  const isUnlocked = !hasProvinceUnlockState
    || (model.game.unlockedProvinces ?? []).includes(model.selectedProvinceId)
    || model.game.startingProvinceId === model.selectedProvinceId;""",
    """  const isServerUnlocked = !hasProvinceUnlockState
    || (model.game.unlockedProvinces ?? []).includes(model.selectedProvinceId)
    || model.game.startingProvinceId === model.selectedProvinceId;
  const isUnlocked = isServerUnlocked || confirmedUnlockedProvinceIds.includes(model.selectedProvinceId);""",
    f'{path}:unlock authority',
)
text = replace_once_text(
    text,
    """  const distanceKm = model.selectedProvince && model.game.provinces.length > 0
    ? Math.round(provinceDistanceKm(
      model.selectedProvince,
      model.game.provinces.find((province) => province.id === model.game.startingProvinceId) ?? model.selectedProvince,
    ))
    : 0;

  useEffect(() => {""",
    """  const distanceKm = model.selectedProvince && model.game.provinces.length > 0
    ? Math.round(provinceDistanceKm(
      model.selectedProvince,
      model.game.provinces.find((province) => province.id === model.game.startingProvinceId) ?? model.selectedProvince,
    ))
    : 0;

  const unlockSelectedProvince = async () => {
    const provinceId = model.selectedProvinceId;
    if (unlockingProvinceIds.includes(provinceId)) return;
    setUnlockingProvinceIds((current) => [...current, provinceId]);
    try {
      const result = await model.unlockProvince(provinceId);
      model.notify(result.message);
      if (result.ok) {
        setConfirmedUnlockedProvinceIds((current) => (
          current.includes(provinceId) ? current : [...current, provinceId]
        ));
      }
    } finally {
      setUnlockingProvinceIds((current) => current.filter((id) => id !== provinceId));
    }
  };

  useEffect(() => {
    if (!isServerUnlocked) return;
    setConfirmedUnlockedProvinceIds((current) => (
      current.includes(model.selectedProvinceId)
        ? current.filter((id) => id !== model.selectedProvinceId)
        : current
    ));
  }, [isServerUnlocked, model.selectedProvinceId]);

  useEffect(() => {""",
    f'{path}:unlock handler',
)
for section in ('buildings', 'warehouse'):
    text = replace_once_text(
        text,
        f"""              distanceKm={{distanceKm}}
              section="{section}"
            />""",
        f"""              distanceKm={{distanceKm}}
              section="{section}"
              unlocking={{unlockingProvinceIds.includes(model.selectedProvinceId)}}
              onUnlock={{() => void unlockSelectedProvince()}}
            />""",
        f'{path}:{section} unlock props',
    )
write(path, text)

# Resolve the stale page-design rule and lock the instant interaction contract into authoritative docs.
replace_once(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    "新玩家首次进入游戏必须先选择起始州（永久绑定、不可更换）；未解锁州点击后只显示解锁面板：距离起始州距离、货币费用、当前资金与解锁按钮，按钮在资金不足时禁用并说明原因，不显示“概览｜市场｜建筑｜仓库”四个分区。已解锁州标题下固定使用“概览｜市场｜建筑｜仓库”四个互斥切换按钮；控件使用完整 `tablist`／`tab`／`tabpanel` 语义、方向键与 Home／End 键盘导航，并保持至少 `44px` 触控高度。",
    "新玩家首次进入游戏必须先选择起始州（永久绑定、不可更换）；未解锁州仍保留“概览｜市场｜建筑｜仓库”四个分区，概览与市场继续可用，市场保持只读；建筑与仓库分区分别显示距离起始州、货币费用、当前资金与统一解锁按钮，按钮在资金不足时禁用并说明原因。州解锁按钮点击后必须立即进入本地提交中状态，收到服务器精简确认后立即退出锁定视图，动作后的权威状态补拉只在后台对账，不得阻塞按钮结果；服务器确认前不得把资金或州权限作为成功状态乐观写入。已解锁州标题下固定使用“概览｜市场｜建筑｜仓库”四个互斥切换按钮；控件使用完整 `tablist`／`tab`／`tabpanel` 语义、方向键与 Home／End 键盘导航，并保持至少 `44px` 触控高度。",
)
replace_once(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    "未知或尚未局部化的动作可以暂时退回完整草稿，但不得为了回滚、投影或持久化再创建第二份完整世界。",
    "未知或尚未局部化的动作可以暂时退回完整草稿，但不得为了回滚、投影或持久化再创建第二份完整世界。起始州选择与州解锁只修改当前玩家资金、统计和州访问字段，必须固定使用当前玩家局部 Mutation Scope；不得因这类 O(1) 玩家写入复制、比较或序列化全部玩家与全部世界 segment。",
)
replace_once(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    "浏览器在动作确认后使用动作发起前已经接受的全局 `revision` 与当前分区哈希立即补拉 `GET state`；不得在补拉前直接写入客户端状态修订号。补拉失败不得把已经提交成功的动作改写为失败。",
    "浏览器在动作确认后使用动作发起前已经接受的全局 `revision` 与当前分区哈希立即补拉 `GET state`；不得在补拉前直接写入客户端状态修订号。补拉失败不得把已经提交成功的动作改写为失败。普通玩家交互不得把动作后的 `GET state` 纳入按钮、表单或提示的阻塞完成路径：请求发出时立即进入本地 pending，收到精简动作确认后立即返回成功或失败，状态补拉在后台继续；服务器确认前不得乐观修改资金、库存、州权限或其他权威经济状态，确认后只允许用不推进客户端权威修订号的短暂 confirmed UI 覆盖消除视觉等待。",
)

# Regression guards.
replace_once(
    'scripts/verify-provincial-unlock-transport.mjs',
    "requireText(pageDesign, '未解锁州点击后只显示解锁面板', '页面设计必须记录解锁面板。');",
    "requireText(pageDesign, '未解锁州仍保留“概览｜市场｜建筑｜仓库”四个分区', '页面设计必须记录未解锁州仍可浏览概览和市场。');\nrequireText(pageDesign, '收到服务器精简确认后立即退出锁定视图', '页面设计必须记录州解锁确认后的瞬时退出锁定视图。');",
)
replace_once(
    'scripts/verify-provincial-unlock-transport.mjs',
    "requireText(storageV2, \"'transportShip'\", '运输动作必须使用局部玩家 Mutation Scope。');",
    "requireText(storageV2, \"'transportShip'\", '运输动作必须使用局部玩家 Mutation Scope。');\nrequireText(storageV2, \"'chooseStartingProvince'\", '起始州选择必须使用局部玩家 Mutation Scope。');\nrequireText(storageV2, \"'unlockProvince'\", '州解锁必须使用局部玩家 Mutation Scope。');",
)
replace_once(
    'scripts/verify-provincial-unlock-transport.mjs',
    "requireText(provincePage, 'unlockProvince(model.selectedProvinceId)', '州页解锁按钮必须调用解锁动作。');",
    "requireText(provincePage, 'model.unlockProvince(provinceId)', '州页解锁按钮必须调用解锁动作。');\nrequireText(provincePage, 'confirmedUnlockedProvinceIds', '州页必须在服务器确认后立即退出锁定视图。');\nrequireText(provincePage, \"'正在解锁…'\", '州页解锁按钮必须立即显示提交中状态。');",
)

path = 'scripts/verify-client-response-performance.mjs'
text = read(path)
marker = "if (failures.length > 0) {\n  console.error('客户端响应性能防回退验证失败:');"
text = replace_once_text(
    text,
    marker,
    "requireText('src/app/gameViewModel.ts', [\n  'void syncConfirmedAction(response, action).finally(finish);',\n]);\nforbidText('src/app/gameViewModel.ts', [\n  'await syncConfirmedAction(response, action);',\n]);\n\n" + marker,
    path,
)
write(path, text)

path = 'server/test/world-storage-v2.test.js'
text = read(path)
test_marker = "test('transport route mutation uses the current-player local scope', () => {"
province_scope_test = """test('province access mutations use the current-player local scope', () => {
  const world = {
    players: {
      1: { userId: 1, credits: 5000, unlockedProvinces: ['110000'] },
      2: { userId: 2, credits: 5000, unlockedProvinces: ['110000'] },
    },
    orders: [],
    markets: {},
    bank: {},
    weeklyCashSettlement: {},
    populationEconomy: {},
    marketDemand: {},
    stats: {},
    moneyPrecision: { version: 2 },
    auctionFeeEscrowCredits: 0,
    systemMarketAudit: {},
    transportShipments: [],
    version: 32,
  };

  for (const actionName of ['chooseStartingProvince', 'unlockProvince']) {
    const scope = createRuntimeMutationScope(world, alice.id, actionName, { provinceId: '130000' }, {
      scheduledProcessing: true,
    });
    assert.equal(scope.allPlayers, false);
    assert.equal(scope.allSegments, false);
    assert.deepEqual([...scope.playerIds], ['1']);
    assert.equal(scope.label, `local:${actionName}`);
    assert.equal(scope.segments.has('orders'), false);
    assert.equal(scope.segments.has('markets'), false);

    const draft = cloneWorldForMutation(world, scope);
    assert.notEqual(draft.players['1'], world.players['1']);
    assert.equal(draft.players['2'], world.players['2']);
    assert.equal(draft.orders, world.orders);
    assert.equal(draft.markets, world.markets);
  }
});

"""
text = replace_once_text(text, test_marker, province_scope_test + test_marker, path)
write(path, text)
