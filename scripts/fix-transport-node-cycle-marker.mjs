import fs from 'node:fs';

const path = 'server/src/transport.js';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`transport runtime patch failed: ${label}`);
  source = next;
}

replaceOnce(
  "  const shipment = {\n    id: `transport-${randomUUID()}`,",
  "  const shipment = {\n    nodeCycleVersion: 1,\n    id: `transport-${randomUUID()}` ,".replace('()` ,', '()`,'),
  'new cycle marker',
);

replaceOnce(
  "function migrateLegacyShipment(world, shipment) {\n  const player = world.players?.[String(shipment.ownerId)];",
  "function migrateLegacyShipment(world, shipment) {\n  if (shipment.nodeCycleVersion === 1) return;\n  const player = world.players?.[String(shipment.ownerId)];",
  'migration guard',
);

replaceOnce(
  "  if (shipment.status === 'arrived') {\n    if (shipment.cycleManifest.length === 0) shipment.cycleManifest = legacyShipmentManifest(shipment);\n    return;\n  }\n  if (Array.isArray(shipment.cargoLots) && shipment.cargoLots.length > 0) return;",
  "  if (shipment.status === 'arrived') {\n    if (shipment.cycleManifest.length === 0) shipment.cycleManifest = legacyShipmentManifest(shipment);\n    shipment.nodeCycleVersion = 1;\n    return;\n  }\n  if (Array.isArray(shipment.cargoLots) && shipment.cargoLots.length > 0) {\n    shipment.nodeCycleVersion = 1;\n    return;\n  }",
  'completed/current runtime migration marker',
);

replaceOnce(
  "  shipment.departsAt = departsAt;\n  shipment.arrivesAt = arrivesAt;\n  shipment.status = 'in-transit';\n}",
  "  shipment.departsAt = departsAt;\n  shipment.arrivesAt = arrivesAt;\n  shipment.status = 'in-transit';\n  shipment.nodeCycleVersion = 1;\n}",
  'legacy conversion marker',
);

fs.writeFileSync(path, source, 'utf8');
console.log('Transport node-cycle migration marker applied.');
