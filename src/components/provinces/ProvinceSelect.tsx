import type { ProvinceDefinition } from '../../types';
import { SelectInput } from '../ui/FormControls';

export function ProvinceSelect({
  provinces,
  value,
  onChange,
  label = '州级地区',
}: {
  provinces: ProvinceDefinition[];
  value: string;
  onChange: (provinceId: string) => void;
  label?: string;
}) {
  const availableProvinces = provinces?.length ? provinces : [{
    id: value || '110000',
    name: '加利福尼亚州',
    shortName: 'CA',
    mapName: 'California',
    longitude: -119.42,
    latitude: 36.78,
  }];
  return (
    <SelectInput
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      fieldClassName="province-context-select"
    >
      {availableProvinces.map((province) => (
        <option key={province.id} value={province.id}>{province.name}</option>
      ))}
    </SelectInput>
  );
}
