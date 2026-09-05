function CommerceHarness() {
  const [tab, setTab] = useState<TabId>('province');
  const fixtureNow = useMemo(() => Date.now(), []);
  const base = useMemo(() => buildOverviewModel(tab, setTab), [tab]);
  const types = [
    { id: 'convenience-store', name: '便利店', profitPerCycle: 2.5, consumptionInputs: [{ productId: 'food', quantity: 1 }, { productId: 'beverage', quantity: 1 }] },
    { id: 'fresh-market', name: '生鲜超市', profitPerCycle: 3.2, consumptionInputs: [{ productId: 'fruit', quantity: 2 }] },
    { id: 'restaurant', name: '餐厅', profitPerCycle: 4.5, consumptionInputs: [{ productId: 'prepared-meal', quantity: 2 }] },
    { id: 'clothing-store', name: '服装店', profitPerCycle: 5, consumptionInputs: [{ productId: 'clothing', quantity: 1 }] },
    { id: 'furniture-showroom', name: '家具商场', profitPerCycle: 6, consumptionInputs: [{ productId: 'furniture', quantity: 1 }] },
    { id: 'appliance-store', name: '家电卖场', profitPerCycle: 8, consumptionInputs: [{ productId: 'appliance', quantity: 1 }] },
  ].map((type) => ({ ...type, name: scenario === 'commercial-long' ? `${type.name}超长名称移动端边界验证` : type.name,
    description: '', buildCost: 120, operatingCost: 1.5, cycleMs: 300_000, systemValue: 120 }));
  const [groups, setGroups] = useState<CommercialBuildingGroup[]>(() => scenario === 'empty' ? [] : types.map((type, index) => ({
    commercialTypeId: type.id, provinceId: base.selectedProvinceId, count: scenario === 'commercial-long' ? 1_234_567 : 3,
    participatingCount: index === 0 ? 2 : 0, enabled: index !== 1,
    status: index === 0 ? 'running' : index === 1 ? 'stopped' : 'error',
    statusReason: index > 1 ? 'insufficient_input' : undefined,
    cycleStartedAt: index === 0 ? fixtureNow - 180_000 : undefined,
    cycleCompletesAt: index === 0 ? fixtureNow + 120_000 : undefined,
    pendingRevenue: 101.25, pendingProfit: 5, pendingGoodsConsumed: 4,
    lifetimeRevenue: 200, lifetimeProfit: 25, lifetimeGoodsConsumed: 40,
  })));
  Object.assign(window, {
    __updateCommercialGroup: (commercialTypeId: string, patch: Partial<CommercialBuildingGroup>) => {
      setGroups((previous) => previous.map((group) => group.commercialTypeId === commercialTypeId ? { ...group, ...patch } : group));
    },
  });
  const model = { ...base, game: { ...base.game, lastProcessedAt: fixtureNow, commercialBuildingTypes: types,
    commercialBuildingGroups: [...groups, ...(groups.length ? [{ ...groups[0], commercialTypeId: 'foreign-only', provinceId: 'other-province', count: 777 }] : [])],
    inventories: { ...base.game.inventories, food: { available: 1, reserved: 0 }, beverage: { available: 0, reserved: 0 } },
  } };
  return <GameShell model={model}><CommercePage model={model} /></GameShell>;
}

