from pathlib import Path

for root in ('tests/browser', 'tests/stress'):
    for path in Path(root).rglob('*'):
        if not path.is_file() or path.suffix not in {'.ts', '.tsx', '.js', '.mjs'}:
            continue
        text = path.read_text(encoding='utf-8')
        text = text.replace('version: 25,', 'version: 26,')
        text = text.replace('clientStateVersion: 28,', 'clientStateVersion: 29,')
        path.write_text(text, encoding='utf-8', newline='\n')

verify = Path('scripts/verify-document-authority.mjs')
text = verify.read_text(encoding='utf-8')
text = text.replace('版本 ${CURRENT_CLIENT_STATE_VERSION}/25', '版本 ${CURRENT_CLIENT_STATE_VERSION}/26')
text = text.replace('长期生产合同、商品／工厂资产拍卖', '商品供货、玩家抵押借贷与工厂使用权租赁合同、商品／工厂资产拍卖')
verify.write_text(text, encoding='utf-8', newline='\n')
