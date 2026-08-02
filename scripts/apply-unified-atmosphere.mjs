import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content, 'utf8');
}

function replaceExact(path, source, target, replacement, label) {
  const count = source.split(target).length - 1;
  if (count !== 1) {
    throw new Error(`${path}: ${label} expected once, found ${count}`);
  }
  return source.replace(target, replacement);
}

function insertBeforeFirstHeading(path, source, requiredPhrase, paragraph) {
  if (source.includes(requiredPhrase)) return source;
  const index = source.indexOf('\n## ');
  if (index < 0) throw new Error(`${path}: first section heading not found`);
  return `${source.slice(0, index)}\n\n${paragraph}\n${source.slice(index)}`;
}

const cssPath = 'src/styles/financial-backdrop.css';
let css = read(cssPath);

css = replaceExact(
  cssPath,
  css,
  `html[data-app-backdrop="auth"] .application-image-layer img {
  filter: saturate(0.72) contrast(1.08) brightness(0.72);
}

html[data-app-backdrop="game"] .application-image-layer img {
  filter: saturate(0.58) contrast(1.12) brightness(0.5);
}

html[data-app-backdrop="admin"] .application-image-layer img {
  filter: saturate(0.38) contrast(1.14) brightness(0.42);
}`,
  `html[data-app-backdrop="auth"] .application-image-layer img,
html[data-app-backdrop="game"] .application-image-layer img,
html[data-app-backdrop="admin"] .application-image-layer img {
  filter: saturate(0.72) contrast(1.08) brightness(0.72);
}`,
  'desktop image filters',
);

css = replaceExact(
  cssPath,
  css,
  `html[data-app-backdrop="auth"] .application-atmosphere-layer {
  background:
    radial-gradient(circle at 18% 20%, rgba(86, 224, 137, 0.16), transparent 30%),
    radial-gradient(circle at 84% 78%, rgba(44, 176, 102, 0.11), transparent 34%),
    linear-gradient(90deg, rgba(1, 7, 4, 0.94) 0%, rgba(2, 10, 6, 0.82) 38%, rgba(3, 12, 8, 0.69) 67%, rgba(2, 9, 6, 0.82) 100%);
}

html[data-app-backdrop="game"] .application-atmosphere-layer {
  background:
    radial-gradient(circle at 70% 16%, rgba(67, 202, 119, 0.13), transparent 34%),
    radial-gradient(circle at 18% 76%, rgba(31, 135, 77, 0.1), transparent 38%),
    linear-gradient(90deg, rgba(1, 7, 4, 0.96) 0%, rgba(2, 9, 6, 0.88) 27%, rgba(3, 11, 7, 0.8) 60%, rgba(2, 8, 5, 0.9) 100%),
    linear-gradient(180deg, rgba(2, 8, 5, 0.68), rgba(1, 6, 4, 0.88));
}

html[data-app-backdrop="admin"] .application-atmosphere-layer {
  background:
    radial-gradient(circle at 76% 14%, rgba(76, 150, 132, 0.1), transparent 32%),
    radial-gradient(circle at 16% 82%, rgba(39, 93, 78, 0.09), transparent 40%),
    linear-gradient(90deg, rgba(2, 7, 7, 0.97) 0%, rgba(3, 10, 10, 0.93) 32%, rgba(4, 12, 11, 0.88) 68%, rgba(2, 8, 8, 0.95) 100%),
    linear-gradient(180deg, rgba(2, 8, 7, 0.78), rgba(1, 6, 6, 0.92));
}`,
  `html[data-app-backdrop="auth"] .application-atmosphere-layer,
html[data-app-backdrop="game"] .application-atmosphere-layer,
html[data-app-backdrop="admin"] .application-atmosphere-layer {
  background:
    radial-gradient(circle at 18% 20%, rgba(86, 224, 137, 0.16), transparent 30%),
    radial-gradient(circle at 84% 78%, rgba(44, 176, 102, 0.11), transparent 34%),
    linear-gradient(90deg, rgba(1, 7, 4, 0.94) 0%, rgba(2, 10, 6, 0.82) 38%, rgba(3, 12, 8, 0.69) 67%, rgba(2, 9, 6, 0.82) 100%);
}`,
  'desktop atmosphere backgrounds',
);

