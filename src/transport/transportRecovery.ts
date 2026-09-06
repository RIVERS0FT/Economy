import type { PlayerPageLocation } from '../navigation/playerPageStack';
import { TRANSPORT_FUEL_PRODUCT_ID } from '../../shared/transport-policy.js';

/** Recovery only navigates; no quote, quantity or mutation is inferred on the player's behalf. */
export function transportRecovery(reason: string, provinceId: string): { label: string; location: PlayerPageLocation } | null {
  if (reason === 'insufficient-fuel') return { label: '前往采购燃料', location: {
    type: 'regional-product', host: 'market', provinceId, productId: TRANSPORT_FUEL_PRODUCT_ID,
  } };
  if (reason === 'insufficient-funds') return { label: '管理资金', location: { type: 'tab', tab: 'bank' } };
  return null;
}
