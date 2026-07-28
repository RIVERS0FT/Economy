from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:160]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'src/styles/liquid-glass-surfaces.css',
    '''.liquid-glass-surface__effect {
  z-index: 0;
}
''',
    '''.liquid-glass-surface__effect {
  z-index: 0;
}

.liquid-glass-surface__effect[data-liquid-glass-measuring="true"] {
  transform: translate(-50%, -50%) scale(1) !important;
  transition: none !important;
}
''',
)

replace_once(
    'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
    '认证卡片必须使用 `src/components/auth/AuthCardSurface.tsx` 包装，并通过统一 `LiquidGlassSurface` 的 `desktopAuthCard`／`mobileAuthCard` 预设渲染。认证卡片任一时刻只能存在一个玻璃实例，`720px` 断点只允许在原位置切换预设，不得同时挂载桌面和移动卡片后用 CSS 隐藏。认证卡片继续使用 `layout="content"` 的自然内容高度，但真实登录／注册内容必须与状态栏相同，位于第三方 `.glass` 内的 `.liquid-glass-surface__content`，不得再作为玻璃效果外部的兄弟层。统一适配层使用单个 `ResizeObserver` 同时观察真实认证内容和认证宿主：内容变化先更新宿主高度，宿主真实宽高提交后才通过窗口 resize 通知上游玻璃更新几何；不得在 `setContentHeight` 同一时序提前通知，也不得通过 revision 或 React `key` 重建认证内容。登录、注册、邀请码、验证码、错误与状态提示变化以及 `720px` 断点切换都不得清空原生未受控表单值。',
    '认证卡片必须使用 `src/components/auth/AuthCardSurface.tsx` 包装，并通过统一 `LiquidGlassSurface` 的 `desktopAuthCard`／`mobileAuthCard` 预设渲染。认证卡片任一时刻只能存在一个玻璃实例，`720px` 断点只允许在原位置切换预设，不得同时挂载桌面和移动卡片后用 CSS 隐藏。认证卡片继续使用 `layout="content"` 的自然内容高度，但真实登录／注册内容必须与状态栏相同，位于第三方 `.glass` 内的 `.liquid-glass-surface__content`，不得再作为玻璃效果外部的兄弟层。统一适配层使用单个 `ResizeObserver` 同时观察真实认证内容和认证宿主：内容高度只能读取不受弹性 transform 影响的 `scrollHeight`／`offsetHeight`，内容变化先更新宿主高度，宿主真实宽高提交后才通过窗口 resize 通知上游玻璃更新几何；不得读取认证内容的 `getBoundingClientRect()` 作为高度权威，不得在 `setContentHeight` 同一时序提前通知，也不得通过 revision 或 React `key` 重建认证内容。登录、注册、邀请码、验证码、错误与状态提示变化以及 `720px` 断点切换都不得清空原生未受控表单值。',
)
replace_once(
    'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
    '认证卡片不得绘制项目 `::after` 结构描边或额外大圆角白色外框；`liquid-glass-react` Fragment 直属输出的两个边缘高光 `span` 必须可见并随内部 `mouseOffset` 更新渐变方向，成为认证卡片唯一亮边来源。`overLight=false` 对应的直属辅助黑色 `div` 继续隐藏，避免叠加无意义暗层。官方高光必须与宿主、效果层、`.glass` 和 SVG 滤镜保持同一宽高，登录→注册→登录和 `721px`／`720px` 双向切换都不得保留旧尺寸。该规则不移除输入框、按钮、登录／注册模式切换器的控件边框，也不移除键盘 `:focus-visible` 焦点反馈。',
    '认证卡片不得绘制项目 `::after` 结构描边或额外大圆角白色外框；`liquid-glass-react` Fragment 直属输出的两个边缘高光 `span` 必须可见并随内部 `mouseOffset` 更新渐变方向，成为认证卡片唯一亮边来源。`overLight=false` 对应的直属辅助黑色 `div` 继续隐藏，避免叠加无意义暗层。上游库在窗口 resize 时会读取已带弹性 transform 的效果层视觉矩形，因此统一适配层派发尺寸通知前必须在同一同步任务内给直属 `.liquid-glass-surface__effect` 设置 `data-liquid-glass-measuring="true"` 中性测量态，以 `translate(-50%, -50%) scale(1)` 暂时移除弹性变换，派发后立即清除；该状态不得跨帧或形成可见闪烁。官方高光必须与宿主、效果层、`.glass` 和 SVG 滤镜保持同一未变换布局宽高，登录→注册→登录和 `721px`／`720px` 双向切换都不得保留旧尺寸。该规则不移除输入框、按钮、登录／注册模式切换器的控件边框，也不移除键盘 `:focus-visible` 焦点反馈。',
)
replace_once(
    'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
    '`scripts/verify-auth-three-layer.mjs` 必须校验认证三层 DOM、共享背景组件、`AuthCardSurface`、认证玻璃官方默认光学参数、`mouseContainer` 运动、官方双层高光、内容位于 `.glass` 内、状态栏同源宿主染色、认证卡片无项目结构描边、内容自适应、移动氛围透明度、图片来源配置、认证层级样式、最终 CSS 加载顺序和浏览器回归入口；',
    '`scripts/verify-auth-three-layer.mjs` 必须校验认证三层 DOM、共享背景组件、`AuthCardSurface`、认证玻璃官方默认光学参数、`mouseContainer` 运动、官方双层高光、中性测量态、不受 transform 污染的内容高度、内容位于 `.glass` 内、状态栏同源宿主染色、认证卡片无项目结构描边、内容自适应、移动氛围透明度、图片来源配置、认证层级样式、最终 CSS 加载顺序和浏览器回归入口；',
)

