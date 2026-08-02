from __future__ import annotations

import re
from pathlib import Path

ROOT = Path.cwd()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one exact match, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


def sub_once(path: str, pattern: str, replacement: str, *, flags: int = 0) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{path}: expected one regex match, found {count}: {pattern[:120]!r}')
    write(path, updated)


component_path = 'src/components/system/ApplicationLoadingState.tsx'
component = """import type { ReactNode } from 'react';

export function ApplicationLoadingState({ children }: { children: ReactNode }) {
  return (
    <main className=\"game-state-shell\">
      <div className=\"loading-screen\" role=\"status\" aria-live=\"polite\">{children}</div>
    </main>
  );
}
"""
write(component_path, component)

replace_once(
    'src/app/App.tsx',
    "import { getCurrentUser, initializeEconomySession, type EconomySessionResponse } from '../api/auth';\n",
    "import { getCurrentUser, initializeEconomySession, type EconomySessionResponse } from '../api/auth';\n"
    "import { ApplicationLoadingState } from '../components/system/ApplicationLoadingState';\n",
)
sub_once(
    'src/app/App.tsx',
    r"\nfunction LoadingState\(\{ variant, children \}: \{ variant: FinancialBackdropVariant; children: string \}\) \{.*?\n\}\n\nexport default function App\(\)",
    "\nexport default function App()",
    flags=re.S,
)
replace_once(
    'src/app/App.tsx',
    """      <LoadingState variant={stateVariantForPath(adminPath)}>
        正在连接统一账号服务…
      </LoadingState>""",
    """      <ApplicationLoadingState>
        正在连接统一账号服务…
      </ApplicationLoadingState>""",
)
replace_once(
    'src/app/App.tsx',
    """        <LoadingState variant={adminPath ? 'admin' : 'game'}>
          正在加载金融帝国…
        </LoadingState>""",
    """        <ApplicationLoadingState>
          正在加载金融帝国…
        </ApplicationLoadingState>""",
)

replace_once(
    'src/app/GameApp.tsx',
    "import type { AuthUser } from '../types';\n",
    "import type { AuthUser } from '../types';\n"
    "import { ApplicationLoadingState } from '../components/system/ApplicationLoadingState';\n",
)
replace_once(
    'src/app/GameApp.tsx',
    """function GameStateShell({ children }: { children: ReactNode }) {
  return (
    <main className=\"game-state-shell\">
      <div className=\"loading-screen\">{children}</div>
    </main>
  );
}""",
    """function GameErrorStateShell({ children }: { children: ReactNode }) {
  return (
    <main className=\"game-state-shell\">
      <div className=\"loading-screen\" role=\"alert\">{children}</div>
    </main>
  );
}""",
)
replace_once(
    'src/app/GameApp.tsx',
    "return <GameStateShell>正在连接权威游戏服务器…</GameStateShell>;",
    "return <ApplicationLoadingState>正在连接权威游戏服务器…</ApplicationLoadingState>;",
)
replace_once(
    'src/app/GameApp.tsx',
    """      <GameStateShell>
        <div><strong>无法加载游戏状态</strong><p><CurrencyText>{viewModel.message}</CurrencyText></p><button type=\"button\" onClick={viewModel.retry}>重新连接</button></div>
      </GameStateShell>""",
    """      <GameErrorStateShell>
        <div><strong>无法加载游戏状态</strong><p><CurrencyText>{viewModel.message}</CurrencyText></p><button type=\"button\" onClick={viewModel.retry}>重新连接</button></div>
      </GameErrorStateShell>""",
)

replace_once(
    'src/styles/financial-backdrop.css',
    """.photographic-state-card--loading {
  font-weight: 800;
}

""",
    "",
)

replace_once(
    'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
    "不得在 `LoginPage`、`GameStateShell`、`GameShell`、`AdminApp` 或 `PhotographicStateShell` 中重新挂载 `FinancialBackdrop`",
    "不得在 `LoginPage`、`ApplicationLoadingState`、`GameErrorStateShell`、`GameShell`、`AdminApp` 或 `PhotographicStateShell` 中重新挂载 `FinancialBackdrop`",
)
replace_once(
    'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
    "根级加载、封禁、无权限和致命错误由 `PhotographicStateShell` 承载单一可滚动状态卡。",
    "统一账号服务连接、代码包加载与权威游戏服务器连接统一由 `ApplicationLoadingState` 承载同一全屏居中加载结构，只允许替换中文文字，不得恢复深色加载卡片或创建平行加载样式；游戏状态加载失败由 `GameErrorStateShell` 使用同一基础布局承载错误内容。封禁、无权限和致命错误仍由 `PhotographicStateShell` 承载单一可滚动状态卡。",
)

