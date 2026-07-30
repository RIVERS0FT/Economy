from pathlib import Path

path = Path('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md')
text = path.read_text()
text = text.replace('价格为正整数的订单', '价格为不低于 0.01 的两位小数订单')
old = '- 消费需求仍执行 70%／30% 预算、旧买单 50% 保留与 3% 阶梯提价；市场储备每周期释放旧冻结并重新报价，不继承这些规则。'
new = '- 消费需求按就业收入 70%／30%、稳定预算 85%／15% 分配直接与派生资金；三类人口按商品聚合预算并使用私有 `fundingSlices`，旧买单按成交率保留且最多存在三个周期。市场储备每周期释放旧冻结并按真实资产、0.01 价格步长、安全库存和无业务总量上限规则重新报价。'
if old not in text:
    raise RuntimeError('Stale order-source rule not found')
text = text.replace(old, new, 1)
path.write_text(text)

verify = Path('scripts/verify-money-precision.mjs')
verify_text = verify.read_text()
verify_text = verify_text.replace(
    "assert.match(read('README.md'), /账户资金保留六位小数/);",
    "assert.match(read('README.md'), /账户余额、冻结资金、预算、手续费、退款和流水金额统一保留六位小数/);",
)
verify_text = verify_text.replace(
    "assert.match(read('README.md'), /订单价格保留两位小数/);",
    "assert.match(read('README.md'), /可输入单价保留两位小数并使用 `0\\.01` 最小价格步长/);",
)
verify.write_text(verify_text)

stale = [
    '价格为正整数的订单',
    '旧买单 50% 保留与 3% 阶梯提价',
]
found = [item for item in stale if item in text]
if found:
    raise RuntimeError(f'Stale unified order-book rules remain: {found}')

print('Applied final unified order-book authority cleanup.')
