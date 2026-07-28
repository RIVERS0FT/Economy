from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:180]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
    '统一适配层使用单个 `ResizeObserver` 同时观察真实认证内容和认证宿主：内容变化先更新宿主高度，宿主真实宽高提交后才通过窗口 resize 通知上游玻璃更新几何；不得在 `setContentHeight` 同一时序提前通知，也不得通过 revision 或 React `key` 重建认证内容。',
    '统一适配层使用单个 `ResizeObserver` 同时观察真实认证内容和认证宿主：内容高度只能读取不受弹性 transform 影响的 `scrollHeight`／`offsetHeight`，内容变化先更新宿主高度，宿主真实宽高提交后才通过窗口 resize 通知上游玻璃更新几何；不得读取认证内容的 `getBoundingClientRect()` 作为高度权威，不得在 `setContentHeight` 同一时序提前通知，也不得通过 revision 或 React `key` 重建认证内容。',
)
replace_once(
    'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
    '官方高光必须与宿主、效果层、`.glass` 和 SVG 滤镜保持同一宽高，登录→注册→登录和 `721px`／`720px` 双向切换都不得保留旧尺寸。',
    '上游库在窗口 resize 时会读取带弹性 transform 的效果层视觉矩形，因此统一适配层派发尺寸通知前必须在同一同步任务内给直属 `.liquid-glass-surface__effect` 设置 `data-liquid-glass-measuring="true"` 中性测量态，以 `translate(-50%, -50%) scale(1)` 暂时移除弹性变换，派发后立即清除；该状态不得跨帧或形成可见闪烁。官方高光必须与宿主、效果层、`.glass` 和 SVG 滤镜保持同一未变换布局宽高，登录→注册→登录和 `721px`／`720px` 双向切换都不得保留旧尺寸。',
)
replace_once(
    'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
    '认证玻璃官方默认光学参数、`mouseContainer` 运动、官方双层高光、内容位于 `.glass` 内',
    '认证玻璃官方默认光学参数、`mouseContainer` 运动、官方双层高光、中性测量态、不受 transform 污染的内容高度、内容位于 `.glass` 内',
)

replace_once(
    'docs/LIQUID_GLASS_CHROME_DESIGN.md',
    '内容变化先更新宿主高度，宿主真实尺寸提交后再通过 `window` resize 通知上游玻璃重新读取几何。',
    '内容高度只读取 `scrollHeight`／`offsetHeight`，内容变化先更新宿主高度，宿主真实尺寸提交后再通过 `window` resize 通知上游玻璃重新读取几何。派发 resize 前必须在同一同步任务内把直属效果层置为 `data-liquid-glass-measuring="true"` 中性测量态，以 `translate(-50%, -50%) scale(1)` 暂时移除弹性 transform，派发后立即清除，避免上游把视觉变换后的 `getBoundingClientRect()` 写入 SVG 与高光尺寸。',
)
replace_once(
    'docs/LIQUID_GLASS_CHROME_DESIGN.md',
    '视觉包围盒允许随官方弹性变换而改变。',
    '视觉包围盒允许随官方弹性变换而改变。人工尺寸通知期间必须短暂出现且同步清除 `data-liquid-glass-measuring="true"` 中性测量态，不得把变换后的视觉矩形持久化为玻璃尺寸。',
)


def update_guard(path: str, indent: str) -> None:
    replace_once(
        path,
        f"{indent}'setContentHeight(nextHeight)',\n{indent}\"window.dispatchEvent(new Event('resize'))\",",
        f"{indent}'setContentHeight(nextHeight)',\n{indent}'contentElement.offsetHeight',\n{indent}'surfaceElement.clientWidth',\n{indent}'surfaceElement.clientHeight',\n{indent}\"':scope > .liquid-glass-surface__effect'\",\n{indent}\"effectElement.setAttribute('data-liquid-glass-measuring', 'true')\",\n{indent}\"effectElement.removeAttribute('data-liquid-glass-measuring')\",\n{indent}'void effectElement.offsetHeight',\n{indent}\"window.dispatchEvent(new Event('resize'))\",",
    )
    replace_once(
        path,
        f"{indent}'liquid-glass-surface__material-fill',",
        f"{indent}'liquid-glass-surface__material-fill',\n{indent}'contentElement.getBoundingClientRect().height',",
    )
    replace_once(
        path,
        f"{indent}'height: auto !important;',",
        f"{indent}'height: auto !important;',\n{indent}'.liquid-glass-surface__effect[data-liquid-glass-measuring=\\\"true\\\"] {{',\n{indent}'transform: translate(-50%, -50%) scale(1) !important;',\n{indent}'transition: none !important;',",
    )


update_guard('scripts/verify-auth-three-layer.mjs', '  ')
update_guard('scripts/verify-liquid-glass-chrome.mjs', '    ')
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
