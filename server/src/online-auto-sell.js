export { contractAvailableHoldForOnlineTrade as contractAvailableHoldForAutoSell } from './online-auto-trade-reservations.js';

/** Retired client-triggered execution. Only authoritative cycle settlement may auto-trade. */
export function applyOnlineAutoSell() {
  return { ok: false, message: '自动采购和出售仅在服务器确认周期完成时执行' };
}
