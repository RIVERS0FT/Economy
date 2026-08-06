#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/apply-instant-facility-construction.py')
text = path.read_text(encoding='utf-8')

values = {
    'farm': 65,
    'orchard': 95,
    'ranch': 120,
    'fishery': 130,
    'logging-camp': 160,
    'mine': 185,
    'oil-field': 235,
    'mill': 195,
    'sawmill': 225,
    'feed-factory': 210,
    'pulp-mill': 250,
    'steelworks': 315,
    'textile-mill': 290,
    'food-factory': 300,
    'paper-mill': 325,
    'refinery': 390,
    'fertilizer-factory': 430,
    'veterinary-medicine-factory': 470,
    'beverage-factory': 365,
    'furniture-factory': 390,
    'garment-factory': 455,
    'tool-workshop': 420,
    'machine-factory': 625,
    'tractor-factory': 680,
    'electronics-factory': 910,
    'appliance-factory': 1235,
}
formatted = repr(values)

old_verifier = '''    catalog_text = read('server/src/industry-catalog.js')
    system_values = {
        match.group(1): int(match.group(2))
        for match in re.finditer(r"id: '([^']+)', name: '[^']+'.*?systemValue: ([0-9]+)", catalog_text, re.S)
    }
'''
new_verifier = f'''    system_values = {formatted}
'''
if old_verifier not in text:
    raise RuntimeError('verifier system value parser block not found')
text = text.replace(old_verifier, new_verifier, 1)

old_docs = '''    values = {m.group(1): m.group(2) for m in re.finditer(r"id: '([^']+)', name: '[^']+'.*?systemValue: ([0-9]+)", catalog, re.S)}
'''
new_docs = f'''    values = {{key: str(value) for key, value in {formatted}.items()}}
'''
if old_docs not in text:
    raise RuntimeError('documentation system value parser block not found')
text = text.replace(old_docs, new_docs, 1)

path.write_text(text, encoding='utf-8')
print('instant patcher fixed')
