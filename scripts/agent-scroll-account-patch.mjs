import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const pathFor = (path) => resolve(root, path);
const read = (path) => readFileSync(pathFor(path), 'utf8');
const write = (path, content) => {
  mkdirSync(dirname(pathFor(path)), { recursive: true });
  writeFileSync(pathFor(path), content);
};

function replaceOnce(path, before, after) {
  const source = read(path);
  const first = source.indexOf(before);
  assert.notEqual(first, -1, `${path} 缺少待替换内容`);
  assert.equal(source.indexOf(before, first + before.length), -1, `${path} 待替换内容不唯一`);
  write(path, `${source.slice(0, first)}${after}${source.slice(first + before.length)}`);
}

function insertBefore(path, marker, addition) {
  const source = read(path);
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, `${path} 缺少插入标记: ${marker}`);
  write(path, `${source.slice(0, index)}${addition}${source.slice(index)}`);
}

replaceOnce(
  'src/hooks/useOverlayScrollbar.ts',
  `function canScrollInDirection(position: number, maximum: number, delta: number) {
  if (delta < 0) return position > 0;
  if (delta > 0) return position < maximum;
  return false;
}
`,
  `function canScrollInDirection(position: number, maximum: number, delta: number) {
  if (delta < 0) return position > 0;
  if (delta > 0) return position < maximum;
  return false;
}

const SCROLLABLE_OVERFLOW_VALUES = new Set(['auto', 'scroll', 'overlay']);

function elementCanScrollInDirection(element: HTMLElement, targetAxis: 'x' | 'y', delta: number) {
  const style = window.getComputedStyle(element);
  const overflow = targetAxis === 'x' ? style.overflowX : style.overflowY;
  if (!SCROLLABLE_OVERFLOW_VALUES.has(overflow)) return false;
  const maximum = targetAxis === 'x'
    ? Math.max(0, element.scrollWidth - element.clientWidth)
    : Math.max(0, element.scrollHeight - element.clientHeight);
  const position = targetAxis === 'x' ? element.scrollLeft : element.scrollTop;
  return maximum > 1 && canScrollInDirection(position, maximum, delta);
}

function descendantCanScrollInDirection(
  target: EventTarget | null,
  viewport: HTMLElement,
  targetAxis: 'x' | 'y',
  delta: number,
) {
  let element = target instanceof Element ? target : null;
  while (element && element !== viewport) {
    if (element instanceof HTMLElement && elementCanScrollInDirection(element, targetAxis, delta)) {
      return true;
    }
    element = element.parentElement;
  }
  return false;
}
`,
);

replaceOnce(
  'src/hooks/useOverlayScrollbar.ts',
  `      if (horizontalIntent && supportsAxis(axis, 'x') && maximumX > 0) {
        const delta = event.shiftKey ? event.deltaY : event.deltaX;
        if (canScrollInDirection(viewport.scrollLeft, maximumX, delta)) {
          event.preventDefault();
          viewport.scrollLeft += delta;
        }
        return;
      }

      if (
        verticalPriority
        && supportsAxis(axis, 'y')
        && maximumY > 0
        && Math.abs(event.deltaY) >= Math.abs(event.deltaX)
        && canScrollInDirection(viewport.scrollTop, maximumY, event.deltaY)
      ) {
        event.preventDefault();
        viewport.scrollTop += event.deltaY;
      }
`,
  `      if (horizontalIntent && supportsAxis(axis, 'x') && maximumX > 0) {
        const delta = event.shiftKey ? event.deltaY : event.deltaX;
        if (descendantCanScrollInDirection(event.target, viewport, 'x', delta)) return;
        if (canScrollInDirection(viewport.scrollLeft, maximumX, delta)) {
          event.preventDefault();
          event.stopPropagation();
          viewport.scrollLeft += delta;
        }
        return;
      }

      if (
        verticalPriority
        && supportsAxis(axis, 'y')
        && Math.abs(event.deltaY) >= Math.abs(event.deltaX)
      ) {
        if (descendantCanScrollInDirection(event.target, viewport, 'y', event.deltaY)) return;
        if (maximumY > 0 && canScrollInDirection(viewport.scrollTop, maximumY, event.deltaY)) {
          event.preventDefault();
          event.stopPropagation();
          viewport.scrollTop += event.deltaY;
        }
      }
`,
);