css = replaceExact(
  cssPath,
  css,
  `html[data-app-backdrop="auth"] .application-atmosphere-layer::before {
  opacity: 0.24;
  background-image:
    linear-gradient(rgba(210, 244, 222, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(210, 244, 222, 0.07) 1px, transparent 1px);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.78), transparent 92%);
}

html[data-app-backdrop="game"] .application-atmosphere-layer::before {
  opacity: 0.2;
}

html[data-app-backdrop="admin"] .application-atmosphere-layer::before {
  opacity: 0.12;
}`,
  `html[data-app-backdrop="auth"] .application-atmosphere-layer::before,
html[data-app-backdrop="game"] .application-atmosphere-layer::before,
html[data-app-backdrop="admin"] .application-atmosphere-layer::before {
  opacity: 0.24;
  background-image:
    linear-gradient(rgba(210, 244, 222, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(210, 244, 222, 0.07) 1px, transparent 1px);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.78), transparent 92%);
}`,
  'desktop grid treatments',
);

css = replaceExact(
  cssPath,
  css,
  `html[data-app-backdrop="auth"] .application-atmosphere-layer::after {
  opacity: 0.075;
}

html[data-app-backdrop="game"] .application-atmosphere-layer::after {
  opacity: 0.065;
}

html[data-app-backdrop="admin"] .application-atmosphere-layer::after {
  opacity: 0.045;
}`,
  `html[data-app-backdrop="auth"] .application-atmosphere-layer::after,
html[data-app-backdrop="game"] .application-atmosphere-layer::after,
html[data-app-backdrop="admin"] .application-atmosphere-layer::after {
  opacity: 0.075;
}`,
  'desktop noise treatments',
);

css = replaceExact(
  cssPath,
  css,
  `  html[data-app-backdrop="auth"] .application-image-layer img {
    filter: saturate(0.68) contrast(1.08) brightness(0.62);
  }

  html[data-app-backdrop="game"] .application-image-layer img {
    filter: saturate(0.54) contrast(1.12) brightness(0.43);
  }

  html[data-app-backdrop="admin"] .application-image-layer img {
    filter: saturate(0.34) contrast(1.14) brightness(0.36);
  }`,
  `  html[data-app-backdrop="auth"] .application-image-layer img,
  html[data-app-backdrop="game"] .application-image-layer img,
  html[data-app-backdrop="admin"] .application-image-layer img {
    filter: saturate(0.68) contrast(1.08) brightness(0.62);
  }`,
  'mobile image filters',
);

css = replaceExact(
  cssPath,
  css,
  `  html[data-app-backdrop="auth"] .application-atmosphere-layer {
    background:
      radial-gradient(circle at 20% 14%, rgba(86, 224, 137, 0.15), transparent 30%),
      linear-gradient(180deg, rgba(1, 7, 4, 0.62) 0%, rgba(2, 10, 6, 0.6) 36%, rgba(2, 8, 5, 0.82) 100%);
  }

  html[data-app-backdrop="game"] .application-atmosphere-layer {
    background:
      radial-gradient(circle at 50% 12%, rgba(67, 202, 119, 0.11), transparent 32%),
      linear-gradient(180deg, rgba(1, 7, 4, 0.86) 0%, rgba(2, 9, 6, 0.84) 36%, rgba(1, 6, 4, 0.94) 100%);
  }

  html[data-app-backdrop="admin"] .application-atmosphere-layer {
    background:
      radial-gradient(circle at 50% 10%, rgba(76, 150, 132, 0.08), transparent 30%),
      linear-gradient(180deg, rgba(2, 7, 7, 0.91) 0%, rgba(3, 10, 10, 0.9) 38%, rgba(1, 6, 6, 0.97) 100%);
  }`,
  `  html[data-app-backdrop="auth"] .application-atmosphere-layer,
  html[data-app-backdrop="game"] .application-atmosphere-layer,
  html[data-app-backdrop="admin"] .application-atmosphere-layer {
    background:
      radial-gradient(circle at 20% 14%, rgba(86, 224, 137, 0.15), transparent 30%),
      linear-gradient(180deg, rgba(1, 7, 4, 0.62) 0%, rgba(2, 10, 6, 0.6) 36%, rgba(2, 8, 5, 0.82) 100%);
  }`,
  'mobile atmosphere backgrounds',
);

