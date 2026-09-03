import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';

const marketPath = 'src/pages/MarketPage.tsx';
let market = readFileSync(marketPath, 'utf8');
market = market.replace('  readOnly = false,\n', '');
market = market.replace('  readOnly?: boolean;\n', '');
const readonlyBlock = /            \{readOnly \? \([\s\S]*?            \) : \(\n              <MarketImmediateTradeEntry([\s\S]*?)\n              \/>\n            \)\}/;
const match = market.match(readonlyBlock);
if (!match) throw new Error('找不到 MarketPage 旧只读交易分支');
market = market.replace(readonlyBlock, `            <MarketImmediateTradeEntry${match[1]}\n              />`);
const panelOpen = '<Panel className="widget span-3 market-account-panel">\n          <div className="local-trades-heading">';
if (!market.includes(panelOpen)) throw new Error('找不到最近成交 Panel');
market = market.replace(panelOpen, '<Panel className="widget span-3 market-account-panel">\n          <section className="local-trades-section">\n          <div className="local-trades-heading">');
const panelClose = '          )}\n        </Panel>\n      </div>\n    </div>\n  );';
if (!market.includes(panelClose)) throw new Error('找不到最近成交 Panel 结尾');
market = market.replace(panelClose, '          )}\n          </section>\n        </Panel>\n      </div>\n    </div>\n  );');
for (const token of ['readOnly = false', 'readOnly?: boolean', '该地区尚未解锁，市场仅供查看。', 'market-trade-readonly']) {
  if (market.includes(token)) throw new Error(`MarketPage 仍残留地区解锁只读语义: ${token}`);
}
writeFileSync(marketPath, market.endsWith('\n') ? market : `${market}\n`);

const provincePath = 'src/pages/ProvincePage.tsx';
let province = readFileSync(provincePath, 'utf8');
province = province.replaceAll('<EmbeddedMarketPage model={model} embedded readOnly={false} />', '<EmbeddedMarketPage model={model} embedded />');
writeFileSync(provincePath, province.endsWith('\n') ? province : `${province}\n`);

for (const name of readdirSync('scripts')) {
  if (!name.endsWith('.mjs')) continue;
  const path = `scripts/${name}`;
  let source = readFileSync(path, 'utf8');
  const next = source.replaceAll('<EmbeddedMarketPage model={model} embedded readOnly={false} />', '<EmbeddedMarketPage model={model} embedded />');
  if (next !== source) writeFileSync(path, next.endsWith('\n') ? next : `${next}\n`);
}

for (const temp of ['scripts/codex-remove-market-readonly-branch.mjs', '.github/workflows/codex-remove-market-readonly-branch.yml']) {
  if (existsSync(temp)) unlinkSync(temp);
}
