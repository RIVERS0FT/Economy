function CommerceHarness({ scope = 'commercial' }: { scope?: 'commercial' | 'regional' | 'global' }) {
  const [tab, setTab] = useState<TabId>(scope === 'global' ? 'buildings' : 'province');
  const [provinceId, setProvinceId] = useState('110000');
  const [marketAssetId, setMarketAssetId] = useState('food');
  const [marketViewMode, setMarketViewMode] = useState<'catalog' | 'detail'>('catalog');
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
  const [groups, setGroups] = useState<CommercialBuildingGroup[]>(() => {
    if (scenario === 'empty') return [];
    const current: CommercialBuildingGroup[] = types.map((type, index) => ({
      commercialTypeId: type.id, provinceId: '110000', count: scenario === 'commercial-long' ? 1_234_567 : 3,
      participatingCount: index === 0 ? 2 : 0, enabled: index !== 1,
      status: index === 0 ? 'running' : index === 1 ? 'stopped' : 'error',
      statusReason: index > 1 ? 'insufficient_input' : undefined,
      cycleStartedAt: index === 0 ? fixtureNow - 180_000 : undefined,
      cycleCompletesAt: index === 0 ? fixtureNow + 120_000 : undefined,
      pendingRevenue: index === 0 ? 101.25 : undefined,
      pendingProfit: index === 0 ? 5 : undefined,
      pendingGoodsConsumed: index === 0 ? 4 : undefined,
      pendingOperatingCost: index === 0 ? 3 : undefined,
      pendingInputValue: index === 0 ? 93.25 : undefined,
      pendingInputs: index === 0 ? type.consumptionInputs.map((input) => ({ ...input, quantity: input.quantity * 2 })) : undefined,
      lifetimeRevenue: 200, lifetimeProfit: 25, lifetimeGoodsConsumed: 40,
    }));
    return [...current, { ...current[0], provinceId: '120000', count: 7 }];
  });
  Object.assign(window, {
    __updateCommercialGroup: (commercialTypeId: string, patch: Partial<CommercialBuildingGroup>) => {
      setGroups((previous) => previous.map((group) => group.commercialTypeId === commercialTypeId && group.provinceId === provinceId ? { ...group, ...patch } : group));
    },
  });
  const industrialGroups = scenario === 'empty' ? [] : base.game.facilityGroups;
  const provinceFacilityGroups = { '110000': industrialGroups,
    '120000': industrialGroups.map((group) => ({ ...group, provinceId: '120000', count: 5, participatingCount: 5 })) };
  const products = [...base.game.products,
    { id: 'food', name: '食品', category: 'consumer', basePrice: 15 },
    { id: 'beverage', name: '饮料', category: 'consumer', basePrice: 18 },
    { id: 'steel', name: '钢材', category: 'industrial', basePrice: 5 },
  ];
  const markets = Object.fromEntries(products.map((product) => [product.id, {
    ...base.game.markets.machinery, productId: product.id,
    lastPrice: product.basePrice, officialPrice: product.basePrice, priceHistory: [],
  }]));
  const inventory = (available: number) => ({ available, frozen: 0, inTransit: 0 });
  const provinceInventories = {
    '110000': { machinery: inventory(580), food: inventory(1), beverage: inventory(0), steel: inventory(100) },
    '120000': { machinery: inventory(10), food: inventory(50), beverage: inventory(50), steel: inventory(20) },
  };
  const model = { ...base, selectedProvinceId: provinceId, selectedProvince: provinces.find((province) => province.id === provinceId) ?? provinces[0],
    setSelectedProvinceId: setProvinceId, marketAssetId, marketViewMode,
    showMarketCatalog: () => setMarketViewMode('catalog'),
    selectMarketAsset: (_kind: AssetKind, productId: string, navigate = true) => {
      setMarketAssetId(productId); setMarketViewMode('detail');
      Object.assign(window, { __lastSelectedAsset: productId });
      if (navigate) setTab('market');
    },
    buildFacility: async () => ({ ok: true, message: '测试建设' }),
    startFacilityGroup: async () => ({ ok: true, message: '测试开工' }),
    stopFacilityGroup: async () => ({ ok: true, message: '测试停工' }),
    setFacilityRecipes: async () => ({ ok: true, message: '测试配置' }),
    game: { ...base.game, credits: 10_000, lastProcessedAt: fixtureNow, commercialBuildingTypes: types,
      commercialBuildingGroups: groups, products, markets, provinceMarkets: { '110000': markets, '120000': markets },
      facilityGroups: provinceFacilityGroups[provinceId as keyof typeof provinceFacilityGroups] ?? [], provinceFacilityGroups,
      inventories: provinceInventories[provinceId as keyof typeof provinceInventories] ?? {}, provinceInventories,
    },
  } as TutorialAwareGameViewModel;
  const page = scope === 'commercial' ? <CommercePage model={model} />
    : tab === 'buildings' ? <GlobalBuildingsPage model={model} />
      : tab === 'province' ? <ProvincePage model={model} />
        : tab === 'market' ? <GlobalMarketPage model={model} /> : <MapPage model={model} />;
  return <GameShell model={model}><FacilityRecipeProfitMarketsProvider markets={model.game.markets}>{page}</FacilityRecipeProfitMarketsProvider></GameShell>;
}