replaceOnce(
  'src/styles/industry-system.css',
  `  max-height: calc(100dvh - var(--space-6));
  overflow-y: auto;
  overscroll-behavior: contain;
`,
  `  max-height: calc(100dvh - var(--space-6));
  overflow-y: auto;
  overscroll-behavior-x: contain;
  overscroll-behavior-y: auto;
`,
);

replaceOnce(
  'src/styles/unified-market-admin.css',
  `  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
`,
  `  min-height: 0;
  overflow: auto;
  overscroll-behavior-x: contain;
  overscroll-behavior-y: auto;
`,
);

replaceOnce(
  'tests/browser/runtime-harness.tsx',
  `import { CurrencyAmount } from '../../src/components/ui/CurrencyAmount';
`,
  `import { CurrencyAmount } from '../../src/components/ui/CurrencyAmount';
import { ScrollArea } from '../../src/components/ui/ScrollArea';
`,
);
replaceOnce(
  'tests/browser/runtime-harness.tsx',
  `document.documentElement.dataset.appSurface = view === 'overview' || view === 'gem-shop' ? 'game' : 'auth';
`,
  `document.documentElement.dataset.appSurface = ['overview', 'gem-shop', 'scroll-ownership'].includes(view) ? 'game' : 'auth';
`,
);
insertBefore(
  'tests/browser/runtime-harness.tsx',
  `createRoot(document.getElementById('root') as HTMLElement).render(`,
  `function ScrollOwnershipHarness() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24, padding: 24 }}>
      <ScrollArea
        axis="y"
        className="scroll-ownership-custom-outer"
        viewportClassName="scroll-ownership-custom-outer-viewport"
        viewportStyle={{ height: 220, overflowY: 'auto' }}
        verticalAutoHide={false}
      >
        <ScrollArea
          axis="y"
          className="scroll-ownership-custom-inner"
          viewportClassName="scroll-ownership-custom-inner-viewport"
          viewportStyle={{ height: 120, overflowY: 'auto' }}
          verticalAutoHide={false}
        >
          <div style={{ height: 560 }} aria-hidden="true" />
        </ScrollArea>
        <div style={{ height: 760 }} aria-hidden="true" />
      </ScrollArea>

      <ScrollArea
        axis="y"
        className="scroll-ownership-native-outer"
        viewportClassName="scroll-ownership-native-outer-viewport"
        viewportStyle={{ height: 220, overflowY: 'auto' }}
        verticalAutoHide={false}
      >
        <div
          className="scroll-ownership-native-inner"
          style={{ height: 120, overflowY: 'auto' }}
          tabIndex={0}
        >
          <div style={{ height: 560 }} aria-hidden="true" />
        </div>
        <div style={{ height: 760 }} aria-hidden="true" />
      </ScrollArea>
    </main>
  );
}

`,
);
replaceOnce(
  'tests/browser/runtime-harness.tsx',
  `createRoot(document.getElementById('root') as HTMLElement).render(
  view === 'overview'
    ? <OverviewHarness />
    : view === 'gem-shop'
      ? <GemShopHarness />
      : <SettingsHarness />,
);
`,
  `createRoot(document.getElementById('root') as HTMLElement).render(
  view === 'overview'
    ? <OverviewHarness />
    : view === 'gem-shop'
      ? <GemShopHarness />
      : view === 'scroll-ownership'
        ? <ScrollOwnershipHarness />
        : <SettingsHarness />,
);
`,
);

