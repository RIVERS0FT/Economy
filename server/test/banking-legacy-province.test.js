import assert from 'node:assert/strict';
import test from 'node:test';
import { ensurePlayerBankAccount, mortgagedFacilityQuantity } from '../src/banking.js';

const now = 1_800_000_000_000;

test('legacy bank collateral remains scoped to the selected province only', () => {
  const player = {
    bankAccount: {
      depositCredits: 0,
      activeLoan: {
        id: 'legacy-province-loan',
        status: 'active',
        borrowedAt: now,
        dueAt: now + 72 * 60 * 60 * 1000,
        graceEndsAt: now + 84 * 60 * 60 * 1000,
        principalOriginal: 20,
        principalOutstanding: 20,
        interestOriginal: 0.8,
        interestOutstanding: 0.8,
        interestRateBps: 400,
        collateral: [{
          provinceId: '110000',
          facilityTypeId: 'farm',
          quantity: 1,
          prudentUnitValue: 60,
        }],
        collateralValueAtOrigination: 60,
        ltvBps: 3_334,
        autoRepay: false,
      },
    },
  };

  ensurePlayerBankAccount(player, now);
  assert.equal(mortgagedFacilityQuantity(player, 'farm', '110000'), 1);
  assert.equal(mortgagedFacilityQuantity(player, 'farm', '120000'), 0);
});
