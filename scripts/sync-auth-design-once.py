from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


page_path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
page = read(page_path)
start = page.index('### 2.4 登录与注册入口')
end = page.index('\n## 3. 概览', start)
page_section = '''### 2.4 登录、注册与密码重置入口

未登录外壳固定以登录主面板作为默认入口，不提供“登录／注册”模式切换按钮。登录主面板只调用现有统一账号登录，不得在 401 后自动注册；账号和密码继续使用原生未受控表单与 `FormData`，避免浏览器自动填充被 React 空值覆盖。“忘记密码”和“注册账号”必须位于密码输入框下方，点击后在同一个认证卡片宿主中切换到对应子面板；注册子面板和密码重置子面板左上角都必须提供返回登录主面板的按钮，面板切换与响应式断点不得无故清空仍相关的未受控输入值。

注册子面板复用既有注册内容：账号邮箱、密码、可选邀请码、发送验证码、60s 倒计时和 6 位验证码输入。点击发送注册验证码后，服务器必须先查询统一账号邮箱是否已存在，已注册时直接提示登录且不启动倒计时、不创建验证码记录、不发送邮件。验证码完成后由 Economy 服务创建或登录统一账号并首次创建 Economy 玩家档案；注册完成后必须清理注册过程中取得的临时统一账号会话并返回登录主面板，由玩家使用新账号显式登录。

密码重置子面板固定提供账号邮箱、发送验证码、6 位验证码、新密码和“重置密码”按钮。验证码发送与密码更新都通过同源 `/economy-api/password-reset/` 代理交给主页统一账号服务；主页服务必须在发送验证码前确认邮箱已注册，Economy 不保存密码哈希、密码重置验证码或会话失效状态。重置成功后返回登录主面板，不自动建立或延续登录会话。

带 `?invite=邀请码` 的分享链接进入时直接打开注册子面板，并提示分享者将在新玩家首次创建 Economy 玩家档案后立即获得宝石。已登录统一账号也必须先调用 Economy 会话初始化接口处理邀请码，再请求正式游戏状态；处理完成后清除 URL 参数。无效邀请码不得阻止普通注册。
'''
page = page[:start] + page_section + page[end:]
write(page_path, page)

server_path = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
server = read(server_path)
server = server.replace('## 6. 注册与游戏 API', '## 6. 注册、密码重置与游戏 API', 1)
registration_paragraph = '邮箱验证码注册完成接口是另一条首次建档入口，两条入口必须共用同一首次建档、邀请归因、IP 检测和记录逻辑。'
reset_authority = '''\n\n统一账号密码重置由主页账号服务权威处理，Economy 游戏服务不得保存密码哈希、重置验证码或会话失效状态。Economy 只通过 Nginx 暴露同源 `/economy-api/password-reset/` 代理到主页 `127.0.0.1:3001/api/password-reset/`；发送验证码前的已注册邮箱确认、验证码校验、密码更新和旧会话失效均由主页账号服务完成。'''
if reset_authority.strip() not in server:
    server = server.replace(registration_paragraph, registration_paragraph + reset_authority, 1)
game_prefix = '游戏公网前缀 `/economy-api/game/`，内部前缀 `/api/game/`。'
reset_api = '''密码重置公网前缀 `/economy-api/password-reset/`，由 Nginx 直接代理主页账号服务 `/api/password-reset/`。\n\n| 方法 | 公网路径 | 主页内部路径 | 用途 |\n|---|---|---|---|\n| POST | `/economy-api/password-reset/email-code` | `/api/password-reset/email-code` | 确认邮箱已注册后发送密码重置验证码 |\n| POST | `/economy-api/password-reset/complete` | `/api/password-reset/complete` | 校验验证码、更新统一账号密码并使既有会话失效 |\n\n'''
if '`/economy-api/password-reset/email-code`' not in server:
    server = server.replace(game_prefix, reset_api + game_prefix, 1)
server = server.replace(
    '注册路由由 `scripts/configure-economy-registration-nginx.py` 幂等加入正式 HTTPS `server`：',
    '注册与密码重置路由由 `scripts/configure-economy-registration-nginx.py` 幂等加入正式 HTTPS `server`：',
    1,
)
route_line = '/economy-api/registration/ → 127.0.0.1:3002/api/registration/'
if '/economy-api/password-reset/ → 127.0.0.1:3001/api/password-reset/' not in server:
    server = server.replace(route_line, route_line + '\n/economy-api/password-reset/ → 127.0.0.1:3001/api/password-reset/', 1)
