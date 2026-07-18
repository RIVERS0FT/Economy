from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:160]!r}')
    file.write_text(text.replace(old, new, count), encoding='utf-8')


def remove(path: str, old: str) -> None:
    replace(path, old, '')


remove('src/api/game.ts', "  reset: () => Promise.reject(new GameApiError(410, '经济状态重置功能已永久移除')),\n")
remove('src/app/gameViewModel.ts', "  reset: () => Promise<ActionResult>;\n")
remove('src/app/gameViewModel.ts', "    reset: () => runAction('resetPlayer', gameActions.reset),\n")
remove('src/utils/localActivityStore.ts', "  | 'resetPlayer'\n")
remove('src/utils/localActivityStore.ts', "  resetPlayer: 'system',\n")
remove('tests/browser/runtime-harness.tsx', "    reset: async () => ({ ok: true, message: '测试环境已重置' }),\n")

remove('server/src/app.js', "  if (method === 'POST' && path === '/api/game/reset') return { action: 'resetPlayer', category: 'general' };\n")
replace(
    'server/src/app.js',
    "    const route = resolveAction(method, path);\n",
    "    if (method === 'POST' && path === '/api/game/reset') {\n"
    "      sendError(response, 410, '经济状态重置功能已永久移除');\n"
    "      return;\n"
    "    }\n\n"
    "    const route = resolveAction(method, path);\n",
)

remove('server/src/storage.js', "  canResetCollectibles,\n")
replace(
    'server/src/storage.js',
    "  'createCollectibleAuction', 'placeCollectibleBid', 'cancelCollectibleAuction', 'resetPlayer',\n",
    "  'createCollectibleAuction', 'placeCollectibleBid', 'cancelCollectibleAuction',\n",
)
replace(
    'server/src/storage.js',
    "      } else if (action === 'resetPlayer') {\n"
    "        const resetCheck = canResetCollectibles(world, Number(user.id), now);\n"
    "        if (resetCheck.ok) {\n"
    "          const preservedGems = player.gems;\n"
    "          const preservedInvitationGemsIssued = player.stats.invitationGemsIssued;\n"
    "          gameResult = applyFacilityGroupAction(world, user, action, payload, now);\n"
    "          const resetPlayer = world.players[String(user.id)];\n"
    "          ensureGemState(resetPlayer);\n"
    "          resetPlayer.gems = preservedGems;\n"
    "          resetPlayer.stats.invitationGemsIssued = preservedInvitationGemsIssued;\n"
    "        } else {\n"
    "          gameResult = resetCheck;\n"
    "        }\n"
    "      } else {\n",
    "      } else {\n",
)

remove(
    'server/src/domain-core.js',
    "function resetPlayer(world, user, now) {\n"
    "  world.orders = world.orders.filter((order) => order.ownerId !== Number(user.id));\n"
    "  world.facilityListings = world.facilityListings.filter((listing) => listing.ownerId !== Number(user.id));\n"
    "  world.players[String(user.id)] = createPlayer(user, now);\n"
    "  return result(true, '服务器经济状态已重置');\n"
    "}\n\n",
)
remove('server/src/domain-core.js', "    case 'resetPlayer': return resetPlayer(world, user, now);\n")
remove(
    'server/src/facility-groups.js',
    "function resetFacilityGroups(world, userId) {\n"
    "  const player = getPlayer(world, userId);\n"
    "  player.facilityGroups = [];\n"
    "  delete player.facilityConstruction;\n"
    "  delete player.facilities;\n"
    "}\n\n",
)
remove('server/src/facility-groups.js', "  if (action === 'resetPlayer' && actionResult.ok) resetFacilityGroups(world, userId);\n")
remove(
    'server/src/collectibles.js',
    "export function canResetCollectibles(world, userId, now = Date.now()) {\n"
    "  processCollectibleAuctions(world, now);\n"
    "  const active = world.collectibleAuctions.some((auction) => auction.status === 'open' && (\n"
    "    auction.sellerId === userId || auction.highestBidderId === userId\n"
    "  ));\n"
    "  return active\n"
    "    ? result(false, '存在进行中的资产拍卖或竞拍，无法重置经济状态')\n"
    "    : result(true, '可以重置');\n"
    "}\n\n",
)

