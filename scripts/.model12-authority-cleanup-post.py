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

readme = Path('README.md')
readme_text = readme.read_text()
readme_text = readme_text.replace(
    '三类人口使用六位小数真实余额和冻结资金；就业收入预算继续保持 70% 用于最终消费的直接需求、30% 用于沿正式配方反向推导的派生流动性。',
    '三类人口使用真实余额和冻结资金，二者统一保留六位小数；就业收入预算继续保持 70% 用于最终消费的直接需求，30% 用于沿正式配方反向推导的派生流动性。',
)
readme_text = readme_text.replace(
    '直接需求为每项商品持久化六位小数报价锚点、连续过剩周期和商品预算赤字',
    '直接需求为每项商品持久化双向报价锚点（六位小数）、连续过剩周期和商品预算赤字',
)
readme_text = readme_text.replace(
    '> 普通货币精度规则：玩家、人口、市场储备、银行、合同与拍卖的账户余额、冻结资金、预算、手续费、退款和流水金额统一保留六位小数；订单、拍卖与合同中的可输入单价保留两位小数并使用 `0.01` 最小价格步长。',
    '> 普通货币精度规则：账户资金保留六位小数，订单价格保留两位小数并使用 `0.01` 最小价格步长；玩家、人口、市场储备、银行、合同与拍卖的账户余额、冻结资金、预算、手续费、退款和流水金额统一保留六位小数；订单、拍卖与合同中的可输入单价保留两位小数。',
)
readme.write_text(readme_text)

product_design = Path('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md')
product_text = product_design.read_text().replace(
    '每项直接需求商品保存六位小数报价锚点与连续过剩周期',
    '每项直接需求商品保存双向报价锚点（六位小数）与连续过剩周期',
)
product_design.write_text(product_text)

index = Path('docs/README.md')
index_text = index.read_text().replace(
    '无业务总量上限且保持真实资产守恒的双边市场储备',
    '无业务总量上限、库存与资金守恒的双边市场储备',
)
index.write_text(index_text)

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
