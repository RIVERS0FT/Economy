from pathlib import Path

path = Path('server/src/market-demand.js')
text = path.read_text()

old_group = """  return ordersForDemandGroup(world, groupId).reduce((sum, order) => (
    isConsumptionOrder(order, groupId) && isOpenOrder(order) && predicate(order)
      ? sum + orderValue(order)
      : sum
  ), 0);"""
new_group = """  return roundMoney(ordersForDemandGroup(world, groupId).reduce((sum, order) => (
    isConsumptionOrder(order, groupId) && isOpenOrder(order) && predicate(order)
      ? sum + orderValue(order)
      : sum
  ), 0));"""
if old_group not in text:
    raise RuntimeError('Population group open-order aggregation structure not found')
text = text.replace(old_group, new_group, 1)

old_total = '    let total = orders.reduce((sum, order) => sum + orderValue(order), 0);'
new_total = '    let total = roundMoney(orders.reduce((sum, order) => sum + orderValue(order), 0));'
if old_total not in text:
    raise RuntimeError('Population trim total aggregation structure not found')
text = text.replace(old_total, new_total, 1)

old_return = '    return Math.max(0, total);'
new_return = '    return roundMoney(total);'
if old_return not in text:
    raise RuntimeError('Population trim total return structure not found')
text = text.replace(old_return, new_return, 1)

path.write_text(text)
print('Rounded population order-book value aggregation to six decimals.')
