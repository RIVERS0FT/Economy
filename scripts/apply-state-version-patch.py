from pathlib import Path


def replace_once(path: str, old: str, new: str, *, required: bool = True) -> bool:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        if required:
            raise SystemExit(f"missing replacement in {path}: {old[:120]!r}")
        return False
    target.write_text(text.replace(old, new, 1))
    return True


def replace_all(path: str, old: str, new: str, *, required: bool = True) -> int:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count == 0:
        if required:
            raise SystemExit(f"missing replacement in {path}: {old[:120]!r}")
        return 0
    target.write_text(text.replace(old, new))
    return count


storage = Path("server/src/storage.js")
storage_text = storage.read_text()
import_marker = "import { createLeaderboardSnapshot, processLeaderboardWorld } from './leaderboards.js';\n"
version_import = "import { CURRENT_CLIENT_STATE_VERSION } from '../shared/economy-state-version.js';\n"
if version_import not in storage_text:
    if import_marker not in storage_text:
        raise SystemExit("storage import marker missing")
    storage_text = storage_text.replace(import_marker, import_marker + version_import, 1)
start = storage_text.index("function createVersionedClientState")
end = storage_text.index("\n}\n\nexport class EconomyStore", start)
serializer = storage_text[start:end]
if "version: CURRENT_CLIENT_STATE_VERSION," not in serializer:
    if "version: 16," not in serializer:
        raise SystemExit("storage client state version field missing")
    serializer = serializer.replace("version: 16,", "version: CURRENT_CLIENT_STATE_VERSION,", 1)
storage.write_text(storage_text[:start] + serializer + storage_text[end:])

capacity = Path("scripts/verify-state-delivery-capacity.mjs")
capacity_text = capacity.read_text()
capacity_import_marker = "import { createStateDeliveryCache } from '../src/app/stateDelivery.js';\n"
capacity_version_import = "import { CURRENT_CLIENT_STATE_VERSION } from '../server/shared/economy-state-version.js';\n"
if capacity_version_import not in capacity_text:
    if capacity_import_marker not in capacity_text:
        raise SystemExit("state delivery verifier import marker missing")
    capacity_text = capacity_text.replace(
        capacity_import_marker,
        capacity_import_marker + capacity_version_import,
        1,
    )
capacity_text = capacity_text.replace(
    "catalog: { version: 15, products: [], facilityTypes: [] },",
    "catalog: { version: CURRENT_CLIENT_STATE_VERSION, products: [], facilityTypes: [] },",
    1,
)
if "catalog: { version: CURRENT_CLIENT_STATE_VERSION, products: [], facilityTypes: [] }," not in capacity_text:
    raise SystemExit("state delivery verifier current-version fixture missing")
capacity.write_text(capacity_text)

partition_test = Path("server/test/state-partitions.test.js")
partition_text = partition_test.read_text()
partition_import_marker = "} from '../src/state-partitions.js';\n"
partition_version_import = "import { CURRENT_CLIENT_STATE_VERSION } from '../shared/economy-state-version.js';\n"
if partition_version_import not in partition_text:
    if partition_import_marker not in partition_text:
        raise SystemExit("state partitions test import marker missing")
    partition_text = partition_text.replace(
        partition_import_marker,
        partition_import_marker + partition_version_import,
        1,
    )
partition_text = partition_text.replace(
    "version: 15,",
    "version: CURRENT_CLIENT_STATE_VERSION,",
    1,
)
if "version: CURRENT_CLIENT_STATE_VERSION," not in partition_text:
    raise SystemExit("state partitions current-version fixture missing")
partition_test.write_text(partition_text)

for fixture in [
    "tests/browser/runtime-harness.tsx",
    "tests/browser/market-runtime-harness.tsx",
    "tests/browser/admin-runtime.spec.ts",
]:
    replace_all(fixture, "version: 15,", "version: 16,", required=False)

readme = Path("README.md")
readme_text = readme.read_text()
version_rule = (
    "- 客户端状态版本当前值与上一版本兼容下限统一定义在 "
    "`server/shared/economy-state-version.js`；服务器序列化、浏览器分区合并、类型声明、README "
    "与权威设计由 `scripts/verify-client-state-version.mjs` 强制保持一致。\n"
)
if version_rule not in readme_text:
    marker = (
        "- 游戏状态使用全局世界修订号排序，并按目录、玩家、市场、拍卖、排行榜五个分区增量同步。"
        "首次进入返回五个完整分区；后续请求同时提交全局修订号与各分区内容哈希，只返回哈希变化的分区。"
        "全局修订变化但当前玩家视图未变化时只返回新的全局修订号和空补丁；同全局修订号轮询继续在进入 SQLite "
        "事务前返回轻量确认。每个 `GET state` 响应都在分区 envelope 顶层携带响应生成时的 `serverNow`，"
        "该字段不进入世界 JSON、`EconomyState` 或分区哈希。\n"
    )
    if marker not in readme_text:
        raise SystemExit("README state delivery marker missing")
    readme_text = readme_text.replace(marker, marker + version_rule, 1)
