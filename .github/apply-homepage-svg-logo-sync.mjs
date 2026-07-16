import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, search, replacement) {
  const source = readFileSync(path, 'utf8');
  if (source.includes(replacement)) return false;
  if (!source.includes(search)) throw new Error(`${path} missing expected text: ${search}`);
  writeFileSync(path, source.replace(search, replacement));
  return true;
}

replaceOnce(
  'src/config/brand.ts',
  "export const BRAND_LOGO_URL = 'https://riversoft.top/1000002880.png';",
  "export const BRAND_LOGO_URL = 'https://riversoft.top/logo.svg';",
);

replaceOnce(
  'index.html',
  '    <link rel="icon" type="image/png" href="https://riversoft.top/1000002880.png" />',
  '    <link rel="icon" type="image/svg+xml" href="https://riversoft.top/logo.svg" />',
);

replaceOnce(
  'docs/UI_DESIGN_SYSTEM.md',
  '服务器未来返回未知商品 ID 时必须使用统一包装箱 SVG 回退，页面仍按服务器数组动态渲染，不得隐藏商品。市场商品标签、概览商品行情、仓库商品卡、商品订单和商品资产变动必须使用相同的 `ProductIcon`／`ProductIconLabel`。\n\n## 6. 设计令牌、按钮与表单',
  '服务器未来返回未知商品 ID 时必须使用统一包装箱 SVG 回退，页面仍按服务器数组动态渲染，不得隐藏商品。市场商品标签、概览商品行情、仓库商品卡、商品订单和商品资产变动必须使用相同的 `ProductIcon`／`ProductIconLabel`。\n\n### 5.2 主页品牌 Logo\n\n- `https://riversoft.top/logo.svg` 是 Economy 登录页与桌面侧栏显示品牌 Logo 的唯一权威资源，统一通过 `src/config/brand.ts` 的 `BRAND_LOGO_URL` 引用；不得恢复直接引用兼容 PNG、复制本地 Logo 或创建平行品牌图标。\n- 页面 favicon 使用同一 SVG，并声明 `image/svg+xml`。\n- Apple Touch Icon、Open Graph 和 Twitter 图片继续使用主页同步生成的 `https://riversoft.top/1000002880.png`，用于不稳定支持 SVG 的平台；兼容 PNG 不得替代页面内可见 Logo。\n- Logo 保持正方形比例并沿用当前圆形裁剪展示，不得拉伸、改色、叠加滤镜或在 Economy 内重新绘制。\n\n## 6. 设计令牌、按钮与表单',
);

replaceOnce(
  'scripts/verify-page-content.mjs',
  "  'src/app/LoginPage.tsx',\n  'src/styles/auth.css',",
  "  'src/app/LoginPage.tsx',\n  'src/config/brand.ts',\n  'index.html',\n  'src/styles/auth.css',",
);

replaceOnce(
  'scripts/verify-page-content.mjs',
  "for (const text of [\n  'min-height: calc(100dvh - var(--space-8));',",
  "for (const text of [\n  \"export const BRAND_LOGO_URL = 'https://riversoft.top/logo.svg';\",\n]) requireText('src/config/brand.ts', text);\nfor (const text of [\n  '1000002880.png',\n  '/brand-icon.svg',\n]) forbidText('src/config/brand.ts', text);\nfor (const text of [\n  '<link rel=\"icon\" type=\"image/svg+xml\" href=\"https://riversoft.top/logo.svg\" />',\n  '<link rel=\"apple-touch-icon\" href=\"https://riversoft.top/1000002880.png\" />',\n  '<meta property=\"og:image\" content=\"https://riversoft.top/1000002880.png\" />',\n  '<meta name=\"twitter:image\" content=\"https://riversoft.top/1000002880.png\" />',\n]) requireText('index.html', text);\nfor (const text of [\n  '<link rel=\"icon\" type=\"image/png\" href=\"https://riversoft.top/1000002880.png\" />',\n  'href=\"/brand-icon.svg\"',\n]) forbidText('index.html', text);\n\nfor (const text of [\n  'min-height: calc(100dvh - var(--space-8));',",
);

replaceOnce(
  'scripts/verify-page-content.mjs',
  "  '不得把账号或密码重新绑定到初始为空的 React `value` 状态',\n  '使用 `.login-shell:focus-within` 或其他焦点选择器改变移动登录页标题字号、区块间距或整体对齐',",
  "  '不得把账号或密码重新绑定到初始为空的 React `value` 状态',\n  '`https://riversoft.top/logo.svg` 是 Economy 登录页与桌面侧栏显示品牌 Logo 的唯一权威资源',\n  '页面 favicon 使用同一 SVG，并声明 `image/svg+xml`',\n  'Apple Touch Icon、Open Graph 和 Twitter 图片继续使用主页同步生成的 `https://riversoft.top/1000002880.png`',\n  '兼容 PNG 不得替代页面内可见 Logo',\n  '使用 `.login-shell:focus-within` 或其他焦点选择器改变移动登录页标题字号、区块间距或整体对齐',",
);

replaceOnce(
  'scripts/verify-page-content.mjs',
  "console.log('页面内容、八页导航、登录注册、高增长记录窗口化、邀请、藏品拍卖、全局紧凑数字、生产公式和仓库职责验证通过。');",
  "console.log('页面内容、八页导航、主页 SVG Logo、登录注册、高增长记录窗口化、邀请、藏品拍卖、全局紧凑数字、生产公式和仓库职责验证通过。');",
);