write('tests/browser/scroll-ownership.spec.ts', `import { expect, test, type Locator, type Page } from '@playwright/test';

async function wheelOver(page: Page, target: Locator, deltaY: number) {
  const box = await target.boundingBox();
  if (!box) throw new Error('scroll ownership target is not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 60));
  await page.mouse.wheel(0, deltaY);
}

async function position(target: Locator) {
  return target.evaluate((element) => ({
    top: element.scrollTop,
    maximum: Math.max(0, element.scrollHeight - element.clientHeight),
  }));
}

test.describe('nested scroll ownership', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 720 });
    await page.goto('runtime-test.html?view=scroll-ownership');
  });

  test('the nearest custom ScrollArea owns the wheel until it reaches its boundary', async ({ page }) => {
    const outer = page.locator('.scroll-ownership-custom-outer-viewport');
    const inner = page.locator('.scroll-ownership-custom-inner-viewport');

    await wheelOver(page, inner, 160);
    await expect.poll(async () => (await position(inner)).top).toBeGreaterThan(0);
    expect((await position(outer)).top).toBe(0);

    await inner.evaluate((element) => { element.scrollTop = element.scrollHeight - element.clientHeight; });
    await outer.evaluate((element) => { element.scrollTop = 0; });
    await wheelOver(page, inner, 160);
    await expect.poll(async () => (await position(outer)).top).toBeGreaterThan(0);
  });

  test('a native nested scrollport is not stolen by the parent ScrollArea', async ({ page }) => {
    const outer = page.locator('.scroll-ownership-native-outer-viewport');
    const inner = page.locator('.scroll-ownership-native-inner');

    await wheelOver(page, inner, 160);
    await expect.poll(async () => (await position(inner)).top).toBeGreaterThan(0);
    expect((await position(outer)).top).toBe(0);

    await inner.evaluate((element) => { element.scrollTop = element.scrollHeight - element.clientHeight; });
    await outer.evaluate((element) => { element.scrollTop = 0; });
    await wheelOver(page, inner, 160);
    await expect.poll(async () => (await position(outer)).top).toBeGreaterThan(0);
  });

  test('the final boundary leaves the wheel event unconsumed', async ({ page }) => {
    const outer = page.locator('.scroll-ownership-custom-outer-viewport');
    const inner = page.locator('.scroll-ownership-custom-inner-viewport');
    await page.evaluate(() => {
      (window as typeof window & { __boundaryWheel?: { seen: boolean; defaultPrevented: boolean } }).__boundaryWheel = {
        seen: false,
        defaultPrevented: true,
      };
      document.addEventListener('wheel', (event) => {
        (window as typeof window & { __boundaryWheel?: { seen: boolean; defaultPrevented: boolean } }).__boundaryWheel = {
          seen: true,
          defaultPrevented: event.defaultPrevented,
        };
      }, { once: true });
    });
    await inner.evaluate((element) => { element.scrollTop = element.scrollHeight - element.clientHeight; });
    await outer.evaluate((element) => { element.scrollTop = element.scrollHeight - element.clientHeight; });

    await wheelOver(page, inner, 160);
    await expect.poll(() => page.evaluate(() => (
      window as typeof window & { __boundaryWheel?: { seen: boolean; defaultPrevented: boolean } }
    ).__boundaryWheel)).toEqual({ seen: true, defaultPrevented: false });
  });
});
`);