remove(
    'miniprogram/pages/index/index.js',
    "\n  resetGame() {\n"
    "    tt.showModal({\n"
    "      title: '重置存档',\n"
    "      content: '确定要清空当前单机进度吗？',\n"
    "      success: (res) => {\n"
    "        if (!res.confirm) return;\n"
    "        this.saveData = createDefaultSave();\n"
    "        writeSave(this.saveData);\n"
    "        this.syncView('已重置存档');\n"
    "        tt.showToast({ title: '已重置', icon: 'success' });\n"
    "      },\n"
    "    });\n"
    "  },",
)
remove('miniprogram/pages/index/index.ttml', "      <button class=\"ghost-button\" bindtap=\"resetGame\">重置</button>\n")
remove('miniprogram/README.md', "- 重置存档\n")

replace(
    'README.md',
    '- 一个账号只能绑定一次邀请关系，分享链接与手动邀请码互斥；游戏重置不清空宝石、邀请码、邀请关系、宝石流水或封禁记录。\n',
    '- 一个账号只能绑定一次邀请关系，分享链接与手动邀请码互斥。玩家不提供经济状态重置能力，资金、库存、工厂、订单、统计、宝石、邀请码、邀请关系、宝石流水和封禁记录均持续保留。\n',
)

replace(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '设置页只允许玩家资料与四项统计、已经实现的客户端偏好、邀请入口、礼品兑换、管理员入口、退出登录和重置经济状态。',
    '设置页只允许玩家资料与四项统计、已经实现的客户端偏好、邀请入口、礼品兑换、管理员入口和退出登录。不得提供经济状态重置、清空进度或重新开始入口。',
)
replace(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '账号资料、管理员工具、当前会话和危险操作必须明确分组；重置经济状态固定放在带说明文字的危险区域，说明普通经济数据会清空，而宝石、邀请关系和封禁记录保留。',
    '账号资料、管理员工具和当前会话必须明确分组。设置页不得显示危险区域、重置经济状态按钮或任何清空服务器经济数据的说明。',
)
replace(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '| 资料、偏好、邀请、礼品、退出和重置 | 设置 |',
    '| 资料、偏好、邀请、礼品和退出 | 设置 |',
)
replace(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '- 允许分享链接与手动邀请码重复绑定、让被邀请人获得邀请宝石或让重置清除邀请关系；',
    '- 允许分享链接与手动邀请码重复绑定或让被邀请人获得邀请宝石；',
)
replace(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '- 把账号资料、管理员工具、退出登录和重置经济状态重新混入玩家资料卡的单一操作栈，或删除危险区域说明。',
    '- 恢复玩家经济状态重置、清空进度、重新开始按钮或对应客户端调用；\n- 把账号资料、管理员工具和退出登录重新混入玩家资料卡的单一操作栈。',
)

replace(
    'docs/UI_DESIGN_SYSTEM.md',
    '- “账号与管理”卡必须把账号资料、管理员工具、当前会话和危险区域分组。管理员工具只对管理员显示；重置经济状态使用危险按钮并同时显示清除范围与保留范围，颜色不能作为唯一警告。',
    '- “账号与管理”卡必须把账号资料、管理员工具和当前会话分组。管理员工具只对管理员显示；不得显示危险区域、经济状态重置按钮或清空进度说明。',
)
replace(
    'docs/UI_DESIGN_SYSTEM.md',
    '- 把账号资料、管理员入口、退出登录和重置经济状态重新混成无标题的单一操作栈，或删除危险区域说明；',
    '- 恢复经济状态重置、清空进度或重新开始控件；\n- 把账号资料、管理员入口和退出登录重新混成无标题的单一操作栈；',
)

replace(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    '| POST | `/api/game/reset` | 重置玩家经济状态但保留宝石、邀请和封禁记录 |',
    '| POST | `/api/game/reset` | 已永久移除；兼容旧客户端固定返回 `410 Gone`，不得执行任何状态写入 |',
)
replace(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    '- 权威动作与轮询并行更新界面；',
    '- 权威动作与轮询并行更新界面；\n- 玩家经济状态重置、清空进度或重新开始接口；',
)

replace(
    'tests/browser/settings-layout.spec.ts',
    "  await expect(account.getByRole('heading', { name: '危险区域', exact: true })).toBeVisible();\n"
    "  await expect(account.getByText('清空资金、统计、订单和工厂；宝石、邀请关系和封禁记录将保留。', { exact: true })).toBeVisible();\n",
    "  await expect(account.getByRole('button', { name: '重置经济状态', exact: true })).toHaveCount(0);\n"
    "  await expect(account.getByRole('heading', { name: '危险区域', exact: true })).toHaveCount(0);\n",
)

