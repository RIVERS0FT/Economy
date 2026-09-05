import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { saveProvinceAutoSalePolicy } from '../../api/game';
import { getStateAuthoritySnapshot, subscribeStateAuthorityDependencies } from '../../app/stateDelivery.js';
import { SwitchControl } from '../ui/layout';

/** Explicit region-wide consent: enabling one building must not implicitly liquidate all stock. */
export function ProvinceAutoSaleControl({ provinceId }: { provinceId: string }) {
  const subscribe = useCallback((listener: () => void) => subscribeStateAuthorityDependencies(['player.assets'], listener), []);
  const enabled = useSyncExternalStore(subscribe,
    () => getStateAuthoritySnapshot().state?.provinceAutoSaleEnabled?.[provinceId] === true, () => false);
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const save = async (next: boolean) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setMessage('');
    try {
      const response = await saveProvinceAutoSalePolicy(provinceId, next);
      setMessage(response.result.message || (response.result.ok ? '地区自动出售已更新' : '地区自动出售更新失败'));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '地区自动出售更新失败');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  return <div className="province-auto-sale">
    <div className="facility-auto-operation__header">
      <strong>出售本地区非冻结商品</strong>
      <SwitchControl checked={enabled} disabled={pending}
        aria-label={enabled ? '关闭本地区自动出售' : '开启本地区自动出售'}
        onChange={(event) => void save(event.target.checked)} />
    </div>
    <small>仅在自动经营建筑周期完成时执行，包括手动买入和奖励所得的非冻结商品。</small>
    {message ? <small role="status">{message}</small> : null}
  </div>;
}
