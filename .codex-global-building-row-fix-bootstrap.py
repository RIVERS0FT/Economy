from pathlib import Path

path = Path('.codex-global-building-row-fix.py')
text = path.read_text(encoding='utf-8')
old = '''text = replace_once(\n    text,\n    \"]) requireText('src/styles/global-operation-pages.css', text);\",\n    \"]) requireText('src/styles/global-operation-pages.css', text);\\nfor (const text of [\\n  'notifyOnReselect = false,',\\n  'notifyOnReselect?: boolean;',\\n  'option.value !== value || notifyOnReselect',\\n]) requireText('src/components/ui/RichSelectInput.tsx', text);\",\n    path,\n)'''
new = '''text = replace_once(\n    text,\n    \'  ".ui-rich-select[data-variant=\\\'production-config\\\'] .ui-rich-select__trigger",\\n]) requireText(\\\'src/styles/global-operation-pages.css\\\', text);\',\n    \'  ".ui-rich-select[data-variant=\\\'production-config\\\'] .ui-rich-select__trigger",\\n]) requireText(\\\'src/styles/global-operation-pages.css\\\', text);\\nfor (const text of [\\n  \\'notifyOnReselect = false,\\',\\n  \\'notifyOnReselect?: boolean;\\',\\n  \\'option.value !== value || notifyOnReselect\\',\\n]) requireText(\\\'src/components/ui/RichSelectInput.tsx\\\', text);\',\n    path,\n)'''
if text.count(old) != 1:
    raise SystemExit(f'bootstrap expected one target, got {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8', newline='\n')
print('Patched verifier insertion anchor')
