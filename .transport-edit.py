# Temporary branch-only deterministic patch loader; removed before merge.
from pathlib import Path
import base64, hashlib, json, lzma

encoded = ''.join(Path(f'.transport-payload-{part}').read_text().strip() for part in range(1, 4))
raw = lzma.decompress(base64.b64decode(encoded, validate=True))
assert hashlib.sha256(raw).hexdigest() == '764270b89171042cc8b51b68256e78d2b00f03f04840dc56722a0e68bdd06453', 'Patch checksum mismatch'
patch = json.loads(raw)
contents = {}
errors = []
for index, op in enumerate(patch['ops']):
    path = op['path']
    if path not in contents:
        contents[path] = Path(path).read_text()
    value = contents[path]
    try:
        if op['op'] == 'replace':
            assert value.count(op['old']) == op['count'], f"expected {op['count']} anchors for {op['old'][:150]!r}, got {value.count(op['old'])}"
            value = value.replace(op['old'], op['new'])
        elif op['op'] == 'replaceAll':
            assert op['old'] in value, f"missing {op['old']!r}"
            value = value.replace(op['old'], op['new'])
        elif op['op'] == 'section':
            assert value.count(op['start']) == 1, f"nonunique start {op['start']!r}"
            start = value.index(op['start'])
            end = value.index(op['end'], start + len(op['start']))
            value = value[:start] + op['text'] + value[end:]
        elif op['op'] == 'append':
            value = value.rstrip() + '\n' + op['text']
        else:
            raise AssertionError(op['op'])
        contents[path] = value
    except (AssertionError, ValueError) as error:
        errors.append(f'{index} {path}: {error}')
if errors:
    raise SystemExit('No files changed; patch anchor validation failed:\n' + '\n'.join(errors))
contents.update(patch['files'])
for path, value in contents.items():
    assert path.split('/')[0] in {'shared', 'src', 'server', 'docs', 'scripts', 'tests'}, path
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(value.rstrip() + '\n')
print('Applied transport source/document/test patch:', len(contents), 'files')
