import { createRoot } from 'react-dom/client';
import '../../src/app/interactionBootstrap';
import type { LoadedGameViewModel } from '../../src/app/gameViewModel';
import { BankPage } from '../../src/pages/BankPage';
import '../../src/styles/globals.css';
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
    version: 20,
    lastProcessedAt: fixedNow,
    credits: 1_500,
    frozenCredits: 200,
    inventories: { wheat: { available: 5, frozen: 2 } },
    products: [{ id: 'wheat', name: '小麦', category: 'raw', basePrice: 2 }],
    facilityGroups: [{
      facilityTypeId: 'farm', count: 6, participatingCount: 6, pendingJoinCount: 0,
      listedCount: 1, auctionedCount: 0, frozenCount: 1, mortgagedCount: 0,
      availableCount: 5, nextCycleCount: 6, enabled: true, status: 'running',
      lifetimeOutput: 40, activeRecipeId: 'wheat-crop',
    }],
    facilityTypes: [{
      id: 'farm', name: '农场', category: 'raw', complexity: 'C1', buildCost: 65,
      buildTimeMs: 60_000, cycleMs: 120_000, operatingCost: 6, inputs: [],
      output: { productId: 'wheat', quantity: 4 }, defaultRecipeId: 'wheat-crop',
      recipes: [{ id: 'wheat-crop', name: '种植小麦', cycleMs: 120_000, operatingCost: 6, inputs: [], output: { productId: 'wheat', quantity: 4 } }],
      systemValue: 65,
    }],
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
      availableCollateral: [{ facilityTypeId: 'farm', totalQuantity: 6, mortgagedQuantity: 0, availableQuantity: 5, prudentUnitValue: 60 }],
    },
    bankSummary: {
      nextInterestSettlementAt: fixedNow + 12 * 60 * 60 * 1000,
      lastDailyInterestCredits: 40,
      lastDailyRatePpm: 800,
      sevenDayAverageRatePpm: 650,
      dailyInterestCapBps: 25,
      interestPoolCredits: 220,
      loanTermMs: 72 * 60 * 60 * 1000,
      loanGraceMs: 12 * 60 * 60 * 1000,
      baseLoanToValueBps: 4_000,
      depositBufferBonusBps: 500,
      repaymentHistoryBonusBps: 500,
      recentDefaultPenaltyBps: 1_500,
      minimumLoanToValueBps: 2_500,
      maximumLoanToValueBps: 5_000,
    },
    assetSummary: {
      cashValue: 2_200,
      commodityValue: 1_000,
      facilityValue: 360,
      bankDepositValue: 500,
      grossAssetValue: 3_560,
      liabilityValue: 0,
      netAssetValue: 3_560,
      totalAssets: 3_560,
      availableAssetValue: 3_100,
      frozenAssetValue: 460,
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
  allocationStyle: { background: 'conic-gradient(var(--color-success) 0 62%, var(--color-warning) 62% 90%, var(--color-info) 90% 100%)' },
  notify: (message: string) => { document.body.dataset.notice = message; },
  bankDeposit: async () => ({ ok: true, message: '存款成功' }),
  bankWithdraw: async () => ({ ok: true, message: '取款成功' }),
  bankBorrow: async () => ({ ok: true, message: '贷款成功' }),
  bankRepay: async () => ({ ok: true, message: '还款成功' }),
  bankSetAutoRepay: async () => ({ ok: true, message: '自动还款已更新' }),
} as unknown as LoadedGameViewModel;

createRoot(document.getElementById('root') as HTMLElement).render(<BankPage model={model} />);
