from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    (ROOT / path).write_text(content, encoding='utf-8')


parallel_doc = ROOT / 'docs/ALL_PRODUCTS_DIRECT_DEMAND_DESIGN.md'
if parallel_doc.exists():
    parallel_doc.unlink()

verify_path = 'scripts/verify-staple-crops-demand.mjs'
verify = read(verify_path)
verify = verify.replace(
    "  ['docs/ALL_PRODUCTS_DIRECT_DEMAND_DESIGN.md', ['31 种商品', '总基础预算保持 5700', '升级冻结资金释放', '社会消费市场']],\n",
    '',
)
write(verify_path, verify)

authority_path = 'scripts/verify-document-authority.mjs'
authority = read(authority_path)
authority = authority.replace("'市场需求模型版本：`8`'", "'市场需求模型版本：`9`'")
authority = authority.replace(
    '市场需求模型 8、真实人口钱包',
    '市场需求模型 9、全商品直接需求、真实人口钱包',
)
write(authority_path, authority)

print('Aligned model 9 migration with the existing authoritative document set.')
