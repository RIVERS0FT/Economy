#!/usr/bin/env python3
from pathlib import Path


def replace_exact(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one replacement target, found {count}')
    file.write_text(text.replace(old, new), encoding='utf-8')


replace_exact(
    'scripts/install-economy-api.py',
    '''import secrets\nimport shutil\nimport sqlite3\nimport subprocess\nimport sys\nimport time\nimport urllib.error\nimport urllib.request\nfrom pathlib import Path''',
    '''import secrets\nimport shutil\nimport socket\nimport sqlite3\nimport subprocess\nimport sys\nimport time\nfrom pathlib import Path''',
)

replace_exact(
    'scripts/install-economy-api.py',
    '''SERVICE_HEALTH_URL = "http://127.0.0.1:3002/health"\nSERVICE_READY_TIMEOUT_SECONDS = 45\nSERVICE_READY_POLL_SECONDS = 1.0\nSERVICE_HEALTH_REQUEST_TIMEOUT_SECONDS = 2.0''',
    '''SERVICE_LISTEN_HOST = "127.0.0.1"\nSERVICE_LISTEN_PORT = 3002\nSERVICE_READY_TIMEOUT_SECONDS = 45\nSERVICE_READY_POLL_SECONDS = 1.0\nSERVICE_LISTEN_CONNECT_TIMEOUT_SECONDS = 1.0''',
)

replace_exact(
    'scripts/install-economy-api.py',
    '''def api_health_ready() -> bool:\n    try:\n        request = urllib.request.Request(SERVICE_HEALTH_URL, method="GET")\n        with urllib.request.urlopen(\n            request,\n            timeout=SERVICE_HEALTH_REQUEST_TIMEOUT_SECONDS,\n        ) as response:\n            return 200 <= int(response.status) < 300\n    except (urllib.error.URLError, TimeoutError, OSError):\n        return False\n''',
    '''def api_service_listening() -> bool:\n    try:\n        with socket.create_connection(\n            (SERVICE_LISTEN_HOST, SERVICE_LISTEN_PORT),\n            timeout=SERVICE_LISTEN_CONNECT_TIMEOUT_SECONDS,\n        ):\n            return True\n    except OSError:\n        return False\n''',
)

replace_exact(
    'scripts/install-economy-api.py',
    '''def wait_for_service_ready() -> None:\n    deadline = time.monotonic() + SERVICE_READY_TIMEOUT_SECONDS\n    attempt = 0\n    last_active = False\n    while time.monotonic() < deadline:\n        attempt += 1\n        last_active = subprocess.run(\n            ["systemctl", "is-active", "--quiet", SERVICE_NAME],\n            check=False,\n        ).returncode == 0\n        if last_active and api_health_ready():\n            print(f"ECONOMY_API_SERVICE_READY attempts={attempt}")\n            return\n        print(\n            "ECONOMY_API_SERVICE_READY_RETRY "\n            f"attempt={attempt} active={str(last_active).lower()}",\n            file=sys.stderr,\n        )\n        time.sleep(SERVICE_READY_POLL_SECONDS)\n\n    print(\n        "ECONOMY_API_SERVICE_READY_TIMEOUT "\n        f"seconds={SERVICE_READY_TIMEOUT_SECONDS} active={str(last_active).lower()}",\n        file=sys.stderr,\n    )\n    print_service_diagnostics()\n    raise RuntimeError(\n        f"{SERVICE_NAME} did not become healthy at {SERVICE_HEALTH_URL} "\n        f"within {SERVICE_READY_TIMEOUT_SECONDS} seconds"\n    )\n''',
    '''def wait_for_service_ready() -> None:\n    deadline = time.monotonic() + SERVICE_READY_TIMEOUT_SECONDS\n    attempt = 0\n    last_active = False\n    while time.monotonic() < deadline:\n        attempt += 1\n        last_active = subprocess.run(\n            ["systemctl", "is-active", "--quiet", SERVICE_NAME],\n            check=False,\n        ).returncode == 0\n        if last_active and api_service_listening():\n            print(f"ECONOMY_API_SERVICE_LISTEN_READY attempts={attempt}")\n            return\n        print(\n            "ECONOMY_API_SERVICE_LISTEN_RETRY "\n            f"attempt={attempt} active={str(last_active).lower()}",\n            file=sys.stderr,\n        )\n        time.sleep(SERVICE_READY_POLL_SECONDS)\n\n    print(\n        "ECONOMY_API_SERVICE_LISTEN_TIMEOUT "\n        f"seconds={SERVICE_READY_TIMEOUT_SECONDS} active={str(last_active).lower()}",\n        file=sys.stderr,\n    )\n    print_service_diagnostics()\n    raise RuntimeError(\n        f"{SERVICE_NAME} did not become active and listen on "\n        f"{SERVICE_LISTEN_HOST}:{SERVICE_LISTEN_PORT} "\n        f"within {SERVICE_READY_TIMEOUT_SECONDS} seconds"\n    )\n''',
)

replace_exact(
    'scripts/verify-runtime-reliability.mjs',
    '''for (const text of [\n  'SERVICE_HEALTH_URL = "http://127.0.0.1:3002/health"',\n  'SERVICE_READY_TIMEOUT_SECONDS = 45',\n  'def wait_for_service_ready()',\n  'ECONOMY_API_SERVICE_READY_RETRY',\n  'ECONOMY_API_SERVICE_READY_TIMEOUT',\n  'ECONOMY_API_SERVICE_DIAGNOSTICS_BEGIN',''',
    '''for (const text of [\n  'SERVICE_LISTEN_HOST = "127.0.0.1"',\n  'SERVICE_LISTEN_PORT = 3002',\n  'SERVICE_READY_TIMEOUT_SECONDS = 45',\n  'SERVICE_LISTEN_CONNECT_TIMEOUT_SECONDS = 1.0',\n  'def api_service_listening()',\n  'socket.create_connection(',\n  'def wait_for_service_ready()',\n  'ECONOMY_API_SERVICE_LISTEN_RETRY',\n  'ECONOMY_API_SERVICE_LISTEN_TIMEOUT',\n  'ECONOMY_API_SERVICE_DIAGNOSTICS_BEGIN',''',
)

replace_exact(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    '生产验收同时包含发布前远端验收和发布后公网验收，`ECONOMY_DEPLOY_VERIFY_START` 之后的 45 秒真实健康检查门槛保持不变。',
    '服务安装阶段只确认 `systemd active + 127.0.0.1:3002 TCP` 已监听，避免业务事件循环正在处理长事务时把“已启动但暂时繁忙”误判为“服务未启动”；安装器不得用 HTTP `/health` 复制正式健康门禁。真实 HTTP 健康唯一由紧随其后的发布前远端验收执行。生产验收同时包含发布前远端验收和发布后公网验收，`ECONOMY_DEPLOY_VERIFY_START` 之后的 45 秒真实健康检查门槛保持不变。',
)

replace_exact(
    'scripts/verify-runtime-reliability.mjs',
    '''  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '45 秒真实健康检查门槛保持不变'],''',
    '''  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '服务安装阶段只确认 `systemd active + 127.0.0.1:3002 TCP` 已监听'],\n  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '安装器不得用 HTTP `/health` 复制正式健康门禁'],\n  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '45 秒真实健康检查门槛保持不变'],''',
)
