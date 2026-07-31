import { replaceExact } from './helpers.mjs';

replaceExact(
  'server/src/order-book-runtime.js',
  "\n  if (order.demandGroupId) {\n    const groupId = String(order.demandGroupId);\n    const groupOrders = state.demandGroupOrders.get(groupId) || new Set();\n    groupOrders.add(order);\n    state.demandGroupOrders.set(groupId, groupOrders);\n  }\n}\n\nfunction addOrder(state, order, sequence, { sorted }) {\n  state.sequenceByOrder.set(order, sequence);\n  const id = String(order?.id || '');\n  if (id) state.byId.set(id, order);\n  addOpenOrder(state, order, { sorted });\n}",
  "\n}\n\nfunction addOrder(state, order, sequence, { sorted }) {\n  state.sequenceByOrder.set(order, sequence);\n  const id = String(order?.id || '');\n  if (id) state.byId.set(id, order);\n  if (order.demandGroupId) {\n    const groupId = String(order.demandGroupId);\n    const groupOrders = state.demandGroupOrders.get(groupId) || new Set();\n    groupOrders.add(order);\n    state.demandGroupOrders.set(groupId, groupOrders);\n  }\n  addOpenOrder(state, order, { sorted });\n}",
);

replaceExact(
  'server/src/order-book-runtime.js',
  "\n  if (order.demandGroupId) {\n    const groupId = String(order.demandGroupId);\n    const groupOrders = state.demandGroupOrders.get(groupId);\n    groupOrders?.delete(order);\n    if (groupOrders?.size === 0) state.demandGroupOrders.delete(groupId);\n  }\n  return true;",
  "\n  return true;",
);

replaceExact(
  'server/src/order-book-runtime.js',
  "export function ordersForDemandGroup(world, groupId) {\n  const state = runtimeFor(world);\n  const orders = state.demandGroupOrders.get(String(groupId || ''));\n  if (!orders) return [];\n  for (const order of orders) {\n    if (!isOpenOrder(order)) retireOpenOrder(state, order);\n  }\n  return [...orders];\n}",
  "export function ordersForDemandGroup(world, groupId) {\n  return [...(runtimeFor(world).demandGroupOrders.get(String(groupId || '')) || [])];\n}",
);
