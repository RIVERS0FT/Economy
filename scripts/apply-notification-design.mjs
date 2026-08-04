import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content, 'utf8');
}

function replaceRequired(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Missing notification migration anchor: ${label}`);
  return content.replace(before, after);
}

const pagePath = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
let page = read(pagePath);
if (!page.includes('### 2.1 通知与待处理系统')) {
  const oldShellParagraph = '`GameShell` 提供桌面侧栏、移动底部导航、全局状态栏、操作结果提示和唯一页面纵向滚动区域。状态栏固定按“可用资金／净资产／宝石／排行榜／仓库剩余”排序；净资产项可以作为只读导航入口打开银行页的资产总览，其余状态项只读，任何状态项都不得直接执行扩容、下单、撤单、建厂、改种、拍卖、合同履约或设置写操作。净资产周变化使用方向箭头和颜色表达方向，数值使用绝对值且不得重复显示正负号；宝石不计入净资产或排行榜。';
  const newShellParagraph = '`GameShell` 提供桌面侧栏、移动底部导航、全局状态栏、统一通知入口与面板和唯一页面纵向滚动区域。状态栏固定按“可用资金／净资产／宝石／排行榜／仓库剩余”排序；五项状态数据继续使用固定五列，通知入口作为同一玻璃内容层中位于状态栏最右侧的独立工具按钮，不属于第六项资产数据。净资产项可以作为只读导航入口打开银行页的资产总览，其余状态项只读，任何状态项都不得直接执行扩容、下单、撤单、建厂、改种、拍卖、合同履约或设置写操作。净资产周变化使用方向箭头和颜色表达方向，数值使用绝对值且不得重复显示正负号；宝石不计入净资产或排行榜。';
  const notificationSection = `

### 2.1 通知与待处理系统

- 通知按钮是玩家端唯一通知入口，固定在状态栏最右侧。数字角标只显示由当前完整 \`EconomyState\` 去重派生的待处理事项数量；普通未读通知只显示独立圆点，不得与待处理数量相加。数字最大显示 \`99+\`，打开面板不得清除或减少仍未解决的待处理数量。
- 待处理事项固定覆盖生产异常、仓库容量问题、被超价拍卖、参与合同履约问题、贷款宽限期与未完成周资金结算。每项使用稳定的“类型 + 实体 ID”键，同一问题持续存在时原位更新；问题解决后自动移除。待处理事项不能删除，也不受“清除已读”和普通通知历史上限影响。
- 桌面端通知面板挂载到现有工作区安全浮层并在工作区右上角展开；移动端使用同一工作区安全浮层，在状态栏下方、移动底栏上方展开。通知面板不是第十一个正式页面，不得新增路由、第二个 Portal 根或液态玻璃实例，也不得推动页面、状态栏或底栏。
- 通知面板打开时，新操作结果直接插入面板顶部并立即视为已读，新增待处理事项直接出现在待处理分区；面板外不得同时弹出 Toast。面板关闭时，新操作结果和新出现或原因变化的待处理事项必须在状态栏下方显示关闭态 Toast；点击 Toast 打开通知面板，打开面板时立即清空现有 Toast 队列。
- 普通通知按玩家 ID 隔离保存在浏览器，按时间倒序保留最近 20 条，超过上限时自动淘汰最旧记录。打开面板统一将当前普通通知标为已读；允许一键清除全部已读普通通知，并允许单条删除任意普通通知；两种删除操作都不得影响待处理事项。
- 通知面板关闭、切换正式页面、点击外部或按 \`Escape\` 时关闭，关闭后焦点返回状态栏通知按钮。通知、待处理与 Toast 只能复用正式五秒状态刷新和已有操作结果，不得增加通知专用轮询、根级每秒时钟或第二套页面角标数据源。
`;
  page = replaceRequired(page, oldShellParagraph, `${newShellParagraph}${notificationSection}`, 'application shell paragraph');
  page = page.replace('### 2.1 状态交付容量', '### 2.2 状态交付容量');
  page = page.replace('### 2.2 紧凑时间与排名', '### 2.3 紧凑时间与排名');
  page = page.replace('### 2.3 登录与注册入口', '### 2.4 登录与注册入口');
  page = replaceRequired(
    page,
    '| 基础教程当前步骤 | 概览；设置只负责显示、隐藏和重新开始 |',
    '| 基础教程当前步骤 | 概览；设置只负责显示、隐藏和重新开始 |\n| 通知与待处理 | 应用外壳统一通知面板；不是独立一级页面 |',
    'module ownership table',
  );
  page = replaceRequired(
    page,
    '不得：\n\n- 把银行存取款',
    '不得：\n\n- 恢复第二个通知入口、把通知面板改成独立一级页面、把普通未读数与待处理数相加，或在通知面板打开时继续显示面板外 Toast；\n- 允许删除未解决待处理事项、让“清除已读”影响未读通知或待处理事项，或让普通通知超过最近 20 条；\n- 把银行存取款',
    'anti-regression list',
  );
  write(pagePath, page);
}

const packagePath = 'package.json';
const packageJson = JSON.parse(read(packagePath));
packageJson.scripts['verify:notifications'] = 'node --experimental-strip-types scripts/verify-notification-center.mjs';
const architectureMarker = 'npm run verify:navigation-badges && ';
if (!packageJson.scripts['verify:architecture'].includes('npm run verify:notifications')) {
  if (!packageJson.scripts['verify:architecture'].includes(architectureMarker)) {
    throw new Error('Missing verify:architecture navigation badge anchor');
  }
  packageJson.scripts['verify:architecture'] = packageJson.scripts['verify:architecture'].replace(
    architectureMarker,
    `${architectureMarker}npm run verify:notifications && `,
  );
}
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const liquidVerifierPath = 'scripts/verify-liquid-glass-chrome.mjs';
let liquidVerifier = read(liquidVerifierPath);
if (liquidVerifier.includes("'<StatusBar items={statusItems} />',")) {
  liquidVerifier = liquidVerifier.replace(
    "'<StatusBar items={statusItems} />',",
    "'<StatusBar',\n    'action={(',\n    'NotificationCenterButton',",
  );
  write(liquidVerifierPath, liquidVerifier);
}
