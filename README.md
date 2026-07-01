# Economy Arena / 经济竞技场

Economy Arena is a cross-platform desktop prototype for a turn-based economy strategy game with player-to-player trading.

## Tech stack

This project follows the same stack style as `RIVERS0FT/TheGenius`:

- Tauri 2.x
- Rust
- React
- TypeScript
- Vite
- Zustand
- Tailwind CSS-compatible styling
- Browser Web Audio API procedural sound effects

## Gameplay

Players operate small trading houses in a shared market. Each round, players collect resources, buy from a fluctuating market, propose in-game trades, accept or reject offers, and complete contracts for reputation and credits.

Core loop:

1. Start a new match with the human player and AI traders.
2. Produce resources each round.
3. Buy resources from the market when prices are favorable.
4. Create trade offers with credits and items.
5. Let AI traders evaluate and respond to offers.
6. Complete contracts to earn credits, score, and reputation.
7. Win by reaching the target reputation or by leading after the final round.

## Development

```bash
npm install
npm run dev
```

## Tauri desktop mode

```bash
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

The first version is a local single-player simulation with AI traders. Network multiplayer and real-money payments are intentionally out of scope; all trading is simulated in-game currency and resources.