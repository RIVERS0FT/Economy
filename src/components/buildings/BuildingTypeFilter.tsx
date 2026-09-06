import '../../styles/global-operation-pages.css';

export type BuildingKind = 'industrial' | 'commercial';
export type BuildingKindFilter = 'all' | BuildingKind;

export const BUILDING_KIND_OPTIONS: ReadonlyArray<{ value: BuildingKindFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'commercial', label: '商业建筑' },
  { value: 'industrial', label: '工业建筑' },
];

/** Same disclosure, buttons and keyboard semantics as the commodity catalog filter. */
export function BuildingTypeFilter({ value, onChange }: {
  value: BuildingKindFilter;
  onChange: (value: BuildingKindFilter) => void;
}) {
  return (
    <details className="global-market-filter-disclosure building-type-filter">
      <summary><span>筛选</span>{value !== 'all' ? <small>1 项已启用</small> : null}</summary>
      <div className="global-market-filter-row" aria-label="建筑筛选">
        <div className="global-market-filter-group" role="group" aria-label="建筑分类">
          {BUILDING_KIND_OPTIONS.map((option) => (
            <button type="button" key={option.value}
              className={'global-market-filter-button' + (value === option.value ? ' active' : '')}
              aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}
