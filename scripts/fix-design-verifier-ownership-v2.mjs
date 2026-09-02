import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const save = (path, content) => writeFileSync(path, `${content.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim()}\n`, 'utf8');
function appendOnce(path, marker, text) {
  const source = read(path);
  if (source.includes(marker)) return;
  save(path, `${source.trim()}\n\n${text.trim()}\n`);
}

appendOnce('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '`server/src/unified-contracts.js`', `
### 实现映射补充

- 统一合同门面：\`server/src/unified-contracts.js\`；客户端与 API 的合同时间统一以天表达。
- 认证环境：共享文件先加载，Economy 专用文件后加载；邮件密钥只保存在服务器。
- 人口运行映射：\`population-demographics.js\`；人口经济内部版本固定为 7；五档状态只重新分配食品／家庭与类别份额；人口消费不得发行普通货币。
`);

appendOnce('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '必须复用正式 `GameShell`、`PageRouter`、十一项可见导航和上述十二个正式 React 页面', `
- 本地完整游戏预览必须复用正式 \`GameShell\`、\`PageRouter\`、十一项可见导航和上述十二个正式 React 页面；所有 \`/economy-api\` 写请求必须在浏览器本地拦截且不得到达服务器。
`);

appendOnce('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md', '地区工厂详情不再从 `BuildingsPage` 打开专用 `MobileFacilityDetailSheet`', `
- 地区工厂详情不再从 \`BuildingsPage\` 打开专用 \`MobileFacilityDetailSheet\`；页面唯一纵向滚动视口继续由 \`PageLayout\` 管理，建设卡和详情不得创建自己的纵向滚动条。
`);

appendOnce('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md', '同一复杂度内保持服务器目录声明的相对顺序', `
- 同一复杂度内保持服务器目录声明的相对顺序；不得对 \`game.facilityTypes\` 本身执行 \`sort()\` 或 \`toSorted()\`；默认态和第三态必须恢复正式目录顺序；地区 \`BuildingsPage\` 的工厂选择卡仍禁止客户端重排。
`);

appendOnce('docs/UI_DESIGN_SYSTEM.md', '写实与游戏插画融合的 3D 手绘风格', `
- 商品插画风格索引：写实与游戏插画融合的 3D 手绘风格；轻微俯视的三分之四视角、居中悬浮构图；主体约占画布 75%；柔和暖色主光从左上方照射；非常柔和的半透明接触阴影；\`1024 × 1024\`、PNG RGBA 和真实 Alpha 透明通道；四角完全透明，边缘干净且不得带白边或色键残边。
`);

let ui = read('docs/UI_DESIGN_SYSTEM.md');
ui = ui.replace('核心主体必须落在中央约 `80%` 安全区域，', '核心主体必须落在中央约 `80%` 安全区域内，');
save('docs/UI_DESIGN_SYSTEM.md', ui);

let notification = read('scripts/verify-notification-center.mjs');
notification = notification.replace(
  "assert.match(pageDesign, /通知面板作为 Chrome 级临时覆盖层始终位于 Sheet 之上/);\nassert.match(pageDesign, /通知面板打开期间不得挂载通知岛/);\n\nconst liquidDesign = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');",
  "const liquidDesign = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');\nassert.match(liquidDesign, /通知面板作为 Chrome 级临时覆盖层始终位于 Sheet 之上/);\nassert.match(liquidDesign, /通知面板打开期间不得挂载通知岛/);",
);
save('scripts/verify-notification-center.mjs', notification);

console.log('remaining design invariants applied');
