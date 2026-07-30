from pathlib import Path

path = Path('server/src/market-demand.js')
text = path.read_text()
text = text.replace(
    """  return ordersForDemandGroup(world, groupId).reduce((sum, order) => (
    isConsumptionOrder(order, groupId) && isOpenOrder(order) && predicate(order)
      ? sum + Number(order.price || 0) * Number(order.remaining || 0)
      : sum
  ), 0);""",
    """  return roundMoney(ordersForDemandGroup(world, groupId).reduce((sum, order) => (
    isConsumptionOrder(order, groupId) && isOpenOrder(order) && predicate(order)
      ? sum + Number(order.price || 0) * Number(order.remaining || 0)
      : sum
  ), 0));""",
)
text = text.replace(
    '    let total = orders.reduce((sum, order) => sum + Number(order.price || 0) * Number(order.remaining || 0), 0);',
    '    let total = roundMoney(orders.reduce((sum, order) => sum + Number(order.price || 0) * Number(order.remaining || 0), 0));',
)
text = text.replace(
    '    return Math.max(0, total);',
    '    return roundMoney(total);',
)
path.write_text(text)
print('Rounded population order-book value aggregation to six decimals.')
