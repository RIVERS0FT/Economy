from pathlib import Path

path = Path('.agent-harden.py')
text = path.read_text(encoding='utf-8')
old_start = """邀请专项验收必须覆盖分享链接即时奖励、手动邀请码唯一绑定、同 IP 全组封禁、423 响应和管理员解禁。
\"\"\", \"\"\"邀请与封禁专项验收必须覆盖"""
new_start = """邀请专项验收必须覆盖分享链接即时奖励、手动邀请码唯一绑定、同 IP 全组封禁、423 响应和管理员解禁。\"\"\", \"\"\"邀请与封禁专项验收必须覆盖"""
old_end = """历史自动封禁幂等迁移和管理员解禁。
\"\"\")"""
new_end = """历史自动封禁幂等迁移和管理员解禁。\"\"\")"""
if text.count(old_start) != 1 or text.count(old_end) != 1:
    raise RuntimeError(
        f'bootstrap anchors start={text.count(old_start)} end={text.count(old_end)}',
    )
path.write_text(text.replace(old_start, new_start, 1).replace(old_end, new_end, 1), encoding='utf-8')
exec(compile(path.read_text(encoding='utf-8'), str(path), 'exec'))
Path('.agent-bootstrap.py').unlink(missing_ok=True)
