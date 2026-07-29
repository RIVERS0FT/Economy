from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing replacement target: {label}')
    return text.replace(old, new, 1)


liquid_design_path = 'docs/LIQUID_GLASS_CHROME_DESIGN.md'
liquid_design = read(liquid_design_path)
anchor = '全部五种 variant 必须启用 dark tint：`:root` 定义 `--liquid-glass-tint-dark: rgba(3, 12, 8, 0.42)`，`--liquid-glass-contrast` 只能指向该变量，所有 `.liquid-glass-surface` 宿主统一使用该半透明深色染色。`liquid-glass-react@1.1.1` 没有 tint 或 color-scheme prop，因此不得伪造第三方参数或引入第二套玻璃组件；dark tint 只能由统一宿主染色实现。每个宿主必须暴露 `data-liquid-glass-tint="dark"` 供浏览器回归验证。'
addition = anchor + '''

所有四个参数预设都必须固定 `elasticity: 0`，并继续使用 `mouseContainer={null}`、固定 `globalMousePos` 与固定 `mouseOffset`。桌面状态栏、管理员工作栏、移动状态栏、移动底栏和认证卡片均不得开启鼠标、触控板、触笔或触摸跟踪；指针移动不得改变效果层 transform 或高光方向。

认证卡片继续使用 `layout="content"`。真实认证内容与状态栏内容使用相同的 `.glass` 内部位置，内容高度只允许读取 `scrollHeight`／`offsetHeight`；React 内容变化在 `useLayoutEffect` 中于首次绘制前同步提交，单个 `ResizeObserver` 与条件 `MutationObserver` 仅负责字体、异步提示和宽度变化等补充测量。认证卡片任一时刻只能存在一个玻璃实例，不得通过 React `key` 或 revision 重建内容。

可见高光几何直接绑定认证宿主：官方两个直属高光 `span`、认证效果层与 `.glass` 必须使用宿主 `100%` 宽高并取消尺寸过渡。登录→注册→登录时，宿主、`.glass` 与两个高光的底部必须在首个绘制帧内同步；上游 resize 通知只负责随后补齐 SVG 滤镜内部坐标。'''
liquid_design = replace_required(liquid_design, anchor, addition, 'liquid glass design contract anchor')
write(liquid_design_path, liquid_design)

auth_design_path = 'docs/REGISTRATION_INVITE_FLOW_DESIGN.md'
auth_design = read(auth_design_path)
auth_anchor = '认证卡片与桌面／移动状态栏统一在 `.liquid-glass-surface` 宿主启用 dark tint `--liquid-glass-tint-dark: rgba(3, 12, 8, 0.42)`，并由 `--liquid-glass-contrast` 单向引用；'
auth_replacement = '认证卡片、桌面／移动状态栏、管理员工作栏和移动底栏统一使用 `--liquid-glass-contrast`；该变量必须单向引用 dark tint `--liquid-glass-tint-dark: rgba(3, 12, 8, 0.42)`；'
auth_design = replace_required(auth_design, auth_anchor, auth_replacement, 'auth tint authority sentence')
write(auth_design_path, auth_design)

verifier_path = 'scripts/verify-auth-three-layer.mjs'
verifier = read(verifier_path)
verifier = replace_required(
    verifier,
    "  'toMatch(/saturate\\\\((?:140%|1\\\\.4)\\\\)/)',",
    "  'toMatch(/saturate\\\\((?:120%|1\\\\.2)\\\\)/)',",
    'auth saturation verifier',
)
write(verifier_path, verifier)
