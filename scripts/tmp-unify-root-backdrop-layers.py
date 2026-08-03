from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one occurrence, found {count}: {old[:160]!r}')
    write(path, text.replace(old, new, 1))


def replace_regex_once(path: str, pattern: str, replacement: str, flags: int = 0) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{path}: expected one regex occurrence, found {count}: {pattern[:160]!r}')
    write(path, updated)


# Root backdrop layers: one sampling root for auth, player, admin and root states.
css = 'src/styles/financial-backdrop.css'
replace_once(
    css,
    '.application-content-root {\n  position: relative;\n  z-index: 2;\n  isolation: auto;\n  filter: none;\n  transform: none;',
    '.application-content-root {\n  position: relative;\n  z-index: auto;\n  isolation: auto;\n  filter: none;\n  transform: none;',
)
replace_once(
    css,
    '.application-image-layer {\n  z-index: 0;\n  overflow: hidden;',
    '.application-image-layer {\n  z-index: -2;\n  overflow: hidden;',
)
replace_once(
    css,
    '.application-atmosphere-layer {\n  z-index: 1;\n  overflow: hidden;',
    '.application-atmosphere-layer {\n  z-index: -1;\n  overflow: hidden;',
)
replace_once(
    css,
    '\nhtml[data-app-surface="auth"] .application-image-layer {\n  z-index: -2;\n}\n\nhtml[data-app-surface="auth"] .application-atmosphere-layer {\n  z-index: -1;\n}\n',
    '\n',
)

# Authoritative design.
registration = 'docs/REGISTRATION_INVITE_FLOW_DESIGN.md'
replace_once(registration, '> 更新时间：2026-08-02', '> 更新时间：2026-08-03')
replace_once(
    registration,
    '生产登录页的图片层、氛围层和 `.application-content-root` 必须是同一个 `#root` 隔离根的直接子节点；图片与氛围分别使用 `z-index: -2 / -1`，`.application-content-root → .login-shell → .login-content-layer → .login-card` 全链保持 `z-index:auto`、`isolation:auto`、`filter:none` 与 `transform:none`，不得建立额外 stacking context。',
    '认证、玩家、管理员与根级状态的图片层、氛围层和 `.application-content-root` 必须是同一个 `#root` 隔离根的直接子节点；图片与氛围固定使用 `z-index: -2 / -1`，`.application-content-root` 及其认证或登录后外壳全链保持 `z-index:auto`、`isolation:auto`、`filter:none` 与 `transform:none`，不得建立额外 stacking context，也不得按 `data-app-surface` 恢复状态专属层级。',
)

liquid_design = 'docs/LIQUID_GLASS_CHROME_DESIGN.md'
replace_regex_once(
    liquid_design,
    r'生产认证态继续使用 `-2 / -1` 负层级，(?:游戏与管理员登录态保持非负根层级|登录后玩家与管理员继续使用 `0 / 1 / 2` 根级层级)。',
    '认证、玩家、管理员与根级状态统一使用图片层 `z-index:-2`、氛围层 `z-index:-1` 和 `.application-content-root` 的 `z-index:auto`；不得按 `data-app-surface` 恢复状态专属层级。',
)

# Open sampling verifier.
open_verify = 'scripts/verify-open-glass-sampling.mjs'
replace_once(
    open_verify,
    "    '.application-content-root {',\n    'z-index: 2;',\n",
    "    '.application-content-root {',\n    'z-index: auto;',\n    '.application-image-layer {\\n  z-index: -2;',\n    '.application-atmosphere-layer {\\n  z-index: -1;',\n",
)
replace_once(
    open_verify,
    '.application-content-root {\n  position: relative;\n  z-index: 2;\n  isolation: auto;',
    '.application-content-root {\n  position: relative;\n  z-index: auto;\n  isolation: auto;',
)

