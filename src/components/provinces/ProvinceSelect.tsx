import type { ProvinceDefinition } from '../../types';
import { SelectInput } from '../ui/FormControls';

export function ProvinceSelect({
  provinces,
  value,
  onChange,
  label = '省级地区',
}: {
  provinces: ProvinceDefinition[];
  value: string;
  onChange: (provinceId: string) => void;
  label?: string;
}) {
  const availableProvinces = provinces?.length ? provinces : [{
    id: value || '110000',
    name: '北京市',
    shortName: '北京',
    longitude: 116.41,
    latitude: 39.9,
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
