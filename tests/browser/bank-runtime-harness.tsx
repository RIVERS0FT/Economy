import { createRoot } from 'react-dom/client';
import '../../src/app/interactionBootstrap';
import type { LoadedGameViewModel } from '../../src/app/gameViewModel';
import { BankPage } from '../../src/pages/BankPage';
import '../../src/styles/globals.css';
import '../../src/styles/charts.css';
import '../../src/styles/card-system.css';
import '../../src/styles/icon-system.css';
import '../../src/styles/asset-overview.css';
import '../../src/styles/bank.css';
import '../../src/styles/design-system.css';
import '../../src/styles/interaction-states.css';
import '../../src/styles/primary-surfaces.css';
import '../../src/styles/form-controls.css';

const fixedNow = Date.UTC(2026, 6, 20, 4, 0, 0);
document.documentElement.dataset.appSurface = 'game';

const model = {
  game: {
    version: 44,
    lastProcessedAt: fixedNow,
    credits: 1_500,
    frozenCredits: 200,
    inventories: { wheat: { available: 5, frozen: 2 } },
    products: [{ id: 'wheat', name: '小麦', category: 'raw', basePrice: 2 }],
    provinces: [{ id: '110000', name: '加利福尼亚', shortName: 'CA', mapName: 'California' }],
    facilityGroups: [{
      provinceId: '110000', facilityTypeId: 'farm', count: 6, participatingCount: 5,
      productionAvailableCount: 5, projectedEffectiveCount: 5,
      listedCount: 1, auctionedCount: 0, frozenCount: 1, mortgagedCount: 0,
      contractCollateralCount: 0, leasedOutCount: 0, leasedInCount: 0,
      availableCount: 5, enabled: true, status: 'running',
      staffingRateBps: 10_000, staffingUpdatedAt: fixedNow, staffingBatchCarryBps: 0,
      lifetimeOutput: 40, activeRecipeId: 'wheat-crop',
    }],
    facilityTypes: [{
      id: 'farm', name: '农场', category: 'raw', complexity: 'C1', buildCost: 65,
      buildTimeMs: 0, cycleMs: 120_000, operatingCost: 6, inputs: [],
      output: { productId: 'wheat', quantity: 4 }, defaultRecipeId: 'wheat-crop',
      recipes: [{ id: 'wheat-crop', name: '种植小麦', cycleMs: 120_000, operatingCost: 6, inputs: [], output: { productId: 'wheat', quantity: 4 } }],
      systemValue: 65,
    }],
    commercialBuildingGroups: [],
    commercialBuildingTypes: [],
    bankAccount: {
      depositCredits: 500,
      eligibleDepositCredits: 400,
      depositInterestCarryMicros: 250_000,
      totalDepositInterestEarned: 12,
      lastDepositInterestEarned: 1,
      repaidLoanCount: 1,
      recentDefaultAt: null,
      activeLoan: null,
      recentTransactions: [{ id: 'bank-1', type: 'deposit_interest', amount: 1, createdAt: fixedNow - 60_000, description: '银行存款每日结息' }],
      availableCollateral: [],
    },
    bankSummary: {
      nextInterestSettlementAt: fixedNow + 12 * 60 * 60 * 1000,
      lastDailyInterestCredits: 40,
      lastDailyRatePpm: 10_000,
      sevenDayAverageRatePpm: 10_000,
      dailyInterestCapBps: 100,
      dailyInterestRateBps: 100,
      interestPoolCredits: 220,
      weeklyCashSettlement: {
        version: 2,
        timeZone: 'Asia/Shanghai',
        rateBps: 1_000,
        currentWeekKey: '2026-07-20',
        weekStartsAt: fixedNow - 12 * 60 * 60 * 1000,
        weekEndsAt: fixedNow + 6.5 * 24 * 60 * 60 * 1000,
        nextCloseAt: fixedNow + 6.5 * 24 * 60 * 60 * 1000,
        interestActive: true,
        activatedAt: fixedNow - 60 * 60 * 1000,
        interestEligibleFrom: fixedNow + 8 * 60 * 60 * 1000,
        estimatedTaxBase: 2_200,
        estimatedAssessment: 220,
        outstandingCredits: 0,
        pendingSettlement: null,
        lastSettlement: null,
      },
      loanTermMs: 72 * 60 * 60 * 1000,
      loanGraceMs: 12 * 60 * 60 * 1000,
      baseLoanToValueBps: 3_000,
      depositBufferBonusBps: 0,
      repaymentHistoryBonusBps: 500,
      recentDefaultPenaltyBps: 1_500,
      minimumLoanToValueBps: 1_500,
      maximumLoanToValueBps: 3_500,
    },
    assetSummary: {
      cashValue: 2_200,
      commodityValue: 1_000,
      facilityValue: 360,
      commercialValue: 0,
      bankDepositValue: 500,
      grossAssetValue: 3_560,
      liabilityValue: 0,
      netAssetValue: 3_560,
      totalAssets: 3_560,
      availableAssetValue: 3_100,
      frozenAssetValue: 460,
      availableCashValue: 1_500,
      frozenCashValue: 200,
      availableCommodityValue: 700,
      frozenCommodityValue: 300,
      availableFacilityValue: 300,
      mortgagedFacilityValue: 0,
      frozenFacilityValue: 60,
    },
  },
  derived: { cashValue: 2_200, commodityValue: 1_000, facilityValue: 360, totalAssets: 3_560 },
  cashShare: 62,
  commodityShare: 28,
  facilityShare: 10,
  notify: (message: string) => { document.body.dataset.notice = message; },
  bankDeposit: async () => ({ ok: true, message: '存款成功' }),
  bankWithdraw: async () => ({ ok: true, message: '取款成功' }),
  bankBorrow: async (
    amount: number,
    carrier: Array<{ provinceId: string; facilityTypeId: string; quantity: number }>,
  ) => {
    document.body.dataset.borrowAmount = String(amount);
    document.body.dataset.borrowTerm = carrier[0]?.facilityTypeId || '';
    return { ok: true, message: '贷款成功' };
  },
  bankRepay: async () => ({ ok: true, message: '还款成功' }),
  bankSetAutoRepay: async () => ({ ok: true, message: '自动还款已更新' }),
} as unknown as LoadedGameViewModel;

createRoot(document.getElementById('root') as HTMLElement).render(<BankPage model={model} />);
