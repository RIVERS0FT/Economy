import { contractAvailableHoldForOnlineTrade } from './online-auto-trade-reservations.js';

export const contractAvailableHoldForAutoSell = contractAvailableHoldForOnlineTrade;

export function applyOnlineAutoSell() {
  return {
    ok: true,
    message: '自动出售已改为建筑周期完成时由服务器统一结算，本次未执行即时出售',
  };
}