replace(
    'scripts/verify-settings-layout.mjs',
    "    'account-action-group',\n"
    "    'settings-danger-zone',\n"
    "    '账号与管理',\n"
    "    '账号资料',\n"
    "    '当前会话',\n"
    "    '危险区域',\n"
    "    '清空资金、统计、订单和工厂；宝石、邀请关系和封禁记录将保留。',\n",
    "    'account-action-group',\n"
    "    '账号与管理',\n"
    "    '账号资料',\n"
    "    '当前会话',\n",
)
replace(
    'scripts/verify-settings-layout.mjs',
    "    'profile-action-stack',\n",
    "    'profile-action-stack',\n"
    "    'settings-danger-zone',\n"
    "    '重置经济状态',\n"
    "    '危险区域',\n",
)
remove('scripts/verify-settings-layout.mjs', "    '.settings-danger-zone',\n")
replace(
    'scripts/verify-settings-layout.mjs',
    "    '危险区域',\n"
    "    '共享三列网格',\n",
    "    '不得提供经济状态重置',\n"
    "    '共享三列网格',\n",
)
replace(
    'scripts/verify-settings-layout.mjs',
    "  console.error(`设置页独立列、统计密度、账号分组和危险区域验证失败:\\n- ${failures.join('\\n- ')}`);",
    "  console.error(`设置页独立列、统计密度、账号分组和禁用重置验证失败:\\n- ${failures.join('\\n- ')}`);",
)
replace(
    'scripts/verify-settings-layout.mjs',
    "console.log('设置页独立主列／侧列、四项统计、账号分组、危险区域与设计文档验证通过。');",
    "console.log('设置页独立主列／侧列、四项统计、账号分组、禁用重置与设计文档验证通过。');",
)

verifier = '''import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const required = [
  'src/pages/SettingsPage.tsx',
  'src/api/game.ts',
  'src/app/gameViewModel.ts',
  'server/src/app.js',
  'server/src/storage.js',
  'server/src/domain-core.js',
  'server/src/facility-groups.js',
  'server/src/collectibles.js',
  'miniprogram/pages/index/index.js',
  'miniprogram/pages/index/index.ttml',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
];
for (const path of required) if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);

if (failures.length === 0) {
  const settings = read('src/pages/SettingsPage.tsx');
  const clientApi = read('src/api/game.ts');
  const viewModel = read('src/app/gameViewModel.ts');
  const serverApp = read('server/src/app.js');
  const serverSources = [
    read('server/src/storage.js'),
    read('server/src/domain-core.js'),
    read('server/src/facility-groups.js'),
    read('server/src/collectibles.js'),
  ].join('\n');
  const miniProgram = `${read('miniprogram/pages/index/index.js')}\n${read('miniprogram/pages/index/index.ttml')}`;
  const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
  const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');

  for (const [name, content, forbidden] of [
    ['SettingsPage', settings, ['重置经济状态', 'settings-danger-zone', '危险区域', 'reset()']],
    ['客户端 API', clientApi, ["postAction('/reset')", 'reset: () =>']],
    ['客户端 ViewModel', viewModel, ['resetPlayer', 'reset: () => Promise<ActionResult>']],
    ['服务器领域代码', serverSources, ['resetPlayer', 'canResetCollectibles', 'resetFacilityGroups', '服务器经济状态已重置']],
    ['小程序', miniProgram, ['resetGame', '重置存档', 'bindtap="resetGame"']],
  ]) {
    for (const text of forbidden) if (content.includes(text)) failures.push(`${name} 不得包含: ${text}`);
  }
  if (!serverApp.includes("sendError(response, 410, '经济状态重置功能已永久移除')")) failures.push('旧 /api/game/reset 必须固定返回 410 Gone');
  if (serverApp.includes("return { action: 'resetPlayer'")) failures.push('服务器不得把重置路径映射为领域动作');
  if (!pageDesign.includes('不得提供经济状态重置、清空进度或重新开始入口')) failures.push('页面设计缺少禁用重置规则');
  if (!serverDesign.includes('兼容旧客户端固定返回 `410 Gone`')) failures.push('服务器设计缺少退役接口规则');
}

if (failures.length) {
  console.error(`经济状态重置禁用验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('经济状态重置已从网页、小程序、客户端动作和服务器领域写入中移除；旧接口仅返回 410。');
'''
Path('scripts/verify-reset-disabled.mjs').write_text(verifier, encoding='utf-8')
replace(
    'package.json',
    'node scripts/verify-settings-layout.mjs && node --experimental-strip-types',
    'node scripts/verify-settings-layout.mjs && node scripts/verify-reset-disabled.mjs && node --experimental-strip-types',
)

for temporary in [
    '.github/workflows/apply-remove-reset-policy.yml',
    '.github/workflows/apply-remove-reset-pr.yml',
    'scripts/apply-remove-reset-policy.py',
]:
    file = Path(temporary)
    if file.exists():
        file.unlink()