replace_once(
    'docs/LIQUID_GLASS_CHROME_DESIGN.md',
    "| `PhotographicStateShell.tsx` | 统一账号检查、代码包加载、封禁、无权限和致命错误的语义状态、安全区内容几何与 critical 状态卡；不得挂载摄影图片 |",
    "| `ApplicationLoadingState.tsx` | 统一账号服务连接、代码包加载和权威游戏服务器连接的唯一全屏居中加载结构；三个入口只允许替换中文文字，不得恢复深色加载卡片或创建平行加载样式 |\n"
    "| `PhotographicStateShell.tsx` | 封禁、无权限和致命错误的语义状态、安全区内容几何与 critical 状态卡；不得承担普通加载状态或挂载摄影图片 |",
)
replace_once(
    'docs/LIQUID_GLASS_CHROME_DESIGN.md',
    "`LoginPage`、`GameStateShell`、`GameShell`、`AdminApp`、`PhotographicStateShell` 和 `SignedInShell` 不得导入或渲染 `FinancialBackdrop`",
    "`LoginPage`、`ApplicationLoadingState`、`GameErrorStateShell`、`GameShell`、`AdminApp`、`PhotographicStateShell` 和 `SignedInShell` 不得导入或渲染 `FinancialBackdrop`",
)
replace_once(
    'docs/LIQUID_GLASS_CHROME_DESIGN.md',
    "| `verify-game-three-layer.mjs` | 根级唯一摄影节点、三种氛围、数据属性切换、根级状态外壳、兼容入口、浏览器 harness 和移动 Overlay 防回退 |",
    "| `verify-game-three-layer.mjs` | 根级唯一摄影节点、三种氛围、数据属性切换、统一加载结构、critical 状态外壳、兼容入口、浏览器 harness 和移动 Overlay 防回退 |",
)

