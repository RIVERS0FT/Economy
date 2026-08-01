import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const generatedTextPaths = [
  'docs/MARKET_CHART_LAYOUT_DESIGN.md',
  'docs/README.md',
  'scripts/verify-market-chart.mjs',
  'scripts/verify-market-page-layout.mjs',
  'scripts/verify-echarts-adoption.mjs',
  'src/components/charts/PriceSparkline.tsx',
  'src/components/charts/marketChartScale.ts',
  'src/components/charts/echartsCore.ts',
  'src/styles/charts.css',
  'src/utils/marketHistory.ts',
  'tests/browser/market-chart-safe-zone.spec.ts',
  'tests/browser/market-runtime.spec.ts',
];

for (const path of generatedTextPaths) {
  const source = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
  const normalized = `${source.split('\n').map((line) => line.replace(/[\t ]+$/g, '')).join('\n').replace(/\n*$/g, '')}\n`;
  writeFileSync(path, normalized, 'utf8');
}

const packagePath = 'package.json';
const packageSource = readFileSync(packagePath, 'utf8');
const temporaryScriptLine = '    "postinstall": "node scripts/cleanup-market-chart-generated-text.mjs",\n';
if (!packageSource.includes(temporaryScriptLine)) {
  throw new Error('Temporary postinstall entry is missing from package.json');
}
writeFileSync(packagePath, packageSource.replace(temporaryScriptLine, ''), 'utf8');

unlinkSync(fileURLToPath(import.meta.url));