css = replaceExact(
  cssPath,
  css,
  `  html[data-app-backdrop="auth"] .application-atmosphere-layer::before {
    opacity: 0.12;
    background-size: 42px 42px;
  }

  html[data-app-backdrop="auth"] .application-atmosphere-layer::after {
    opacity: 0.05;
  }

  html[data-app-backdrop="game"] .application-atmosphere-layer::before {
    opacity: 0.16;
    background-size: 42px 42px;
  }

  html[data-app-backdrop="admin"] .application-atmosphere-layer::before {
    opacity: 0.09;
    background-size: 42px 42px;
  }`,
  `  html[data-app-backdrop="auth"] .application-atmosphere-layer::before,
  html[data-app-backdrop="game"] .application-atmosphere-layer::before,
  html[data-app-backdrop="admin"] .application-atmosphere-layer::before {
    opacity: 0.12;
    background-size: 42px 42px;
  }

  html[data-app-backdrop="auth"] .application-atmosphere-layer::after,
  html[data-app-backdrop="game"] .application-atmosphere-layer::after,
  html[data-app-backdrop="admin"] .application-atmosphere-layer::after {
    opacity: 0.05;
  }`,
  'mobile grid and noise treatments',
);

write(cssPath, css);

const registrationPath = 'docs/REGISTRATION_INVITE_FLOW_DESIGN.md';
let registration = read(registrationPath);
registration = registration.replaceAll(
  '认证／玩家／管理员氛围变体',
  '认证／玩家／管理员语义变体共享唯一氛围基线',
);
registration = insertBeforeFirstHeading(
  registrationPath,
  registration,
  '认证、注册、九个玩家页面、管理员后台以及根级加载／异常状态',
  '全应用氛围基线：认证、注册、九个玩家页面、管理员后台以及根级加载／异常状态继续保留 `auth`、`game`、`admin` 语义变体，但三者必须共享登录／注册页当前的摄影滤镜、渐变遮罩、网格和噪点参数；页面或角色不得再覆盖这些参数。仅 `data-app-tone="critical"` 允许叠加红色内暗角，且不得改变共享基线。',
);
write(registrationPath, registration);

const chromePath = 'docs/LIQUID_GLASS_CHROME_DESIGN.md';
let chrome = read(chromePath);
chrome = chrome.replaceAll(
  '认证／玩家／管理员氛围变体',
  '认证／玩家／管理员语义变体共享唯一氛围基线',
);
chrome = insertBeforeFirstHeading(
  chromePath,
  chrome,
  '登录、玩家与管理员必须使用完全相同的摄影滤镜',
  '全应用摄影氛围只允许一套正常态视觉参数：登录、玩家与管理员必须使用完全相同的摄影滤镜、渐变遮罩、网格与噪点，并以登录／注册页参数为基线。`data-app-backdrop` 只保留语义和状态路由职责，不得触发角色级或页面级视觉覆盖；`critical` 只允许在共享氛围之上增加红色内暗角。',
);
write(chromePath, chrome);

