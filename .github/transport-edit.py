from pathlib import Path

path = Path('server/test/transport-balance.test.js')
text = path.read_text()
old = '  const world = createWorld(now);\n  const player = ensurePlayer(world, user, now);'
new = '  const world = createWorld(now);\n  world.transportShipments = [];\n  const player = ensurePlayer(world, user, now);'
assert text.count(old) == 1
path.write_text(text.replace(old, new))