write('scripts/verify-scroll-ownership.mjs', `import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const walk = (path) => readdirSync(resolve(root, path)).flatMap((entry) => {
  const relative = \`${'${path}/${entry}'}\`;
  return statSync(resolve(root, relative)).isDirectory() ? walk(relative) : [relative];
});

const hook = read('src/hooks/useOverlayScrollbar.ts');
for (const text of [
  'SCROLLABLE_OVERFLOW_VALUES',
  'function descendantCanScrollInDirection',
  "descendantCanScrollInDirection(event.target, viewport, 'x', delta)",
  "descendantCanScrollInDirection(event.target, viewport, 'y', event.deltaY)",
  'event.stopPropagation()',
]) assert.ok(hook.includes(text), \`覆盖式滚动条缺少滚轮归属规则: ${'${text}'}\`);

for (const [path, selector] of [
  ['src/styles/industry-system.css', '.production-build-card'],
  ['src/styles/unified-market-admin.css', '.admin-page-scroll'],
]) {
  const source = read(path);
  const start = source.lastIndexOf(selector);
  const block = source.slice(start, source.indexOf('}', start) + 1);
  assert.ok(block.includes('overscroll-behavior-y: auto;'), \`${'${path}'} 的 ${'${selector}'} 必须释放纵向边界\`);
}

for (const path of walk('src/styles').filter((item) => item.endsWith('.css'))) {
  assert.equal(
    /overscroll-behavior\\s*:\\s*contain\\s*;/.test(read(path)),
    false,
    \`${'${path}'} 不得使用同时吞掉纵向边界的 overscroll-behavior: contain\`,
  );
}

const browser = read('tests/browser/scroll-ownership.spec.ts');
for (const text of [
  'the nearest custom ScrollArea owns the wheel until it reaches its boundary',
  'a native nested scrollport is not stolen by the parent ScrollArea',
  'the final boundary leaves the wheel event unconsumed',
  'defaultPrevented: false',
]) assert.ok(browser.includes(text), \`滚轮归属浏览器测试缺少: ${'${text}'}\`);

const design = read('docs/UI_DESIGN_SYSTEM.md');
for (const text of [
  '最近且仍能沿当前方向滚动的后代视口',
  '当前视口真正发生滚动时必须同时调用 `preventDefault()` 与 `stopPropagation()`',
  '生产页桌面“建设新工厂”卡',
  '管理员后台整页滚动区',
]) assert.ok(design.includes(text), \`UI 设计文档缺少滚轮规则或控件位置: ${'${text}'}\`);

console.log('Nested custom/native scroll ownership, boundary release and control location verification passed.');
`);

const accounts = Array.from({ length: 24 }, (_, index) => {
  const slot = index + 1;
  const suffix = String(slot).padStart(2, '0');
  return {
    slot,
    id: `stress-player-${suffix}`,
    email: `economy-stress-${suffix}@riversoft.top`,
    role: 'player',
  };
});
write('tests/stress/accounts.json', `${JSON.stringify({
  version: 1,
  description: 'Economy 固定压力测试普通玩家账号池；账号只需在主页账号服务中预置一次。',
  passwordEnv: 'ECONOMY_STRESS_TEST_PASSWORD',
  accounts,
}, null, 2)}\n`);

write('tests/stress/loadAccounts.mjs', `import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registryUrl = new URL('./accounts.json', import.meta.url);

export async function loadStressAccountRegistry() {
  const registry = JSON.parse(await readFile(registryUrl, 'utf8'));
  assert.equal(registry.version, 1, '不支持的压力测试账号池版本');
  assert.equal(typeof registry.passwordEnv, 'string');
  assert.ok(Array.isArray(registry.accounts) && registry.accounts.length > 0, '压力测试账号池为空');
  return registry;
}

export async function loadStressAccounts({ env = process.env, offset = 0, limit } = {}) {
  const registry = await loadStressAccountRegistry();
  const password = env[registry.passwordEnv];
  if (!password) throw new Error(\`缺少压力测试账号密码环境变量 ${'${registry.passwordEnv}'}\`);
  const normalizedOffset = Math.max(0, Math.floor(Number(offset) || 0));
  const normalizedLimit = limit === undefined
    ? registry.accounts.length
    : Math.max(0, Math.floor(Number(limit) || 0));
  return registry.accounts.slice(normalizedOffset, normalizedOffset + normalizedLimit).map((account) => ({
    ...account,
    password,
  }));
}
`);