# Three-layer verifier.
game_verify = 'scripts/verify-game-three-layer.mjs'
replace_once(
    game_verify,
    "  '.application-content-root {',\n  'z-index: 2;',\n  '.application-image-layer,',",
    "  '.application-content-root {',\n  'z-index: auto;',\n  '.application-image-layer,',",
)
replace_once(game_verify, "  'z-index: 0;',", "  'z-index: -2;',")
replace_once(game_verify, "  'z-index: 1;',", "  'z-index: -1;',")
text = read(game_verify)
start = text.index('const authImageNegativeLayer =')
end_marker = "\n\nfor (const text of [\n  '.game-image-layer',"
end = text.index(end_marker, start)
new_guard = """for (const text of [
  '.application-image-layer {\\n  z-index: -2;',
  '.application-atmosphere-layer {\\n  z-index: -1;',
  '.application-content-root {\\n  position: relative;\\n  z-index: auto;',
]) requireText('src/styles/financial-backdrop.css', text);
for (const text of [
  'html[data-app-surface=\"auth\"] .application-image-layer',
  'html[data-app-surface=\"auth\"] .application-atmosphere-layer',
  '.application-image-layer {\\n  z-index: 0;',
  '.application-atmosphere-layer {\\n  z-index: 1;',
  '.application-content-root {\\n  position: relative;\\n  z-index: 2;',
]) forbidText('src/styles/financial-backdrop.css', text);
forbidText('src/styles/financial-backdrop.css', '.photographic-state-card--loading');"""
write(game_verify, text[:start] + new_guard + text[end:])
replace_once(
    game_verify,
    "  '生产认证态继续使用 `-2 / -1` 负层级',",
    "  '认证、玩家、管理员与根级状态统一使用图片层 `z-index:-2`、氛围层 `z-index:-1` 和 `.application-content-root` 的 `z-index:auto`',",
)

# Authentication three-layer verifier now checks the same shared root layers.
auth_verify = 'scripts/verify-auth-three-layer.mjs'
replace_once(
    auth_verify,
    "  'html[data-app-surface=\"auth\"] .application-content-root {',\n  'html[data-app-surface=\"auth\"] .application-image-layer {',\n  'z-index: -2;',\n  'html[data-app-surface=\"auth\"] .application-atmosphere-layer {',\n  'z-index: -1;',",
    "  '.application-content-root {',\n  'z-index: auto;',\n  '.application-image-layer {',\n  'z-index: -2;',\n  '.application-atmosphere-layer {',\n  'z-index: -1;',",
)

# Browser assertions cover the actual shared layer values.
open_test = 'tests/browser/open-glass-sampling.spec.ts'
replace_once(
    open_test,
    '      samplingRootTransform: getComputedStyle(samplingRoot).transform,\n      rootContainsAllLayers:',
    '      samplingRootTransform: getComputedStyle(samplingRoot).transform,\n      imageLayerZIndex: getComputedStyle(imageLayer).zIndex,\n      atmosphereLayerZIndex: getComputedStyle(atmosphereLayer).zIndex,\n      contentRootZIndex: getComputedStyle(contentRoot).zIndex,\n      rootContainsAllLayers:',
)
replace_once(
    open_test,
    "  expect(chain.samplingRootTransform).toBe('none');\n  expect(chain.rootContainsAllLayers).toBe(true);",
    "  expect(chain.samplingRootTransform).toBe('none');\n  expect(chain.imageLayerZIndex).toBe('-2');\n  expect(chain.atmosphereLayerZIndex).toBe('-1');\n  expect(chain.contentRootZIndex).toBe('auto');\n  expect(chain.rootContainsAllLayers).toBe(true);",
)

game_test = 'tests/browser/game-three-layer.spec.ts'
replace_once(game_test, "    expect(visual.image).toEqual({ position: 'fixed', zIndex: '0' });", "    expect(visual.image).toEqual({ position: 'fixed', zIndex: '-2' });")
replace_once(game_test, "    expect(visual.atmosphere).toEqual({ position: 'fixed', zIndex: '1' });", "    expect(visual.atmosphere).toEqual({ position: 'fixed', zIndex: '-1' });")
replace_once(game_test, "    expect(visual.contentZIndex).toBe('2');", "    expect(visual.contentZIndex).toBe('auto');")

photography_test = 'tests/browser/application-photography.spec.ts'
replace_once(photography_test, "    expect(visual.imageZIndex).toBe('0');", "    expect(visual.imageZIndex).toBe('-2');")
replace_once(photography_test, "    expect(visual.atmosphereZIndex).toBe('1');", "    expect(visual.atmosphereZIndex).toBe('-1');")
replace_once(photography_test, "    expect(visual.contentZIndex).toBe('2');", "    expect(visual.contentZIndex).toBe('auto');")