const verificationPath = 'scripts/verify-game-three-layer.mjs';
let verification = read(verificationPath);
const verificationMarker = '\nif (failures.length > 0) {';
const verificationIndex = verification.lastIndexOf(verificationMarker);
if (verificationIndex < 0) throw new Error(`${verificationPath}: failure marker not found`);
const verificationBlock = `

const unifiedAtmosphereCss = read('src/styles/financial-backdrop.css');
for (const text of [
  'html[data-app-backdrop="auth"] .application-image-layer img,\nhtml[data-app-backdrop="game"] .application-image-layer img,\nhtml[data-app-backdrop="admin"] .application-image-layer img {',
  'html[data-app-backdrop="auth"] .application-atmosphere-layer,\nhtml[data-app-backdrop="game"] .application-atmosphere-layer,\nhtml[data-app-backdrop="admin"] .application-atmosphere-layer {',
  'html[data-app-backdrop="auth"] .application-atmosphere-layer::before,\nhtml[data-app-backdrop="game"] .application-atmosphere-layer::before,\nhtml[data-app-backdrop="admin"] .application-atmosphere-layer::before {',
  'html[data-app-backdrop="auth"] .application-atmosphere-layer::after,\nhtml[data-app-backdrop="game"] .application-atmosphere-layer::after,\nhtml[data-app-backdrop="admin"] .application-atmosphere-layer::after {',
  'filter: saturate(0.72) contrast(1.08) brightness(0.72);',
  'filter: saturate(0.68) contrast(1.08) brightness(0.62);',
]) requireText('src/styles/financial-backdrop.css', text);
for (const text of [
  'brightness(0.5)',
  'brightness(0.42)',
  'brightness(0.43)',
  'brightness(0.36)',
  'opacity: 0.065;',
  'opacity: 0.045;',
  'opacity: 0.16;',
  'opacity: 0.09;',
]) forbidText('src/styles/financial-backdrop.css', text);
if ((unifiedAtmosphereCss.match(/filter: saturate\(0\.72\) contrast\(1\.08\) brightness\(0\.72\);/g) ?? []).length !== 1) {
  failures.push('桌面认证、玩家与管理员必须且只能共享一套登录页摄影滤镜');
}
if ((unifiedAtmosphereCss.match(/filter: saturate\(0\.68\) contrast\(1\.08\) brightness\(0\.62\);/g) ?? []).length !== 1) {
  failures.push('移动认证、玩家与管理员必须且只能共享一套登录页摄影滤镜');
}
for (const text of [
  '认证、注册、九个玩家页面、管理员后台以及根级加载／异常状态',
  '页面或角色不得再覆盖这些参数',
]) requireText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', text);
for (const text of [
  '登录、玩家与管理员必须使用完全相同的摄影滤镜',
  '\`data-app-backdrop\` 只保留语义和状态路由职责',
]) requireText('docs/LIQUID_GLASS_CHROME_DESIGN.md', text);
requireFile('tests/browser/application-atmosphere-consistency.spec.ts');
for (const text of [
  'auth, game and admin share the desktop atmosphere baseline',
  'auth, game and admin share the mobile atmosphere baseline',
]) requireText('tests/browser/application-atmosphere-consistency.spec.ts', text);
`;
if (!verification.includes('const unifiedAtmosphereCss =')) {
  verification = `${verification.slice(0, verificationIndex)}${verificationBlock}${verification.slice(verificationIndex)}`;
}
write(verificationPath, verification);

const browserPath = 'tests/browser/application-atmosphere-consistency.spec.ts';
write(
  browserPath,
  `import { expect, test, type Page } from '@playwright/test';

type BackdropVariant = 'auth' | 'game' | 'admin';

type AtmosphereSnapshot = {
  imageFilter: string;
  atmosphereBackground: string;
  gridOpacity: string;
  gridBackground: string;
  gridMask: string;
  noiseOpacity: string;
  noiseBackground: string;
  noiseBlendMode: string;
};

async function atmosphereSnapshot(page: Page, variant: BackdropVariant): Promise<AtmosphereSnapshot> {
  await page.evaluate((nextVariant) => {
    document.documentElement.dataset.appBackdrop = nextVariant;
    document.documentElement.dataset.appTone = 'normal';
  }, variant);

  return page.evaluate(() => {
    const image = document.querySelector<HTMLImageElement>('.application-image-layer img');
    const atmosphere = document.querySelector<HTMLElement>('.application-atmosphere-layer');
    if (!image || !atmosphere) throw new Error('persistent application atmosphere is missing');
    const atmosphereStyle = getComputedStyle(atmosphere);
    const gridStyle = getComputedStyle(atmosphere, '::before');
    const noiseStyle = getComputedStyle(atmosphere, '::after');
    return {
      imageFilter: getComputedStyle(image).filter,
      atmosphereBackground: atmosphereStyle.backgroundImage,
      gridOpacity: gridStyle.opacity,
      gridBackground: gridStyle.backgroundImage,
      gridMask: gridStyle.maskImage,
      noiseOpacity: noiseStyle.opacity,
      noiseBackground: noiseStyle.backgroundImage,
      noiseBlendMode: noiseStyle.mixBlendMode,
    };
  });
}

async function expectUnifiedAtmosphere(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto('runtime-test.html');
  await expect(page.locator('.application-image-layer')).toHaveCount(1);
  await expect(page.locator('.application-atmosphere-layer')).toHaveCount(1);

  const auth = await atmosphereSnapshot(page, 'auth');
  const game = await atmosphereSnapshot(page, 'game');
  const admin = await atmosphereSnapshot(page, 'admin');

  expect(game).toEqual(auth);
  expect(admin).toEqual(auth);
}

test('auth, game and admin share the desktop atmosphere baseline', async ({ page }) => {
  await expectUnifiedAtmosphere(page, { width: 1440, height: 900 });
});

test('auth, game and admin share the mobile atmosphere baseline', async ({ page }) => {
  await expectUnifiedAtmosphere(page, { width: 390, height: 844 });
});
`,
);

console.log('Unified application atmosphere changes applied.');
