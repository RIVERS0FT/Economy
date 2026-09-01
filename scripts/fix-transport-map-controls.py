from pathlib import Path


def replace_once(path, old, new, label):
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {count}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')

replace_once(
    'src/components/shell/StrategicWorkspace.tsx',
    "import { StrategicOutliner } from '../outliner/StrategicOutliner';\n",
    "import { StrategicOutliner } from '../outliner/StrategicOutliner';\nimport { SelectInput } from '../ui/FormControls';\n",
    'SelectInput import',
)

replace_once(
    'src/components/shell/StrategicWorkspace.tsx',
    '''          <div className="transport-map-picking-options">\n            <label>\n              <span>运输方式</span>\n              <select\n                value={routeDraft.draft?.mode ?? 'road'}\n                onChange={(event) => routeDraft.updateDraft({ mode: event.target.value as TransportModeId })}\n              >\n                <option value="road">公路运输</option>\n                <option value="rail">铁路运输</option>\n                <option value="air">航空运输</option>\n              </select>\n            </label>\n            <label>\n              <span>行程</span>\n              <select\n                value={draftClosed ? 'one-way' : routeDraft.draft?.tripType ?? 'one-way'}\n                disabled={draftClosed}\n                onChange={(event) => routeDraft.updateDraft({ tripType: event.target.value === 'round' ? 'round' : 'one-way' })}\n              >\n                <option value="one-way">单程</option>\n                <option value="round">往返</option>\n              </select>\n            </label>\n          </div>''',
    '''          <div className="transport-map-picking-options">\n            <SelectInput\n              label="运输方式"\n              value={routeDraft.draft?.mode ?? 'road'}\n              onChange={(event) => routeDraft.updateDraft({ mode: event.target.value as TransportModeId })}\n            >\n              <option value="road">公路运输</option>\n              <option value="rail">铁路运输</option>\n              <option value="air">航空运输</option>\n            </SelectInput>\n            <SelectInput\n              label="行程"\n              value={draftClosed ? 'one-way' : routeDraft.draft?.tripType ?? 'one-way'}\n              disabled={draftClosed}\n              onChange={(event) => routeDraft.updateDraft({ tripType: event.target.value === 'round' ? 'round' : 'one-way' })}\n            >\n              <option value="one-way">单程</option>\n              <option value="round">往返</option>\n            </SelectInput>\n          </div>''',
    'map route native selects',
)

replace_once(
    'scripts/verify-provincial-economy.mjs',
    '版本 38/32',
    '版本 39/32',
    'province verifier summary version',
)

print('transport map controls aligned')