replace_once(
    'scripts/verify-game-three-layer.mjs',
    """  'src/config/visualAssets.ts',
  'src/components/visual/FinancialBackdrop.tsx',
  'src/components/visual/PhotographicStateShell.tsx',""",
    """  'src/config/visualAssets.ts',
  'src/components/visual/FinancialBackdrop.tsx',
  'src/components/visual/PhotographicStateShell.tsx',
  'src/components/system/ApplicationLoadingState.tsx',""",
)
replace_once(
    'scripts/verify-game-three-layer.mjs',
    """for (const text of [
  'function GameStateShell',
  '<main className=\"game-state-shell\">',
  '正在连接权威游戏服务器',
  '无法加载游戏状态',
]) requireText('src/app/GameApp.tsx', text);""",
    """for (const text of [
  \"import { ApplicationLoadingState } from '../components/system/ApplicationLoadingState';\",
  'function GameErrorStateShell',
  '<div className=\"loading-screen\" role=\"alert\">',
  '<ApplicationLoadingState>正在连接权威游戏服务器…</ApplicationLoadingState>',
  '无法加载游戏状态',
]) requireText('src/app/GameApp.tsx', text);""",
)
replace_once(
    'scripts/verify-game-three-layer.mjs',
    """for (const text of [
  'export function PhotographicStateShell',
  \"'photographic-state-shell'\",
  'data-photographic-state-variant={variant}',
  \"role?: 'alert' | 'status';\",
]) requireText('src/components/visual/PhotographicStateShell.tsx', text);
forbidText('src/components/visual/PhotographicStateShell.tsx', '<FinancialBackdrop');""",
    """for (const text of [
  'export function PhotographicStateShell',
  \"'photographic-state-shell'\",
  'data-photographic-state-variant={variant}',
  \"role?: 'alert' | 'status';\",
]) requireText('src/components/visual/PhotographicStateShell.tsx', text);
forbidText('src/components/visual/PhotographicStateShell.tsx', '<FinancialBackdrop');

for (const text of [
  'export function ApplicationLoadingState',
  '<main className=\"game-state-shell\">',
  '<div className=\"loading-screen\" role=\"status\" aria-live=\"polite\">',
]) requireText('src/components/system/ApplicationLoadingState.tsx', text);
forbidText('src/components/system/ApplicationLoadingState.tsx', 'PhotographicStateShell');
forbidText('src/components/system/ApplicationLoadingState.tsx', 'FinancialBackdrop');""",
)
replace_once(
    'scripts/verify-game-three-layer.mjs',
    """  'function LoadingState',
  'document.documentElement.dataset.appSurface = surface;',""",
    """  \"import { ApplicationLoadingState } from '../components/system/ApplicationLoadingState';\",
  'document.documentElement.dataset.appSurface = surface;',""",
)
replace_once(
    'scripts/verify-game-three-layer.mjs',
    """  '<LoadingState variant={stateVariantForPath(adminPath)}>',
  \"<LoadingState variant={adminPath ? 'admin' : 'game'}>\",
  '正在连接统一账号服务',
  '正在加载金融帝国',""",
    """  '<ApplicationLoadingState>',
  '正在连接统一账号服务',
  '正在加载金融帝国',""",
)
replace_once(
    'scripts/verify-game-three-layer.mjs',
    """  '正在加载金融帝国',
]) requireText('src/app/App.tsx', text);

for (const text of [
  'function currentFallbackVariant()',""",
    """  '正在加载金融帝国',
]) requireText('src/app/App.tsx', text);
const appSource = read('src/app/App.tsx');
if ((appSource.match(/<ApplicationLoadingState>/g) ?? []).length !== 2) {
  failures.push('App.tsx 必须且只能为账号检查和代码包加载渲染两个 ApplicationLoadingState');
}

for (const text of [
  'function currentFallbackVariant()',""",
)
replace_once(
    'scripts/verify-game-three-layer.mjs',
    """  'src/components/visual/PhotographicStateShell.tsx',
]) forbidText(path, 'FinancialBackdrop');""",
    """  'src/components/visual/PhotographicStateShell.tsx',
  'src/components/system/ApplicationLoadingState.tsx',
]) forbidText(path, 'FinancialBackdrop');""",
)
replace_once(
    'scripts/verify-game-three-layer.mjs',
    """  '.photographic-state-card {',
  '@media (max-width: 720px)',""",
    """  '.photographic-state-card {',
  '.game-state-shell > .loading-screen {',
  '@media (max-width: 720px)',""",
)
replace_once(
    'scripts/verify-game-three-layer.mjs',
    """for (const text of [authImageNegativeLayer, authAtmosphereNegativeLayer]) {
  requireText('src/styles/financial-backdrop.css', text);
}""",
    """for (const text of [authImageNegativeLayer, authAtmosphereNegativeLayer]) {
  requireText('src/styles/financial-backdrop.css', text);
}
forbidText('src/styles/financial-backdrop.css', '.photographic-state-card--loading');""",
)
replace_once(
    'scripts/verify-game-three-layer.mjs',
    """  '不得在 `LoginPage`、`GameStateShell`、`GameShell`、`AdminApp` 或 `PhotographicStateShell` 中重新挂载',
  '`tests/browser/application-photography.spec.ts`',""",
    """  '统一账号服务连接、代码包加载与权威游戏服务器连接统一由 `ApplicationLoadingState`',
  '不得恢复深色加载卡片或创建平行加载样式',
  '不得在 `LoginPage`、`ApplicationLoadingState`、`GameErrorStateShell`、`GameShell`、`AdminApp` 或 `PhotographicStateShell` 中重新挂载',
  '`tests/browser/application-photography.spec.ts`',""",
)
replace_once(
    'scripts/verify-game-three-layer.mjs',
    """  '不得重新提供 `SignedInShell.backdrop`',
  '`application-photography.spec.ts`',""",
    """  '不得重新提供 `SignedInShell.backdrop`',
  '`ApplicationLoadingState.tsx`',
  '三个入口只允许替换中文文字',
  '`application-photography.spec.ts`',""",
)
replace_once(
    'scripts/verify-game-three-layer.mjs',
    """  'keeps the same photography node from account checking into authentication',
  \"data.persistenceProbe = 'account-check'\",""",
    """  'keeps the same photography node from account checking into authentication',
  'uses the shared loading layout while loading the financial empire code',
  'uses the shared loading layout while connecting to the authoritative game server',
  'expectSharedLoadingState',
  \"data.persistenceProbe = 'account-check'\",""",
)
insert_marker = "forbidText('src/app/GameApp.tsx', 'FinancialBackdrop');\n"
replace_once(
    'scripts/verify-game-three-layer.mjs',
    insert_marker,
    insert_marker
    + "forbidText('src/app/App.tsx', 'function LoadingState');\n"
    + "forbidText('src/app/App.tsx', '<LoadingState');\n"
    + "forbidText('src/app/GameApp.tsx', 'function GameStateShell');\n",
)

