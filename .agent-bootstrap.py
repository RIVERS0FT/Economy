from pathlib import Path

path = Path('.agent-harden.py')
text = path.read_text(encoding='utf-8')
old = """replace_once(path, \"\"\"邀请专项验收必须覆盖分享链接即时奖励、手动邀请码唯一绑定、同 IP 全组封禁、423 响应和管理员解禁。\\n\"\"\", \"\"\"邀请与封禁专项验收必须覆盖分享链接即时奖励、手动邀请码唯一绑定、同 IP 异常上报不封禁、管理员手动封禁、423 响应、历史自动封禁幂等迁移和管理员解禁。\\n\"\"\")"""
new = """replace_once(path, \"\"\"邀请专项验收必须覆盖分享链接即时奖励、手动邀请码唯一绑定、同 IP 全组封禁、423 响应和管理员解禁。\"\"\", \"\"\"邀请与封禁专项验收必须覆盖分享链接即时奖励、手动邀请码唯一绑定、同 IP 异常上报不封禁、管理员手动封禁、423 响应、历史自动封禁幂等迁移和管理员解禁。\"\"\")"""
if text.count(old) != 1:
    raise RuntimeError(f'bootstrap expected one script anchor, found {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
exec(compile(path.read_text(encoding='utf-8'), str(path), 'exec'))
Path('.agent-bootstrap.py').unlink(missing_ok=True)