write('scripts/verify-stress-test-accounts.mjs', `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadStressAccounts, loadStressAccountRegistry } from '../tests/stress/loadAccounts.mjs';

const root = process.cwd();
const manifestPath = resolve(root, 'tests/stress/accounts.json');
const raw = readFileSync(manifestPath, 'utf8');
const registry = await loadStressAccountRegistry();

assert.equal(registry.version, 1);
assert.equal(registry.passwordEnv, 'ECONOMY_STRESS_TEST_PASSWORD');
assert.equal(registry.accounts.length, 24, '固定压力测试账号池必须保持 24 个槽位');
assert.equal(new Set(registry.accounts.map((account) => account.id)).size, registry.accounts.length);
assert.equal(new Set(registry.accounts.map((account) => account.email)).size, registry.accounts.length);
assert.equal(/"password"\\s*:|"cookie"\\s*:|"token"\\s*:|"session"\\s*:/i.test(raw), false, '账号池不得保存密码、Cookie、Token 或 Session');
assert.equal(readFileSync(resolve(root, 'tests/stress/loadAccounts.mjs'), 'utf8').includes('/registration/'), false, '压力测试账号加载器不得注册新账号');

registry.accounts.forEach((account, index) => {
  const suffix = String(index + 1).padStart(2, '0');
  assert.deepEqual(account, {
    slot: index + 1,
    id: \`stress-player-${'${suffix}'}\`,
    email: \`economy-stress-${'${suffix}'}@riversoft.top\`,
    role: 'player',
  });
});

await assert.rejects(() => loadStressAccounts({ env: {} }), /ECONOMY_STRESS_TEST_PASSWORD/);
const loaded = await loadStressAccounts({ env: { ECONOMY_STRESS_TEST_PASSWORD: 'runtime-only-secret' }, offset: 2, limit: 3 });
assert.deepEqual(loaded.map(({ id, email, password }) => ({ id, email, password })), [
  { id: 'stress-player-03', email: 'economy-stress-03@riversoft.top', password: 'runtime-only-secret' },
  { id: 'stress-player-04', email: 'economy-stress-04@riversoft.top', password: 'runtime-only-secret' },
  { id: 'stress-player-05', email: 'economy-stress-05@riversoft.top', password: 'runtime-only-secret' },
]);

console.log('Fixed reusable stress-test account registry and secret boundary verification passed.');
`);

const packageJson = JSON.parse(read('package.json'));
const verificationNeedle = 'node scripts/verify-email-registration.mjs && ';
assert.ok(packageJson.scripts['verify:architecture'].includes(verificationNeedle));
packageJson.scripts['verify:architecture'] = packageJson.scripts['verify:architecture'].replace(
  verificationNeedle,
  `${verificationNeedle}node scripts/verify-stress-test-accounts.mjs && node scripts/verify-scroll-ownership.mjs && `,
);
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

replaceOnce(
  'docs/UI_DESIGN_SYSTEM.md',
  `- 普通滚轮和以 \`deltaY\` 为主的触控板输入优先垂直滚动；只有 \`Shift + 滚轮\`、明确以 \`deltaX\` 为主的触控板输入、水平滑块拖动或水平轨道点击才执行水平滚动。到达内部纵向边界后必须把滚动链交给外层，不得自动改成水平滚动。
`,
  `- 普通滚轮和以 \`deltaY\` 为主的触控板输入优先垂直滚动；只有 \`Shift + 滚轮\`、明确以 \`deltaX\` 为主的触控板输入、水平滑块拖动或水平轨道点击才执行水平滚动。到达内部纵向边界后必须把滚动链交给外层，不得自动改成水平滚动。
- 同一滚轮事件经过嵌套视口时，最近且仍能沿当前方向滚动的后代视口拥有事件；祖先 \`ScrollArea\` 必须先检查事件目标到自身视口之间的原生或共享滚动容器，不得在后代尚未到边界时抢走滚动。
- 当前视口真正发生滚动时必须同时调用 \`preventDefault()\` 与 \`stopPropagation()\`，避免共享内层和页面外层同时位移；到顶、到底或该轴不可滚动时两者都不得调用，使事件继续交给祖先或浏览器。仅横向控件不得消费普通纵向滚轮。
`,
);
insertBefore(
  'docs/UI_DESIGN_SYSTEM.md',
  `“我的未完成订单”列顺序固定为：`,
  `### 7.2 滚轮事件归属与前端控件位置

本次滚动链审计确认以下纵向控件必须遵守“内部可滚动时由内部消费，边界后释放给外层”的同一规则：

- 全部玩家页面的根视口：\`GameShell.tsx\` 中的 \`.page-scroll\`；它只在没有更近的可滚动后代时消费。
- 概览页“当前挂单”卡：\`OverviewPage.tsx\` / \`overview-polish.css\` 的 \`.overview-open-orders-list--scrollable\`。
- 生产页桌面“建设新工厂”卡：\`ProductionPage.tsx\` / \`industry-system.css\` 的 \`.production-build-card\`；不得再使用会吞掉纵向边界的双轴 \`overscroll-behavior: contain\`。
- 排行页四个榜单卡：\`LeaderboardsPage.tsx\` / \`leaderboards.css\` 的 \`.leaderboard-list\`。
- 资产页“本地资产变动”：\`AssetsPage.tsx\` 的 \`.asset-event-virtual-list\` \`VirtualList\`。
- 市场页“我的订单与成交 → 本地成交记录”：\`MarketPage.tsx\` 的 \`.local-trades-scroll-area\` 内层 \`.virtual-record-viewport\`。
- 管理员后台整页滚动区：\`AdminApp.tsx\` / \`unified-market-admin.css\` 的 \`.admin-page-scroll\`，以及其中的藏品管理、藏品归属历史、礼品码记录和兑换记录四类 \`VirtualList\`。
- 桌面侧栏导航：\`SidebarFrame.tsx\` 的 \`.sidebar-nav\`；其外层没有可滚动页面时，到边界仍不得人为阻止事件继续传播。

横向状态栏、市场资产目录、表格横向视口和移动底栏不是纵向消费控件；未按下 \`Shift\` 且输入以 \`deltaY\` 为主时必须放行。所有新增固定高度、\`overflow-y: auto|scroll\` 或 \`VirtualList\` 控件都必须加入滚轮归属浏览器测试或复用已经覆盖的共享实现。

`,
);