replace_once(
    'docs/LIQUID_GLASS_CHROME_DESIGN.md',
    '认证卡片必须使用 `layout="content"`，但其业务内容位置与状态栏统一，实际位于第三方 `.glass` 内部的 `.liquid-glass-surface__content`。宿主由真实内容高度驱动，不得为注册表单设置固定高度或内部滚动区。统一适配层必须使用单个 `ResizeObserver` 同时观察认证内容与认证宿主，并可用同一内容节点上的 `MutationObserver` 捕获条件 DOM 变化；内容变化先更新宿主高度，宿主真实尺寸提交后再通过 `window` resize 通知上游玻璃重新读取几何。不得用 revision、React `key`、定时轮询或每帧测量重建认证内容，登录／注册切换、邀请码、验证码、错误和状态提示变化以及 `720px` 断点切换不得清空原生未受控表单值。官方两个边缘高光 `span` 必须随同一宿主同步宽高并保持可见，over-light 辅助 `div` 继续隐藏。',
    '认证卡片必须使用 `layout="content"`，但其业务内容位置与状态栏统一，实际位于第三方 `.glass` 内部的 `.liquid-glass-surface__content`。宿主由真实内容高度驱动，不得为注册表单设置固定高度或内部滚动区。统一适配层必须使用单个 `ResizeObserver` 同时观察认证内容与认证宿主，并可用同一内容节点上的 `MutationObserver` 捕获条件 DOM 变化；内容高度只读取 `scrollHeight`／`offsetHeight`，内容变化先更新宿主高度，宿主真实尺寸提交后再通过 `window` resize 通知上游玻璃重新读取几何。派发 resize 前必须在同一同步任务内把直属效果层置为 `data-liquid-glass-measuring="true"` 中性测量态，以 `translate(-50%, -50%) scale(1)` 暂时移除弹性 transform，派发后立即清除，避免上游把视觉变换后的 `getBoundingClientRect()` 写入 SVG 与高光尺寸。不得用 revision、React `key`、定时轮询或每帧测量重建认证内容，登录／注册切换、邀请码、验证码、错误和状态提示变化以及 `720px` 断点切换不得清空原生未受控表单值。官方两个边缘高光 `span` 必须随同一宿主同步宽高并保持可见，over-light 辅助 `div` 继续隐藏。',
)
replace_once(
    'docs/LIQUID_GLASS_CHROME_DESIGN.md',
    '17. Chromium 中把指针从认证卡片一侧移动到另一侧后，第三方 `.glass` 或直属高光的视觉 `transform` 必须发生变化；登录→注册→登录和 `721px`／`720px` 双向切换后，宿主、效果层、`.glass`、SVG 滤镜与高光的未变换布局尺寸（`clientHeight`／`offsetHeight`）仍保持同步，视觉包围盒允许随官方弹性变换而改变。',
    '17. Chromium 中把指针从认证卡片一侧移动到另一侧后，第三方 `.glass` 或直属高光的视觉 `transform` 必须发生变化；登录→注册→登录和 `721px`／`720px` 双向切换后，宿主、效果层、`.glass`、SVG 滤镜与高光的未变换布局尺寸（`clientHeight`／`offsetHeight`）仍保持同步，视觉包围盒允许随官方弹性变换而改变。人工尺寸通知期间必须短暂出现且同步清除 `data-liquid-glass-measuring="true"` 中性测量态，不得把变换后的视觉矩形持久化为玻璃尺寸。',
)

for script in ['scripts/verify-auth-three-layer.mjs', 'scripts/verify-liquid-glass-chrome.mjs']:
    replace_once(
        script,
        "  'setContentHeight(nextHeight)',\n  \"window.dispatchEvent(new Event('resize'))\",",
        "  'setContentHeight(nextHeight)',\n  'contentElement.offsetHeight',\n  'surfaceElement.clientWidth',\n  'surfaceElement.clientHeight',\n  \"':scope > .liquid-glass-surface__effect'\",\n  \"effectElement.setAttribute('data-liquid-glass-measuring', 'true')\",\n  \"effectElement.removeAttribute('data-liquid-glass-measuring')\",\n  'void effectElement.offsetHeight',\n  \"window.dispatchEvent(new Event('resize'))\",",
    )
    replace_once(
        script,
        "  'liquid-glass-surface__material-fill',",
        "  'liquid-glass-surface__material-fill',\n  'contentElement.getBoundingClientRect().height',",
    )
    replace_once(
        script,
        "  'height: auto !important;',",
        "  'height: auto !important;',\n  '.liquid-glass-surface__effect[data-liquid-glass-measuring=\\\"true\\\"] {',\n  'transform: translate(-50%, -50%) scale(1) !important;',\n  'transition: none !important;',",
    )

replace_once(
    'scripts/verify-auth-three-layer.mjs',
    "  '两个边缘高光 `span` 必须可见',",
    "  '两个边缘高光 `span` 必须可见',\n  '中性测量态',\n  '`scrollHeight`／`offsetHeight`',",
)
replace_once(
    'scripts/verify-liquid-glass-chrome.mjs',
    "    '认证卡片任一时刻只能存在一个',",
    "    '认证卡片任一时刻只能存在一个',\n    '中性测量态',\n    '`scrollHeight`／`offsetHeight`',",
)