registration_bullet = '- 不得在手动注册路由已存在时再次生成 `/economy-api/registration/`。'
reset_bullet = '- 不得在手动密码重置路由已存在时再次生成 `/economy-api/password-reset/`；该代理必须清除浏览器 `Origin`、向主页传入可信 `X-Real-IP`，并保持 `16k` 请求体上限。'
if reset_bullet not in server:
    server = server.replace(registration_bullet, registration_bullet + '\n' + reset_bullet, 1)
server = server.replace(
    '- 游戏 API `client_max_body_size` 固定为 `256k`；注册 API 固定为 `16k`。',
    '- 游戏 API `client_max_body_size` 固定为 `256k`；注册与密码重置 API 固定为 `16k`。',
    1,
)
server = server.replace(
    '- 删除 `/economy-api/registration/` Nginx 路由或打印验证码、Resend API Key 与注册秘密；',
    '- 删除 `/economy-api/registration/` 或 `/economy-api/password-reset/` Nginx 路由，或打印验证码、密码、Resend API Key 与注册秘密；',
    1,
)
write(server_path, server)

index_path = 'docs/README.md'
index = read(index_path)
index = index.replace('登录注册入口、独立商店', '登录主面板、注册／密码重置子面板入口、独立商店', 1)
index = index.replace('登录／注册入口三层视觉、认证卡片几何与旧接口退役', '登录主面板与注册／密码重置子面板三层视觉、认证卡片几何与旧接口退役', 1)
index = index.replace('邮箱验证码注册、统一账号首次建档', '邮箱验证码注册、统一账号密码重置代理、统一账号首次建档', 1)
index = index.replace(
    'Economy 注册完成时点、主页账号自动建档、邮箱验证码、IP 指纹、多账号封禁、Resend、注册路由和登录注册双模式属于服务器与页面权威规则；',
    'Economy 注册完成时点、主页账号自动建档、邮箱验证码、统一账号密码重置代理、IP 指纹、多账号封禁、Resend、注册路由以及登录主面板与注册／密码重置子面板属于服务器与页面权威规则；',
    1,
)
write(index_path, index)

root_path = 'README.md'
root = read(root_path)
root = root.replace('完整登录、注册和游戏流程', '完整登录、注册、密码重置和游戏流程', 1)
write(root_path, root)

verify_path = 'scripts/verify-email-registration.mjs'
verify = read(verify_path)
server_anchor = "  '`/economy-api/registration/complete`',\n"
if "  '`/economy-api/password-reset/email-code`',\n" not in verify:
    verify = verify.replace(
        server_anchor,
        server_anchor + "  '`/economy-api/password-reset/email-code`',\n  '`/economy-api/password-reset/complete`',\n  '`127.0.0.1:3001/api/password-reset/`',\n",
        1,
    )
page_anchor = "  '已注册时直接提示登录且不启动倒计时、不创建验证码记录、不发送邮件',\n"
if "  '未登录外壳固定以登录主面板作为默认入口',\n" not in verify:
    verify = verify.replace(
        page_anchor,
        page_anchor + "  '未登录外壳固定以登录主面板作为默认入口',\n  '注册子面板',\n  '密码重置子面板',\n  '“忘记密码”和“注册账号”必须位于密码输入框下方',\n",
        1,
    )
forbid_anchor = "forbidText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '资料、偏好、邀请、礼品、退出和重置');"
new_forbid = "forbidText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '未登录外壳必须明确拆分“登录”和“注册”两个模式');"
if new_forbid not in verify:
    verify = verify.replace(forbid_anchor, forbid_anchor + '\n' + new_forbid, 1)
registration_doc_anchor = "for (const text of [\n  '登录主面板',"
index_check = "requireText('docs/README.md', '登录主面板、注册／密码重置子面板入口');\nrequireText('README.md', '完整登录、注册、密码重置和游戏流程');\n\n"
if "requireText('docs/README.md', '登录主面板、注册／密码重置子面板入口');" not in verify:
    verify = verify.replace(registration_doc_anchor, index_check + registration_doc_anchor, 1)
write(verify_path, verify)
