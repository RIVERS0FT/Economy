from pathlib import Path

path = Path('docs/LIQUID_GLASS_CHROME_DESIGN.md')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one match, found {count}: {old[:120]!r}')
    text = text.replace(old, new, 1)


replace_once(
    '本文件定义应用唯一液态玻璃实现、认证卡片、玩家游戏三层背景与背景采样、游戏端和管理员端登录后桌面应用外壳几何、移动工作区 Overlay、移动导航结构、浏览器运行时样式入口、性能约束和防回退规则。认证三层背景的资源语义与登录布局继续以 `REGISTRATION_INVITE_FLOW_DESIGN.md` 为准；通用 UI、覆盖式滚动条和市场表格仍以 `docs/UI_DESIGN_SYSTEM.md` 为准。',
    '本文件定义应用唯一液态玻璃实现、认证卡片、玩家游戏三层背景与背景采样、游戏端和管理员端登录后桌面应用外壳几何、移动工作区 Overlay、移动导航结构、浏览器运行时样式入口、性能约束和防回退规则。认证三层背景、认证卡片光学与运动参数、边缘高光和登录布局以 `REGISTRATION_INVITE_FLOW_DESIGN.md` 为认证专项权威；通用 UI、覆盖式滚动条和市场表格仍以 `docs/UI_DESIGN_SYSTEM.md` 为准。',
)
replace_once(
    '- 桌面与移动状态栏及认证卡片必须隐藏 `liquid-glass-react` 的重复边框／高光和 over-light 辅助层，并清除第三方 `.glass` 外部阴影，只保留 `.glass__warp` 材质。状态栏只保留宿主的一条最上层连续结构描边；认证卡片不得绘制项目结构描边或额外大圆角白色外框，只保留第三方折射边缘、圆角裁切和宿主阴影。移动底栏允许保留第一层低强度 screen 高光。',
    '- 桌面与移动状态栏必须隐藏 `liquid-glass-react` 的直属边框／高光和 over-light 辅助层；认证卡片必须保留官方两个直属边缘高光 `span`，只隐藏 over-light 辅助 `div`，并清除第三方 `.glass` 外部阴影。状态栏只保留宿主的一条最上层连续结构描边；认证卡片不得绘制项目结构描边或额外 `::after` 白色外框，由官方双层高光、折射边缘、圆角裁切和宿主阴影共同表达材质。移动底栏允许保留第一层低强度 screen 高光。',
)
replace_once(
    '| `LiquidGlassSurface.tsx` | 第三方库适配、五种平台预设、固定／内容自适应布局、认证内容内部定位与尺寸同步、静态鼠标输入和统一 DOM |',
    '| `LiquidGlassSurface.tsx` | 第三方库适配、五种平台预设、固定／内容自适应布局、认证内容内部定位与尺寸同步、状态栏静态输入、认证 `mouseContainer` 运动和统一 DOM |',
)
replace_once(
    '| `liquid-glass-surfaces.css` | 所有玻璃宿主、第三方 DOM 尺寸、内容自适应层、开放背景采样链、平台圆角、统一宿主染色、认证回退、状态栏单层结构描边、认证卡片无项目结构描边、装饰层显隐和移动底栏唯一垂直留白 |',
    '| `liquid-glass-surfaces.css` | 所有玻璃宿主、第三方 DOM 尺寸、内容自适应层、开放背景采样链、平台圆角、统一宿主染色、认证回退、状态栏单层结构描边、认证官方双层高光显隐、认证卡片无项目结构描边和移动底栏唯一垂直留白 |',
)
replace_once(
    '| `auth-three-layer.spec.ts` | 登录三层结构、认证桌面／移动预设、认证内容内部定位、同源宿主染色、无项目外框、单实例、自然高度、表单值保持、断点切换和无内部滚动回归 |',
    '| `auth-three-layer.spec.ts` | 登录三层结构、认证桌面／移动预设、官方默认折射参数、`mouseContainer` 液体运动、双层边缘高光、认证内容内部定位、同源宿主染色、无项目外框、单实例、自然高度、表单值保持、断点切换和无内部滚动回归 |',
)
replace_once(
    '禁止 `shader` 模式，所有外壳和认证卡片继续使用 `elasticity={0}` 和固定 `globalMousePos`／`mouseOffset` 保持几何稳定。',
    '禁止 `shader` 模式。桌面／移动状态栏和移动底栏继续使用 `elasticity: 0` 与固定 `globalMousePos`／`mouseOffset` 保持信息 Chrome 稳定；桌面／移动认证卡片使用 `liquid-glass-react@1.1.1` 官方默认光学与运动参数，并通过认证宿主 `mouseContainer` 开启内部指针追踪。',
)
old_auth_block = '''`DESKTOP_AUTH_CARD_GLASS` 只供 `desktopAuthCard` 使用，参数固定为：

- `mode="standard"`；
- `displacementScale: 16`；
- `blurAmount: 0.12`，对应 `blur(7.84px)`；
- `saturation: 118`；
- `aberrationIntensity: 0.1`；
- `elasticity={0}`；
- `cornerRadius: 24`。

`MOBILE_AUTH_CARD_GLASS` 只供 `mobileAuthCard` 使用，参数固定为：

- `mode="standard"`；
- `displacementScale: 12`；
- `blurAmount: 0.1`，对应 `blur(7.2px)`；
- `saturation: 115`；
- `aberrationIntensity: 0.08`；
- `elasticity={0}`；
- `cornerRadius: 40`。

认证卡片使用比移动导航更弱的位移和色差，以保护输入框、验证码和错误文字边缘。桌面与移动分别沿用当前 `24px`／`40px` 几何，不得使用 `999px` 胶囊。认证卡片任一时刻只能存在一个玻璃实例，断点变化时只切换同一宿主的 variant。'''
new_auth_block = '''`DESKTOP_AUTH_CARD_GLASS` 只供 `desktopAuthCard` 使用，光学与运动参数使用 `liquid-glass-react@1.1.1` 官方默认值：

- `mode="standard"`；
- `displacementScale: 70`；
- `blurAmount: 0.0625`，对应 `blur(6px)`；
- `saturation: 140`；
- `aberrationIntensity: 2`；
- `elasticity: 0.15`；
- `cornerRadius: 24`。

`MOBILE_AUTH_CARD_GLASS` 只供 `mobileAuthCard` 使用，光学与运动参数同样使用官方默认值：

- `mode="standard"`；
- `displacementScale: 70`；
- `blurAmount: 0.0625`，对应 `blur(6px)`；
- `saturation: 140`；
- `aberrationIntensity: 2`；
- `elasticity: 0.15`；
- `cornerRadius: 40`。

官方默认值只适用于光学与运动参数；项目继续保留桌面 `24px`、移动 `40px` 圆角以及认证内容的 `32px`／`20px` 内边距，不采用官方 `999px` 胶囊几何或默认 padding。认证卡片通过官方 `mouseContainer` 接口绑定当前 `.liquid-glass-surface` 宿主，鼠标／指针进入宿主后驱动位移、弹性和两个直属边缘高光；状态栏与底栏不得因此开启液体运动。认证卡片任一时刻只能存在一个玻璃实例，断点变化时只切换同一宿主的 variant。'''
replace_once(old_auth_block, new_auth_block)
replace_once(
    '认证卡片必须使用 `layout="content"`，但其业务内容位置与状态栏统一，实际位于第三方 `.glass` 内部的 `.liquid-glass-surface__content`。宿主由真实内容高度驱动，不得为注册表单设置固定高度或内部滚动区。统一适配层必须使用单个 `ResizeObserver` 观察认证内容，并可用同一内容节点上的 `MutationObserver` 捕获条件 DOM 变化；高度改变后更新宿主高度并通过 `window` resize 通知上游玻璃重新读取几何。不得用 revision、React `key`、定时轮询或每帧测量重建认证内容，登录／注册切换、邀请码、验证码、错误和状态提示变化以及 `720px` 断点切换不得清空原生未受控表单值。',
    '认证卡片必须使用 `layout="content"`，但其业务内容位置与状态栏统一，实际位于第三方 `.glass` 内部的 `.liquid-glass-surface__content`。宿主由真实内容高度驱动，不得为注册表单设置固定高度或内部滚动区。统一适配层必须使用单个 `ResizeObserver` 同时观察认证内容与认证宿主，并可用同一内容节点上的 `MutationObserver` 捕获条件 DOM 变化；内容变化先更新宿主高度，宿主真实尺寸提交后再通过 `window` resize 通知上游玻璃重新读取几何。不得用 revision、React `key`、定时轮询或每帧测量重建认证内容，登录／注册切换、邀请码、验证码、错误和状态提示变化以及 `720px` 断点切换不得清空原生未受控表单值。官方两个边缘高光 `span` 必须随同一宿主同步宽高并保持可见，over-light 辅助 `div` 继续隐藏。',
)
replace_once(
    '- `liquid-glass-react` 内联的非前缀 `backdrop-filter` 始终是参数权威；桌面状态栏的 `-webkit-backdrop-filter` 必须严格为 `blur(6px) saturate(120%)`，移动状态栏与底栏必须严格为 `blur(7.2px) saturate(125%)`，桌面／移动认证卡片必须分别为 `blur(7.84px) saturate(118%)` 与 `blur(7.2px) saturate(115%)`；',
    '- `liquid-glass-react` 内联的非前缀 `backdrop-filter` 始终是参数权威；桌面状态栏的 `-webkit-backdrop-filter` 必须严格为 `blur(6px) saturate(120%)`，移动状态栏与底栏必须严格为 `blur(7.2px) saturate(125%)`，桌面／移动认证卡片统一为官方默认 `blur(6px) saturate(140%)`；',
)
replace_once(
    '- 桌面与移动状态栏以及认证效果层的重复 `span`／辅助 `div` 必须隐藏，第三方 `.glass` 计算后的 `box-shadow` 必须为 `none`；认证宿主可以保留由项目定义的一层悬浮阴影。',
    '- 桌面与移动状态栏的直属 `span`／辅助 `div` 必须隐藏；认证卡片的两个直属边缘高光 `span` 必须可见，over-light 辅助 `div` 必须隐藏。第三方 `.glass` 计算后的 `box-shadow` 必须为 `none`；认证宿主可以保留由项目定义的一层悬浮阴影。',
)
replace_once(
    '- 禁止滚动事件更新玻璃参数、噪点动画和每项独立滤镜。',
    '- 禁止滚动事件更新玻璃参数、噪点动画和每项独立滤镜。认证液体运动只允许由 `liquid-glass-react` 在认证 `mouseContainer` 内部处理指针事件，不得增加页面级或滚动级监听。',
)
replace_once(
    '- 装饰 SVG、摄影背景、氛围覆盖层和认证玻璃宿主不得阻止内部按钮或输入事件。',
    '- 装饰 SVG、官方边缘高光、摄影背景、氛围覆盖层和认证玻璃宿主不得阻止内部按钮或输入事件；两个认证高光保持 `pointer-events: none`。',
)
replace_once(
    '3. 认证卡片桌面使用 `desktopAuthCard`、移动使用 `mobileAuthCard`，断点切换全程只有一个 `.liquid-glass-surface`，保持 `data-liquid-glass-layout="content"`，真实表单内容位于 `.glass` 内且表单值不丢失；认证伪元素不生成项目结构描边或大圆角白色外框。',
    '3. 认证卡片桌面使用 `desktopAuthCard`、移动使用 `mobileAuthCard`，断点切换全程只有一个 `.liquid-glass-surface`，保持 `data-liquid-glass-layout="content"`，真实表单内容位于 `.glass` 内且表单值不丢失；认证伪元素不生成项目结构描边或大圆角白色外框，官方两个直属边缘高光保持可见。',
)
replace_once(
    '9. 桌面状态栏使用 `blur(6px) saturate(120%)`，移动 Chrome 使用 `blur(7.2px) saturate(125%)`，桌面／移动认证卡片分别使用 `blur(7.84px) saturate(118%)` 和 `blur(7.2px) saturate(115%)`。',
    '9. 桌面状态栏使用 `blur(6px) saturate(120%)`，移动 Chrome 使用 `blur(7.2px) saturate(125%)`，桌面／移动认证卡片统一使用官方默认 `blur(6px) saturate(140%)`，位移尺度为 `70`、色差为 `2`、弹性为 `0.15`。',
)
replace_once(
    '16. 支持环境中的认证卡片与状态栏统一使用 `--liquid-glass-contrast` 宿主染色且不存在 `.liquid-glass-surface__material-fill`；认证卡片 `::after` 不生成外框，`auth.css` 不包含认证卡片的模糊、玻璃渐变或材质描边，登录卡片不包含 `.panel`；不支持背景滤镜时认证卡片使用统一深色回退。',
    '16. 支持环境中的认证卡片与状态栏统一使用 `--liquid-glass-contrast` 宿主染色且不存在 `.liquid-glass-surface__material-fill`；认证卡片 `::after` 不生成外框，两个官方高光 `span` 可见且辅助 `div` 隐藏，`auth.css` 不包含认证卡片的模糊、玻璃渐变或材质描边，登录卡片不包含 `.panel`；不支持背景滤镜时认证卡片使用统一深色回退。\n17. Chromium 中把指针从认证卡片一侧移动到另一侧后，第三方 `.glass` 或直属高光的变换必须发生变化；登录→注册→登录和 `721px`／`720px` 双向切换后，宿主、效果层、`.glass`、SVG 滤镜与高光几何仍保持同步。',
)

path.write_text(text, encoding='utf-8')
