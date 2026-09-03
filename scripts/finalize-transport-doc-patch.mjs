import fs from 'node:fs';

function replaceOnce(source, pattern, replacement, label) {
  const count = typeof pattern === 'string'
    ? source.split(pattern).length - 1
    : [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))].length;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, got ${count}`);
  return source.replace(pattern, replacement);
}

const pagePath = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
let page = fs.readFileSync(pagePath, 'utf8');
page = replaceOnce(
  page,
  /运输页只显示运输路线目录，并使用 `building` 战略展示。[^\n]*关闭仍回到透明 `map`。/,
  '运输页只显示运输路线目录，并使用 `building` 战略展示。“增加路线”固定在页面内底部 sticky 操作区并进入唯一常驻战略地图创建模式；该操作区只显示创建入口，不显示路线数量／上限。一级目录不重复显示“运输路线”标题。每条已保存路线具有独立名称、运行状态、完整路径、运输方式、站点和建线投入，因此作为独立业务对象使用 `UI_DESIGN_SYSTEM.md` 规定的轻量圆角对象卡；路线卡之间只使用间距分隔，不绘制行分割线。路线卡显示名称、起终点、站点数、环线／固定往返、运输方式、周期距离、周期总费用、一次性建线投入以及“运输中／节点装卸／等待在线规划”状态，点击后通过受限页面栈 push `{ type: \'transport-route\', routeId }`。`transport-route` 不是新的 `TabId` 或一级导航，返回恢复运输路线目录，关闭仍回到透明 `map`。',
  'page route card summary',
);
fs.writeFileSync(pagePath, page, 'utf8');

const verifierPath = 'scripts/verify-provincial-unlock-transport.mjs';
let verifier = fs.readFileSync(verifierPath, 'utf8');
verifier = replaceOnce(
  verifier,
  '  "TRANSPORT_MODE_POLICY from \'../../shared/transport-policy.js\'",',
  '  \'TRANSPORT_MODE_POLICY,\',\n  "from \'../../shared/transport-policy.js\'",',
  'shared transport import verifier',
);
fs.writeFileSync(verifierPath, verifier, 'utf8');

console.log('Transport doc/verifier residual cleanup applied.');