readme.write_text(readme_text)

replace_all(
    "docs/README.md",
    "`shared/economy-state-version.js`",
    "`server/shared/economy-state-version.js`",
    required=False,
)
if "`server/shared/economy-state-version.js`" not in Path("docs/README.md").read_text():
    raise SystemExit("docs index version contract path missing")

design = Path("docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md")
design_text = design.read_text()
replacements = [
    (
        "- 客户端 `EconomyState.version` 固定为 15。\n- SQLite 世界版本固定为 13。",
        "- 客户端 `EconomyState.version` 当前为 16，上一客户端状态版本 15 "
        "仅作为静态资源与 API 滚动部署的兼容下限；当前值与兼容下限唯一配置在 "
        "`server/shared/economy-state-version.js`。\n"
        "- SQLite 世界版本固定为 14。\n"
        "- 服务器客户端状态序列化与浏览器五分区合并必须共同读取同一版本模块；"
        "`scripts/verify-client-state-version.mjs` 同时核对服务器、客户端、类型声明、README "
        "和本设计文档，任一漂移都阻止构建与部署。",
    ),
    (
        "本次加法迁移不提高世界版本 14 或客户端状态版本 15。",
        "本次加法迁移不提高世界版本 14 或客户端状态版本 16。",
    ),
    (
        "这是向后兼容的加法迁移，不提高世界版本 14 或客户端状态版本 15。",
        "这是向后兼容的加法迁移，不提高世界版本 14 或客户端状态版本 16。",
    ),
    (
        "世界版本继续为 13，客户端版本继续为 15。",
        "该历史迁移当时使用世界版本 13、客户端版本 15；当前版本由后续迁移提升到世界 14、客户端 16。",
    ),
    (
        "当前客户端状态版本保持 15，本地活动存储保持 v5，世界状态版本保持 13，市场需求模型版本为 4；",
        "当前客户端状态版本保持 16，本地活动存储保持 v5，世界状态版本保持 14，市场需求模型版本为 7；",
    ),
    (
        "迁移保持世界版本 14、客户端状态版本 15、玩家资产、玩家订单、成交历史与生产边滞后信号不变。",
        "迁移保持世界版本 14、客户端状态版本 16、玩家资产、玩家订单、成交历史与生产边滞后信号不变。",
    ),
]
for old, new in replacements:
    if old in design_text:
        design_text = design_text.replace(old, new, 1)

required_design_fragments = [
    "上一客户端状态版本 15",
    "`server/shared/economy-state-version.js`",
    "`scripts/verify-client-state-version.mjs`",
    "SQLite 世界版本固定为 14",
]
for fragment in required_design_fragments:
    if fragment not in design_text:
        raise SystemExit(f"server design version rule missing: {fragment}")

partition_marker = (
    "快照中字段缺失即代表该字段已经被服务器删除，空对象表示清空该分区；"
    "未变化分区继续复用已接受的缓存快照。\n"
)
version_paragraph = (
    "\n浏览器合并初始状态前必须先确认 `catalog`、`player`、`market`、`auction`、`leaderboard` "
    "五个完整分区均已建立，再校验客户端状态版本。缺少分区与版本不兼容必须返回不同的明确错误；"
    "不得再用单个硬编码版本比较把版本漂移误报为“分区不完整”。当前浏览器接受 "
    "`server/shared/economy-state-version.js` 声明的当前版本和上一客户端状态版本。\n"
)
if version_paragraph.strip() not in design_text:
    if partition_marker not in design_text:
        raise SystemExit("partition design marker missing")
    design_text = design_text.replace(partition_marker, partition_marker + version_paragraph, 1)

regression_marker = "把变化分区浅合并进旧完整状态、"
regression_replacement = (
    "把变化分区浅合并进旧完整状态、在客户端或服务器重新硬编码独立客户端状态版本、"
    "把版本不兼容误报为初始分区缺失、"
)
if regression_replacement not in design_text:
    if regression_marker not in design_text:
        raise SystemExit("regression design marker missing")
    design_text = design_text.replace(regression_marker, regression_replacement, 1)

stale_current_claims = [
    "客户端 `EconomyState.version` 固定为 15",
    "当前客户端状态版本保持 15",
    "迁移保持世界版本 14、客户端状态版本 15",
    "本次加法迁移不提高世界版本 14 或客户端状态版本 15",
]
for claim in stale_current_claims:
    if claim in design_text:
        raise SystemExit(f"stale current version claim remains: {claim}")
design.write_text(design_text)

for obsolete_path in [
    "shared/economy-state-version.js",
    ".github/workflows/agent-state-version-patch-pr.yml",
    "scripts/apply-state-version-patch.py",
]:
    obsolete = Path(obsolete_path)
    if obsolete.exists():
        obsolete.unlink()
