import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { Button } from '../components/ui/layout';
import { useNow } from '../hooks/useNow';
import { formatDuration, formatNumber } from '../utils/formatters';
import '../styles/production-gem-acceleration.css';

export function BuildCardGemAcceleration({ model }: { model: LoadedGameViewModel }) {
  const construction = model.game.facilityConstruction;
  const now = useNow(model.game.lastProcessedAt);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useLayoutEffect(() => {
    const root = document.getElementById('root');
    let active = true;

    const syncPlacement = () => {
      if (!active) return;
      const nextTarget = construction
        ? document.querySelector<HTMLElement>('.production-build-card .construction-status')
        : null;
      setTarget((current) => (current === nextTarget ? current : nextTarget));

      document
        .querySelectorAll<HTMLElement>(
          '.facility-cluster-detail-card .construction-status, .facility-detail-sheet .construction-status',
        )
        .forEach((element) => {
          element.hidden = true;
          element.setAttribute('aria-hidden', 'true');
          element.dataset.gemAccelerationRelocated = 'true';
        });
    };

    syncPlacement();
    const observer = new MutationObserver(syncPlacement);
    if (root) observer.observe(root, { childList: true, subtree: true });

    return () => {
      active = false;
      observer.disconnect();
      setTarget(null);
    };
  }, [construction?.facilityTypeId, Boolean(construction)]);

  if (!construction || !target) return null;

  const accelerationMs = construction.gemAccelerationMs ?? 30 * 60 * 1000;
  const accelerationCost = construction.gemAccelerationCost ?? 1;
  const remaining = Math.max(0, construction.completesAt - now);
  const remainingAfterAcceleration = Math.max(0, remaining - accelerationMs);
  const awaitingConfirmation = remaining === 0;

  const accelerate = async () => {
    if (submitting || awaitingConfirmation || model.game.gems < accelerationCost) return;
    setSubmitting(true);
    try {
      await model.showResult(model.accelerateFacilityConstruction());
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="build-card-gem-acceleration" aria-label="宝石施工加速">
      <strong>宝石加速</strong>
      <span>
        {awaitingConfirmation
          ? '等待服务器确认完工'
          : remainingAfterAcceleration > 0
            ? `使用后剩余 ${formatDuration(remainingAfterAcceleration)}`
            : '使用后立即完工'}
      </span>
      <Button
        block
        disabled={awaitingConfirmation || model.game.gems < accelerationCost || submitting}
        onClick={() => void accelerate()}
      >
        {submitting
          ? '加速处理中…'
          : `${formatNumber(accelerationCost)} 宝石 · 加速 ${formatDuration(accelerationMs)}`}
      </Button>
      <small>每次固定减少 30m；剩余不足 30m 时直接完工，不退还部分宝石。</small>
    </div>,
    target,
  );
}
