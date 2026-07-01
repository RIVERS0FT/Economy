const SAVE_KEY = 'economy_single_player_save_v1';
const PRODUCE_FOOD_LABOR_COST = 3;
const WORK_COOLDOWN_MS = 200;
const MAX_WORK_SEAT_LEVEL = 3;
const MAX_VEHICLE_LEVEL = 3;
const MAX_HOUSE_LEVEL = 3;
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

const VEHICLE_LEVELS = {
  0: { name: '步行通勤', value: 0 },
  1: { name: '二手电动车', cost: 30, value: 30 },
  2: { name: '家用代步车', cost: 120, value: 120 },
  3: { name: '商务轿车', cost: 400, value: 400 },
};

const HOUSE_LEVELS = {
  0: { name: '合租小屋', value: 0 },
  1: { name: '单身公寓', cost: 80, value: 80 },
  2: { name: '小区住宅', cost: 300, value: 300 },
  3: { name: '城市别墅', cost: 1000, value: 1000 },
};

function createDefaultSave() {
  const now = Date.now();
  return {
    version: 1,
    profile: {
      age: 18,
      vehicleLevel: 0,
      houseLevel: 0,
    },
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
      yearsPassed: 0,
    },
    logs: [
      {
        id: `log-${now}`,
        text: '欢迎进入《股神传奇》。点击工作，开始生产第一份食品包。',
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
  const vehicleLevel = Math.min(
    MAX_VEHICLE_LEVEL,
    Math.max(0, safeNumber(raw.profile && raw.profile.vehicleLevel, 0)),
  );
  const houseLevel = Math.min(
    MAX_HOUSE_LEVEL,
    Math.max(0, safeNumber(raw.profile && raw.profile.houseLevel, 0)),
  );

  return {
    version: 1,
    profile: {
      age: Math.max(1, safeNumber(raw.profile && raw.profile.age, 18)),
      vehicleLevel,
      houseLevel,
    },
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
      yearsPassed: Math.max(0, safeNumber(raw.stats && raw.stats.yearsPassed)),
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
    age: 18,
    vehicleName: VEHICLE_LEVELS[0].name,
    houseName: HOUSE_LEVELS[0].name,
    vehicleLevel: 0,
    houseLevel: 0,
    nextVehicleLevel: 1,
    nextVehicleName: VEHICLE_LEVELS[1].name,
    nextVehicleCost: VEHICLE_LEVELS[1].cost,
    nextHouseLevel: 1,
    nextHouseName: HOUSE_LEVELS[1].name,
    nextHouseCost: HOUSE_LEVELS[1].cost,
    isMaxVehicleLevel: false,
    isMaxHouseLevel: false,
    canUpgradeVehicle: false,
    canUpgradeHouse: false,
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
      yearsPassed: 0,
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
    const vehicleLevel = save.profile.vehicleLevel;
    const houseLevel = save.profile.houseLevel;
    const vehicleValue = VEHICLE_LEVELS[vehicleLevel].value || 0;
    const houseValue = HOUSE_LEVELS[houseLevel].value || 0;
    const totalAsset = save.credits + foodPack * foodPackPrice + vehicleValue + houseValue;
    const nextWorkSeatLevel = Math.min(workSeatLevel + 1, MAX_WORK_SEAT_LEVEL);
    const isMaxWorkSeatLevel = workSeatLevel >= MAX_WORK_SEAT_LEVEL;
    const nextUpgradeCost = isMaxWorkSeatLevel ? 0 : WORK_SEAT_UPGRADE_COSTS[nextWorkSeatLevel];
    const nextVehicleLevel = Math.min(vehicleLevel + 1, MAX_VEHICLE_LEVEL);
    const nextHouseLevel = Math.min(houseLevel + 1, MAX_HOUSE_LEVEL);
    const isMaxVehicleLevel = vehicleLevel >= MAX_VEHICLE_LEVEL;
    const isMaxHouseLevel = houseLevel >= MAX_HOUSE_LEVEL;
    const nextVehicleCost = isMaxVehicleLevel ? 0 : VEHICLE_LEVELS[nextVehicleLevel].cost;
    const nextHouseCost = isMaxHouseLevel ? 0 : HOUSE_LEVELS[nextHouseLevel].cost;

    this.setData({
      age: save.profile.age,
      vehicleName: VEHICLE_LEVELS[vehicleLevel].name,
      houseName: HOUSE_LEVELS[houseLevel].name,
      vehicleLevel,
      houseLevel,
      nextVehicleLevel,
      nextVehicleName: isMaxVehicleLevel ? '已满级' : VEHICLE_LEVELS[nextVehicleLevel].name,
      nextVehicleCost,
      nextHouseLevel,
      nextHouseName: isMaxHouseLevel ? '已满级' : HOUSE_LEVELS[nextHouseLevel].name,
      nextHouseCost,
      isMaxVehicleLevel,
      isMaxHouseLevel,
      canUpgradeVehicle: !isMaxVehicleLevel && save.credits >= nextVehicleCost,
      canUpgradeHouse: !isMaxHouseLevel && save.credits >= nextHouseCost,
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

  passOneYear() {
    this.saveData.profile.age += 1;
    this.saveData.stats.yearsPassed += 1;
    this.persistAndSync(`又经营了一年，现在 ${this.saveData.profile.age} 岁。`);
  },

  upgradeVehicle() {
    const currentLevel = this.saveData.profile.vehicleLevel;
    if (currentLevel >= MAX_VEHICLE_LEVEL) {
      tt.showToast({ title: '座驾已满级', icon: 'none' });
      return;
    }

    const nextLevel = currentLevel + 1;
    const nextVehicle = VEHICLE_LEVELS[nextLevel];
    if (this.saveData.credits < nextVehicle.cost) {
      tt.showToast({ title: '金融货币不足', icon: 'none' });
      return;
    }

    this.saveData.credits -= nextVehicle.cost;
    this.saveData.profile.vehicleLevel = nextLevel;
    this.persistAndSync(`花费 ${nextVehicle.cost} 金融货币，座驾升级为${nextVehicle.name}。`);
  },

  upgradeHouse() {
    const currentLevel = this.saveData.profile.houseLevel;
    if (currentLevel >= MAX_HOUSE_LEVEL) {
      tt.showToast({ title: '房子已满级', icon: 'none' });
      return;
    }

    const nextLevel = currentLevel + 1;
    const nextHouse = HOUSE_LEVELS[nextLevel];
    if (this.saveData.credits < nextHouse.cost) {
      tt.showToast({ title: '金融货币不足', icon: 'none' });
      return;
    }

    this.saveData.credits -= nextHouse.cost;
    this.saveData.profile.houseLevel = nextLevel;
    this.persistAndSync(`花费 ${nextHouse.cost} 金融货币，房子升级为${nextHouse.name}。`);
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
