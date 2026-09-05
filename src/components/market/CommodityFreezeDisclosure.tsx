import { useId, useState } from 'react';
import type { CommodityFreezeDetail } from '../../types';
import { formatFullNumber, formatNumber } from '../../utils/formatters';
import { SafeTooltip } from '../ui/SafeTooltip';
import '../../styles/commodity-freezes.css';

const labels: Record<CommodityFreezeDetail['kind'], string> = {
  production: '生产冻结', commercial: '经营冻结', contract: '合同冻结', auction: '拍卖冻结', legacy: '待核对冻结',
};
const order: CommodityFreezeDetail['kind'][] = ['production', 'commercial', 'contract', 'auction', 'legacy'];

function FreezeDetails({ quantity, entries }: { quantity: number; entries?: CommodityFreezeDetail[] }) {
  const valid = Array.isArray(entries) && entries.every((entry) => entry && order.includes(entry.kind) && typeof entry.sourceId === 'string'
    && typeof entry.label === 'string' && Number.isSafeInteger(entry.quantity) && entry.quantity > 0)
    && entries.reduce((sum, entry) => sum + entry.quantity, 0) === quantity;
  return <span className="commodity-freeze-details">
    <strong>冻结明细 · {formatFullNumber(quantity)}</strong>
    {quantity === 0 ? <span>暂无冻结</span> : !valid ? <span role="status">冻结来源明细暂不可用</span> : order.map((kind) => {
      const selected = entries.filter((entry) => entry.kind === kind);
      if (!selected.length) return null;
      return <span className="commodity-freeze-details__group" key={kind}>
        <span className="commodity-freeze-details__row"><strong>{labels[kind]}</strong>
          <strong>{formatFullNumber(selected.reduce((sum, entry) => sum + entry.quantity, 0))}</strong></span>
        {selected.map((entry) => <span className="commodity-freeze-details__row" key={`${kind}:${entry.sourceId}`}>
          <span>{entry.label}</span><span>{formatFullNumber(entry.quantity)}</span>
        </span>)}
      </span>;
    })}
    <small>冻结商品只供对应业务使用，不参与自动出售。</small>
  </span>;
}

/** Shared safe tooltip on hover/focus; tapping expands in-place, without another Sheet or Portal. */
export function CommodityFreezeDisclosure({ quantity, entries }: { quantity: number; entries?: CommodityFreezeDetail[] }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const trigger = <button type="button" className="commodity-freeze-disclosure__trigger" aria-expanded={expanded} aria-controls={id}
    aria-label={`查看冻结库存 ${formatFullNumber(quantity)} 的来源明细`} onClick={() => setExpanded((value) => !value)}>
    <strong>{formatNumber(quantity)}</strong>
  </button>;
  return <><span className="commodity-freeze-disclosure" onKeyDown={(event) => {
    if (event.key === 'Escape' && expanded) { setExpanded(false); event.stopPropagation(); }
  }}>
    <small>冻结库存</small>
    <SafeTooltip disabled={expanded} content={<FreezeDetails quantity={quantity} entries={entries} />}>{trigger}</SafeTooltip>
  </span>
    {expanded ? <span id={id} className="commodity-freeze-disclosure__expanded" role="region" aria-label="冻结明细">
      <FreezeDetails quantity={quantity} entries={entries} />
    </span> : null}
  </>;
}