insertBefore(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  `## 10. 防回退`,
  `## 9.2 固定压力测试账号池

- \`tests/stress/accounts.json\` 是压力测试普通玩家身份的唯一仓库记录，固定保存 24 个槽位 \`stress-player-01\`～\`stress-player-24\` 及对应 \`economy-stress-01@riversoft.top\`～\`economy-stress-24@riversoft.top\` 邮箱。
- 这些账号只需在主页账号服务中预置一次；后续压力测试必须按槽位复用，不得默认调用注册接口、生成随机邮箱或在每轮测试后删除账号。需要超过 24 个并发身份时，必须先扩展清单、验证唯一性并完成一次性预置。
- 仓库不得保存密码、Cookie、Token、Session 或管理员身份。运行时密码只从 \`ECONOMY_STRESS_TEST_PASSWORD\` 环境变量读取；测试日志、错误输出和 CI artifact 均不得打印该值。
- \`tests/stress/loadAccounts.mjs\` 是 Node 压力测试脚本读取账号池的统一入口，支持按稳定顺序、\`offset\` 和 \`limit\` 选择槽位。账号池只提供登录身份，不改变经济资产、封禁、邀请或排行榜规则。
- 固定账号必须保持普通玩家角色，不得借压力测试账号绕过主页账号认证、同 IP 规则、写操作幂等或 Economy 服务器资产校验。

`,
);
replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  `- 删除 CI 或主部署中的 Chromium 浏览器运行时测试、localStorage 拒绝访问覆盖或顶层错误边界；
`,
  `- 删除 CI 或主部署中的 Chromium 浏览器运行时测试、localStorage 拒绝访问覆盖或顶层错误边界；
- 压力测试重新随机注册账号、把测试账号密码或会话写入仓库、让账号池包含管理员身份，或绕过 \`tests/stress/accounts.json\` 与 \`loadAccounts.mjs\` 的固定槽位；
`,
);

insertBefore(
  'README.md',
  `## 本地开发与完整检查`,
  `## 固定压力测试账号

压力测试统一复用 \`tests/stress/accounts.json\` 中的 24 个普通玩家槽位，避免每轮测试注册新邮箱。账号在主页账号服务中一次性预置后保持不变；Node 测试脚本通过 \`tests/stress/loadAccounts.mjs\` 读取，并用 \`offset\` / \`limit\` 分配并发槽位。

仓库只记录测试邮箱和逻辑槽位，不保存密码、Cookie 或 Token。运行前在测试环境注入 \`ECONOMY_STRESS_TEST_PASSWORD\`；压力脚本不得调用注册接口，也不得把运行时凭据写入日志或 artifact。

`,
);

rmSync(pathFor('scripts/agent-scroll-account-patch.mjs'), { force: true });
console.log('Applied scroll ownership, browser coverage, design rules and reusable stress account registry.');
