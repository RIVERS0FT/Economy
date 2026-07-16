import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content, 'utf8');

function replaceExact(path, search, replacement) {
  const source = read(path);
  if (source.includes(replacement)) return;
  if (!source.includes(search)) {
    throw new Error(`${path} 缺少待替换内容:\n${search}`);
  }
  write(path, source.replace(search, replacement));
}

replaceExact(
  'src/styles/overview.css',
  `.overview-market-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2);
}`,
  `.overview-market-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2);
  font-size: var(--font-size-xs);
}`,
);

replaceExact(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '横轴固定划分为 12 个 2h 分段，刻度标签使用浏览器系统时区的 `HH:mm`；纵轴分别标明“价格”和“成交量”，必须显示刻度、网格、方向图例和可访问名称。横纵坐标刻度与轴标题的屏幕渲染字号必须与图表下方统计栏一致，横轴标题固定为“时间”。',
  '横轴固定划分为 12 个 2h 分段，刻度标签使用浏览器系统时区的 `HH:mm`；纵轴分别标明“价格”和“成交量”，必须显示刻度、网格、方向图例和可访问名称。横纵坐标刻度与轴标题的屏幕渲染字号必须与图表下方统计栏一致，横轴标题固定为“时间”。市场页 `.chart-footer` 与概览页 `.overview-market-footer` 必须在容器本身统一使用 `--font-size-xs`，图表组件据此反算 SVG 坐标、轴标题和图例字号；不得只给容器内部的 `small` 设置字号。',
);

replaceExact(
  'scripts/verify-overview-content.mjs',
  `]) requireText(stylePath, text);

requireText(mainPath, "import './styles/overview.css'");`,
  `]) requireText(stylePath, text);

requireText(stylePath, \`.overview-market-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2);
  font-size: var(--font-size-xs);
}\`);

requireText(mainPath, "import './styles/overview.css'");`,
);

replaceExact(
  'scripts/verify-overview-content.mjs',
  `  '不得恢复“最近 24 笔成交”',
]) requireText(pageDesignPath, text);`,
  `  '不得恢复“最近 24 笔成交”',
  '市场页 \`.chart-footer\` 与概览页 \`.overview-market-footer\` 必须在容器本身统一使用 \`--font-size-xs\`',
  '不得只给容器内部的 \`small\` 设置字号',
]) requireText(pageDesignPath, text);`,
);

console.log('Applied overview chart axis font-size token.');
