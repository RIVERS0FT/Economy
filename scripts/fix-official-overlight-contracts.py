from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing replacement target: {label}')
    return text.replace(old, new, 1)


# Keep the new official semantics while preserving the durable measurement and geometry rules.
liquid_path = 'docs/LIQUID_GLASS_CHROME_DESIGN.md'
liquid = read(liquid_path)
anchor = '认证卡片继续使用 `layout="content"`。官方两个高光 `span`、两个 over-light 辅助 `div`、认证效果层与 `.glass` 的可见几何都必须直接绑定认证宿主 `100%` 尺寸并取消几何过渡；登录→注册→登录时，它们的底部必须在首个绘制帧内同步。上游 resize 通知只负责随后补齐 SVG 滤镜内部坐标。'
replacement = '''认证卡片继续使用 `layout="content"`。认证内容高度只允许读取 `scrollHeight`／`offsetHeight`，React 内容变化仍在 `useLayoutEffect` 中于首次绘制前同步提交，单个 `ResizeObserver` 与条件 `MutationObserver` 仅负责补充测量。

可见高光几何直接绑定认证宿主：官方两个高光 `span`、两个 over-light 辅助 `div`、认证效果层与 `.glass` 都必须使用认证宿主 `100%` 尺寸并取消几何过渡；登录→注册→登录时，它们的底部必须在首个绘制帧内同步。上游 resize 通知只负责随后补齐 SVG 滤镜内部坐标。'''
liquid = replace_required(liquid, anchor, replacement, 'liquid measurement and geometry rules')
write(liquid_path, liquid)

auth_path = 'docs/REGISTRATION_INVITE_FLOW_DESIGN.md'
auth = read(auth_path)
anchor = '认证卡片继续使用全局官方参数：`displacementScale=120`、`blurAmount=0`、`saturation=120`、`aberrationIntensity=2`、`mode="standard"`、`overLight=true`、`elasticity=0`。`overLight=true` 即 “Tint liquid glass dark”；官方实现会计算出 `blur(12px) saturate(120%)`，并把首个位移 scale 降为 `60`。'
replacement = anchor + ' 这套配置是全局光学基线，状态栏、管理员工作栏、移动底栏和认证卡片不得再分叉。'
auth = replace_required(auth, anchor, replacement, 'auth global optical baseline')
anchor = '认证卡片、桌面／移动状态栏、管理员工作栏和移动底栏统一启用官方 `overLight=true`，两个直属黑色辅助层必须可见；`--liquid-glass-contrast: rgba(194, 231, 214, 0.06)` 只作为低密度支持染色，不得再创建 `--liquid-glass-tint-dark`；'
replacement = '认证卡片、桌面／移动状态栏、管理员工作栏和移动底栏统一启用官方 `overLight=true`，两个直属黑色辅助层必须可见；所有表面继续统一使用 `--liquid-glass-contrast`，其值固定为 `rgba(194, 231, 214, 0.06)`，该变量只作为低密度支持染色，不得再创建 `--liquid-glass-tint-dark`；'
auth = replace_required(auth, anchor, replacement, 'auth support tint authority')
anchor = '两个边缘高光 `span` 与 `overLight=true` 产生的两个黑色辅助 `div` 必须直接使用宿主的 `100%` 宽高、`inset: 0` 与未变换坐标，认证效果层和 `.glass` 的可见几何同样必须直接填满宿主；不得保留第三方尺寸过渡，'
replacement = '两个边缘高光 `span` 必须直接使用宿主的 `100%` 宽高、`inset: 0` 与未变换坐标；`overLight=true` 产生的两个黑色辅助 `div` 也必须采用同一宿主几何，认证效果层和 `.glass` 的可见几何同样必须直接填满宿主；不得保留第三方尺寸过渡，'
auth = replace_required(auth, anchor, replacement, 'auth highlight and over-light geometry')
write(auth_path, auth)

# Update stale verifier selectors and the desktop design expectations.
for path in ['scripts/verify-auth-three-layer.mjs', 'scripts/verify-liquid-glass-chrome.mjs']:
    text = read(path)
    text = text.replace(
        '.liquid-glass-surface--desktopAuthCard > div:not(.liquid-glass-surface__effect),',
        '.login-card > .liquid-glass-surface--desktopAuthCard[data-liquid-glass-over-light="true"] > div:not(.liquid-glass-surface__effect),',
    )
    write(path, text)

desktop_path = 'scripts/verify-desktop-primary-surfaces.mjs'
desktop = read(desktop_path)
desktop = desktop.replace('`--liquid-glass-tint-dark: rgba(3, 12, 8, 0.42)`', '`overLight=true`')
desktop = desktop.replace(
    '桌面与移动状态栏必须隐藏 `liquid-glass-react` 的直属边框／高光和 over-light 辅助层',
    '桌面与移动状态栏必须隐藏 `liquid-glass-react` 的直属边框／高光，但所有五种 variant 必须保留并显示 `overLight=true` 产生的两个官方黑色辅助层',
)
write(desktop_path, desktop)