replace_once(
    'tests/browser/application-photography.spec.ts',
    """async function configureSession(page: Page, {
  role = 'user',
  banned = false,
  incidentId,
}: {
  role?: 'user' | 'admin';
  banned?: boolean;
  incidentId?: number;
} = {}) {
  await page.route('**/economy-api/me', (route) => json(route, {
    user: { id: 1, email: `${role}@example.com`, name: role === 'admin' ? '管理员' : '玩家', role },
  }));
  await page.route('**/economy-api/game/session', (route) => json(route, {
    playerCreated: false,
    banned,
    incidentId,
    invitationBound: false,
    invalidInvite: false,
  }));
}
""",
    """async function configureSession(page: Page, {
  role = 'user',
  banned = false,
  incidentId,
}: {
  role?: 'user' | 'admin';
  banned?: boolean;
  incidentId?: number;
} = {}) {
  await page.route('**/economy-api/me', (route) => json(route, {
    user: { id: 1, email: `${role}@example.com`, name: role === 'admin' ? '管理员' : '玩家', role },
  }));
  await page.route('**/economy-api/game/session', (route) => json(route, {
    playerCreated: false,
    banned,
    incidentId,
    invitationBound: false,
    invalidInvite: false,
  }));
}

async function expectSharedLoadingState(page: Page, label: string) {
  const shell = page.locator('.game-state-shell');
  const loading = shell.locator('.loading-screen');
  await expect(shell).toBeVisible();
  await expect(loading).toHaveText(label);
  await expect(loading).toHaveAttribute('role', 'status');
  await expect(loading).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('.photographic-state-card--loading')).toHaveCount(0);

  const visual = await loading.evaluate((element) => {
    const shellElement = element.parentElement;
    if (!(shellElement instanceof HTMLElement)) throw new Error('loading shell is missing');
    const shellStyle = getComputedStyle(shellElement);
    const loadingStyle = getComputedStyle(element);
    return {
      shellPosition: shellStyle.position,
      shellTop: shellStyle.top,
      shellRight: shellStyle.right,
      shellBottom: shellStyle.bottom,
      shellLeft: shellStyle.left,
      display: loadingStyle.display,
      alignItems: loadingStyle.alignItems,
      justifyItems: loadingStyle.justifyItems,
      fontWeight: loadingStyle.fontWeight,
      textAlign: loadingStyle.textAlign,
    };
  });
  expect(visual).toEqual({
    shellPosition: 'fixed',
    shellTop: '0px',
    shellRight: '0px',
    shellBottom: '0px',
    shellLeft: '0px',
    display: 'grid',
    alignItems: 'center',
    justifyItems: 'center',
    fontWeight: '800',
    textAlign: 'center',
  });
}
""",
)
replace_once(
    'tests/browser/application-photography.spec.ts',
    """    const shell = page.locator('.photographic-state-shell');
    const imageLayer = page.locator('.application-image-layer');
    const image = imageLayer.locator('img');
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute('data-photographic-state-variant', 'auth');
    await expect(imageLayer).toHaveCount(1);
    await expect(imageLayer).toBeVisible();
    await expect(page.locator('.application-atmosphere-layer')).toBeVisible();
    await expect(page.getByText('正在连接统一账号服务…', { exact: true })).toBeVisible();""",
    """    const imageLayer = page.locator('.application-image-layer');
    const image = imageLayer.locator('img');
    await expectSharedLoadingState(page, '正在连接统一账号服务…');
    await expect(page.locator('html')).toHaveAttribute('data-app-backdrop', 'auth');
    await expect(imageLayer).toHaveCount(1);
    await expect(imageLayer).toBeVisible();
    await expect(page.locator('.application-atmosphere-layer')).toBeVisible();""",
)
first_test_end = """    expect(visual.imageLoading).toBe('eager');
    expect(visual.imageFetchPriority).toBe('high');
  });

  test('uses the game critical atmosphere for banned accounts', async ({ page }) => {"""
new_tests = """    expect(visual.imageLoading).toBe('eager');
    expect(visual.imageFetchPriority).toBe('high');
  });

  test('uses the shared loading layout while loading the financial empire code', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await routePhotography(page);
    await configureSession(page);

    let releaseModule = () => {};
    const moduleGate = new Promise<void>((resolve) => {
      releaseModule = resolve;
    });
    await page.route('**/src/app/GameApp.tsx*', async (route) => {
      await moduleGate;
      await route.continue();
    });

    await page.goto('/economy/', { waitUntil: 'domcontentloaded' });
    await expectSharedLoadingState(page, '正在加载金融帝国…');
    await expect(page.locator('html')).toHaveAttribute('data-app-backdrop', 'game');
    releaseModule();
  });

  test('uses the shared loading layout while connecting to the authoritative game server', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await routePhotography(page);
    await configureSession(page);

    let releaseState = () => {};
    const stateGate = new Promise<void>((resolve) => {
      releaseState = resolve;
    });
    await page.route('**/economy-api/game/state**', async (route) => {
      await stateGate;
      await route.abort('failed');
    });

    await page.goto('/economy/', { waitUntil: 'domcontentloaded' });
    await expectSharedLoadingState(page, '正在连接权威游戏服务器…');
    await expect(page.locator('html')).toHaveAttribute('data-app-backdrop', 'game');
    releaseState();
    await expect(page.getByText('无法加载游戏状态', { exact: true })).toBeVisible();
  });

  test('uses the game critical atmosphere for banned accounts', async ({ page }) => {"""
replace_once('tests/browser/application-photography.spec.ts', first_test_end, new_tests)

print('Unified application loading states, design rules, verification, and browser regressions updated.')
