const SAVE_KEY = 'economy_single_player_save_v1';
const PRODUCE_FOOD_LABOR_COST = 3;
const WORK_COOLDOWN_MS = 200;
const MAX_WORK_SEAT_LEVEL = 3;
const FOOD_PACK_BASE_PRICE = 5;

const WORK_SEAT_YIELDS = {
  1: 1,
  2: 2,
  3: 3,
};

const WORK_SEAT_UPGRADE_COSTS = {
  2: 50,
  3: 150,
};

function createDefaultSave() {
  const now = Date.now();
  return {
    version: 1,
    labor: 0,
    credits: 0,
    goods: {
      foodPack: 0,
    },
    facilities: {
      workSeatLevel: 1,
    },
    market: {
      foodPackPrice: FOOD_PACK_BASE_PRICE,
    },
    stats: {
      totalClicks: 0,
      totalFoodProduced: 0,
      totalFoodSold: 0,
      totalCreditsEarned: 0,
    },
    logs: [
      {
        id: `log-${now}`,
        text: '欢迎进入 Economy。点击工作，开始生产第一份食品包。',
        createdAt: now,
      },
    ],
    updatedAt: now,
  };
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeSave(raw) {
  const fallback = createDefaultSave();
  if (!raw || typeof raw !== 'object') return fallback;

  const workSeatLevel = Math.min(
    MAX_WORK_SEAT_LEVEL,
    Math.max(1, safeNumber(raw.facilities && raw.facilities.workSeatLevel, 1)),
  );

  return {
    version: 1,
    labor: Math.max(0, safeNumber(raw.labor)),
    credits: Math.max(0, safeNumber(raw.credits)),
    goods: {
      foodPack: Math.max(0, safeNumber(raw.goods && raw.goods.foodPack)),
    },
    facilities: {
      workSeatLevel,
    },
    market: {
      foodPackPrice: Math.max(1, safeNumber(raw.market && raw.market.foodPackPrice, FOOD_PACK_BASE_PRICE)),
    },
    stats: {
      totalClicks: Math.max(0, safeNumber(raw.stats && raw.stats.totalClicks)),
      totalFoodProduced: Math.max(0, safeNumber(raw.stats && raw.stats.totalFoodProduced)),
      totalFoodSold: Math.max(0, safeNumber(raw.stats && raw.stats.totalFoodSold)),
      totalCreditsEarned: Math.max(0, safeNumber(raw.stats && raw.stats.totalCreditsEarned)),
    },
    logs: Array.isArray(raw.logs) && raw.logs.length > 0 ? raw.logs.slice(0, 12) : fallback.logs,
    updatedAt: safeNumber(raw.updatedAt, Date.now()),
  };
}

function readSave() {
  try {
    const saved = tt.getStorageSync(SAVE_KEY);
    return normalizeSave(saved);
  } catch (error) {
    return createDefaultSave();
  }
}

function writeSave(save) {
  try {
    tt.setStorageSync(SAVE_KEY, {
      ...save,
      updatedAt: Date.now(),
    });
  } catch (error) {
    tt.showToast({ title: '存档失败', icon: 'none' });
  }
}

Page({
  data: {
    labor: 0,
    credits: 0,
    foodPack: 0,
    foodPackPrice: FOOD_PACK_BASE_PRICE,
    workSeatLevel: 1,
    clickYield: 1,
    totalAsset: 0,
    produceFoodLaborCost: PRODUCE_FOOD_LABOR_COST,
    nextWorkSeatLevel: 2,
    nextUpgradeCost: WORK_SEAT_UPGRADE_COSTS[2],
    isMaxWorkSeatLevel: false,
    canProduceFood: false,
    canSellFood: false,
    canUpgradeWorkSeat: false,
    isWorkCoolingDown: false,
    saveStatus: '未读取',
    logs: [],
    stats: {
      totalClicks: 0,
      totalFoodProduced: 0,
      totalFoodSold: 0,
      totalCreditsEarned: 0,
    },
  },

  onLoad() {
    this.saveData = readSave();
    this.syncView('已读取本地存档');
  },

  onHide() {
    if (this.saveData) writeSave(this.saveData);
  },

  onUnload() {
    if (this.saveData) writeSave(this.saveData);
  },

  syncView(saveStatus) {
    const save = normalizeSave(this.saveData || createDefaultSave());
    this.saveData = save;

    const workSeatLevel = save.facilities.workSeatLevel;
    const clickYield = WORK_SEAT_YIELDS[workSeatLevel] || 1;
    const foodPack = save.goods.foodPack;
    const foodPackPrice = save.market.foodPackPrice;
    const totalAsset = save.credits + foodPack * foodPackPrice;
    const nextWorkSeatLevel = Math.min(workSeatLevel + 1, MAX_WORK_SEAT_LEVEL);
    const isMaxWorkSeatLevel = workSeatLevel >= MAX_WORK_SEAT_LEVEL;
    const nextUpgradeCost = isMaxWorkSeatLevel ? 0 : WORK_SEAT_UPGRADE_COSTS[nextWorkSeatLevel];

    this.setData({
      labor: save.labor,
      credits: save.credits,
      foodPack,
      foodPackPrice,
      workSeatLevel,
      clickYield,
      totalAsset,
      produceFoodLaborCost: PRODUCE_FOOD_LABOR_COST,
      nextWorkSeatLevel,
      nextUpgradeCost,
      isMaxWorkSeatLevel,
      canProduceFood: save.labor >= PRODUCE_FOOD_LABOR_COST,
      canSellFood: foodPack >= 1,
      canUpgradeWorkSeat: !isMaxWorkSeatLevel && save.credits >= nextUpgradeCost,
      saveStatus: saveStatus || this.data.saveStatus,
      logs: save.logs,
      stats: save.stats,
    });
  },

  persistAndSync(logText) {
    if (logText) this.pushLog(logText);
    writeSave(this.saveData);
    this.syncView('已自动保存');
  },

  pushLog(text) {
    const log = {
      id: `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text,
      createdAt: Date.now(),
    };
    this.saveData.logs = [log, ...(this.saveData.logs || [])].slice(0, 12);
  },

  clickWork() {
    if (this.data.isWorkCoolingDown) return;

    const level = this.saveData.facilities.workSeatLevel;
    const amount = WORK_SEAT_YIELDS[level] || 1;
    this.saveData.labor += amount;
    this.saveData.stats.totalClicks += 1;

    this.setData({ isWorkCoolingDown: true });
    this.persistAndSync(`点击工作，获得 ${amount} 劳动力。`);

    setTimeout(() => {
      this.setData({ isWorkCoolingDown: false });
    }, WORK_COOLDOWN_MS);
  },

  produceFoodPack() {
    if (this.saveData.labor < PRODUCE_FOOD_LABOR_COST) {
      tt.showToast({ title: '劳动力不足', icon: 'none' });
      return;
    }

    this.saveData.labor -= PRODUCE_FOOD_LABOR_COST;
    this.saveData.goods.foodPack += 1;
    this.saveData.stats.totalFoodProduced += 1;
    this.persistAndSync(`消耗 ${PRODUCE_FOOD_LABOR_COST} 劳动力，生产 1 个食品包。`);
  },

  sellFoodPack() {
    if (this.saveData.goods.foodPack < 1) {
      tt.showToast({ title: '没有食品包可出售', icon: 'none' });
      return;
    }

    const price = this.saveData.market.foodPackPrice;
    this.saveData.goods.foodPack -= 1;
    this.saveData.credits += price;
    this.saveData.stats.totalFoodSold += 1;
    this.saveData.stats.totalCreditsEarned += price;
    this.persistAndSync(`出售 1 个食品包，获得 ${price} 金融货币。`);
  },

  upgradeWorkSeat() {
    const currentLevel = this.saveData.facilities.workSeatLevel;
    if (currentLevel >= MAX_WORK_SEAT_LEVEL) {
      tt.showToast({ title: '工作席位已满级', icon: 'none' });
      return;
    }

    const nextLevel = currentLevel + 1;
    const cost = WORK_SEAT_UPGRADE_COSTS[nextLevel];
    if (this.saveData.credits < cost) {
      tt.showToast({ title: '金融货币不足', icon: 'none' });
      return;
    }

    this.saveData.credits -= cost;
    this.saveData.facilities.workSeatLevel = nextLevel;
    this.persistAndSync(`花费 ${cost} 金融货币，工作席位升级到 ${nextLevel} 级。`);
  },

  resetGame() {
    tt.showModal({
      title: '重置存档',
      content: '确定要清空当前单机进度吗？',
      success: (res) => {
        if (!res.confirm) return;
        this.saveData = createDefaultSave();
        writeSave(this.saveData);
        this.syncView('已重置存档');
        tt.showToast({ title: '已重置', icon: 'success' });
      },
    });
  },
});
