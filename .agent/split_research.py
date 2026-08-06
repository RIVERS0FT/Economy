from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:80]!r}')
    write(path, content.replace(old, new, 1))


def replace_regex(path: str, pattern: str, replacement: str) -> None:
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{path}: pattern did not match exactly once: {pattern}')
    write(path, updated)


# Install complete replacements prepared on the branch.
for source, destination in [
    ('.agent/research.js', 'server/src/research.js'),
    ('.agent/ResearchPage.tsx', 'src/pages/ResearchPage.tsx'),
    ('.agent/research.test.js', 'server/test/research.test.js'),
    ('.agent/research-gem-acceleration.test.js', 'server/test/research-gem-acceleration.test.js'),
    ('.agent/verify-research-progression.mjs', 'scripts/verify-research-progression.mjs'),
    ('.agent/verify-research-page.mjs', 'scripts/verify-research-page.mjs'),
    ('.agent/research-technology-tree.spec.ts', 'tests/browser/research-technology-tree.spec.ts'),
]:
    shutil.copyfile(ROOT / source, ROOT / destination)

# Keep client types additive so old test fixtures and state snapshots remain readable.
replace_once(
    'src/types.ts',
    '''export interface ResearchLevelDefinition {
  id: FacilityComplexity;
  rank: number;
  cost: number;
  durationMs: number;
}

export interface ActiveResearch {
  targetComplexity: FacilityComplexity;
  startedAt: number;
  completesAt: number;
  cost: number;
  employmentReleased: number;
  gemAccelerationMs?: number;
  gemAccelerationCost?: number;
}

export interface ResearchState {
  unlockedComplexity: FacilityComplexity;
  completedAt: number | null;
  active: ActiveResearch | null;
}
''',
    '''export interface ResearchLevelDefinition {
  id: FacilityComplexity;
  rank: number;
  cost: number;
  durationMs: number;
}

export interface ResearchTechnologyDefinition {
  id: string;
  name: string;
  stage: FacilityComplexity;
  rank: number;
  cost: number;
  durationMs: number;
  prerequisiteTechnologyIds: string[];
  unlockFacilityTypeIds: string[];
  description: string;
  initial?: boolean;
  legacy?: boolean;
}

export interface ActiveResearch {
  technologyId?: string;
  technologyName?: string;
  targetComplexity: FacilityComplexity;
  startedAt: number;
  completesAt: number;
  durationMs?: number;
  cost: number;
  employmentReleased: number;
  legacy?: boolean;
  grantTechnologyIds?: string[];
  gemAccelerationMs?: number;
  gemAccelerationCost?: number;
}

export interface ResearchState {
  unlockedComplexity: FacilityComplexity;
  completedTechnologyIds?: string[];
  completedAtByTechnologyId?: Record<string, number>;
  completedAt: number | null;
  active: ActiveResearch | null;
}
''',
)
replace_once(
    'src/types.ts',
    '  researchLevels: ResearchLevelDefinition[];\n  research: ResearchState;',
    '  researchLevels: ResearchLevelDefinition[];\n  researchTechnologies?: ResearchTechnologyDefinition[];\n  research: ResearchState;',
)

# New clients submit a concrete technology ID; the server still accepts legacy targetComplexity requests.
replace_once(
    'src/api/game.ts',
    "  startResearch: (targetComplexity: string) => postAction('/research/start', { targetComplexity }),",
    "  startResearch: (technologyId: string) => postAction('/research/start', { technologyId }),",
)
content = read('src/app/gameViewModel.ts')
content = content.replace('startResearch: (targetComplexity: string)', 'startResearch: (technologyId: string)')
content = content.replace('gameActions.startResearch(targetComplexity)', 'gameActions.startResearch(technologyId)')
content = content.replace('const startResearch = useCallback((targetComplexity: string)', 'const startResearch = useCallback((technologyId: string)')
write('src/app/gameViewModel.ts', content)

# Add the technology catalog to the immutable catalog partition.
replace_once(
    'server/src/state-partitions.js',
    "const CATALOG_KEYS = new Set(['version', 'products', 'facilityTypes', 'researchLevels']);",
    "const CATALOG_KEYS = new Set(['version', 'products', 'facilityTypes', 'researchLevels', 'researchTechnologies']);",
)

# Facility lease operation must use the same concrete technology access rule as construction and markets.
replace_once(
    'server/src/commercial-contracts.js',
    "import { ensurePlayerResearch } from './research.js';",
    "import { hasResearchAccessForFacility } from './research.js';",
)
replace_once(
    'server/src/commercial-contracts.js',
    '''function researchRank(value) {
  const rank = Number(String(value || 'C1').slice(1));
  return Number.isInteger(rank) ? Math.max(1, Math.min(7, rank)) : 1;
}
function canOperateFacility(world, player, facilityTypeId, now) {
  const facility = FACILITY_BY_ID.get(String(facilityTypeId));
  if (!facility) return false;
  const research = ensurePlayerResearch(world, player, now);
  return researchRank(research?.unlockedComplexity) >= researchRank(facility.complexity);
}
''',
    '''function canOperateFacility(world, player, facilityTypeId, now) {
  return hasResearchAccessForFacility(world, player, facilityTypeId, now);
}
''',
)

# Make the new page compatible with legacy active records whose technologyId or durationMs is absent.
page = read('src/pages/ResearchPage.tsx')
page = page.replace('    technologyId: string;\n', '    technologyId?: string;\n', 1)
page = page.replace('    id: active.technologyId,', "    id: active.technologyId ?? `legacy-stage-${active.targetComplexity}`,", 1)
page = page.replace(
    '  const activeTechnology = active\n    ? technologiesById.get(active.technologyId) ?? pseudoTechnologyForActive(active)\n    : null;',
    '  const activeTechnology = active\n    ? (active.technologyId ? technologiesById.get(active.technologyId) : null) ?? pseudoTechnologyForActive(active)\n    : null;',
)
write('src/pages/ResearchPage.tsx', page)

# Add node-specific visual states without changing the shared workspace geometry.
css_append = r'''

/* Split technology nodes: C1-C7 remain visual stages while access belongs to each node. */
.research-stage-node {
  cursor: default;
  pointer-events: none;
  background: color-mix(in srgb, var(--surface-raised) 88%, transparent);
}

.research-stage-node .research-level-code {
  font-size: 1.05rem;
  letter-spacing: 0.04em;
}

.research-technology-node {
  position: relative;
  min-height: 7.5rem;
  isolation: isolate;
}

.research-technology-node::before {
  content: '';
  position: absolute;
  inset: -2px;
  z-index: -1;
  border-radius: inherit;
  background: conic-gradient(
    var(--color-info) var(--research-node-progress, 0deg),
    transparent 0deg
  );
  opacity: 0;
}

.research-technology-node[data-status="mastered"] {
  border-color: color-mix(in srgb, var(--color-success) 65%, var(--border-subtle));
}

.research-technology-node[data-status="active"] {
  border-color: var(--color-info);
  background: color-mix(in srgb, var(--color-info) 10%, var(--surface-raised));
}

.research-technology-node[data-status="active"]::before {
  opacity: 1;
}

.research-technology-node[data-status="available"] {
  border-color: color-mix(in srgb, var(--color-warning) 70%, var(--border-subtle));
}

.research-technology-node[data-status="locked"] {
  opacity: 0.62;
}

.research-technology-node[data-selected="true"] {
  box-shadow: 0 0 0 2px var(--surface-base), 0 0 0 4px var(--color-accent);
}

.research-technology-node > small {
  color: var(--text-muted);
  font-size: 0.7rem;
}
'''
css = read('src/styles/research-page.css')
if '/* Split technology nodes:' not in css:
    write('src/styles/research-page.css', css.rstrip() + css_append + '\n')

# Generate runtime harness data directly from the authoritative server catalog.
catalog_json = subprocess.check_output(
    [
        'node',
        '--input-type=module',
        '-e',
        "import { RESEARCH_TECHNOLOGY_CATALOG } from './server/src/research-catalog.js'; console.log(JSON.stringify(RESEARCH_TECHNOLOGY_CATALOG));",
    ],
    cwd=ROOT,
    text=True,
)
technologies = json.loads(catalog_json)
technology_literal = json.dumps(technologies, ensure_ascii=False, indent=6)
research_levels_literal = json.dumps([
    {'id': 'C1', 'rank': 1, 'cost': 0, 'durationMs': 0},
    {'id': 'C2', 'rank': 2, 'cost': 2100, 'durationMs': 29 * 60_000},
    {'id': 'C3', 'rank': 3, 'cost': 3100, 'durationMs': 88 * 60_000},
    {'id': 'C4', 'rank': 4, 'cost': 6800, 'durationMs': 250 * 60_000},
    {'id': 'C5', 'rank': 5, 'cost': 4400, 'durationMs': 165 * 60_000},
    {'id': 'C6', 'rank': 6, 'cost': 4500, 'durationMs': 195 * 60_000},
    {'id': 'C7', 'rank': 7, 'cost': 7000, 'durationMs': 315 * 60_000},
], ensure_ascii=False, indent=6)
replace_regex(
    'tests/browser/runtime-harness.tsx',
    r'    next\.game\.researchLevels = \[.*?\n    \];',
    '    next.game.researchLevels = ' + research_levels_literal + ';\n'
    '    Object.assign(next.game, { researchTechnologies: ' + technology_literal + ' });',
)
research_state = '''    next.game.research = scenario === 'research-active'
      ? {
          unlockedComplexity: 'C1',
          completedTechnologyIds: ['basic-crops', 'basic-livestock', 'mineral-exploration'],
          completedAtByTechnologyId: {
            'basic-crops': fixedNow - 60_000,
            'basic-livestock': fixedNow - 60_000,
            'mineral-exploration': fixedNow - 60_000,
          },
          completedAt: fixedNow - 60_000,
          active: {
            technologyId: 'metallurgy',
            technologyName: '冶金技术',
            targetComplexity: 'C3',
            startedAt: fixedNow - 5 * 60_000,
            completesAt: fixedNow + 15 * 60_000,
            durationMs: 20 * 60_000,
            cost: 700,
            employmentReleased: 175,
            gemAccelerationMs: 30 * 60_000,
            gemAccelerationCost: 1,
          },
        }
      : scenario === 'research-accelerated'
        ? {
            unlockedComplexity: 'C4',
            completedTechnologyIds: [
              'basic-crops', 'basic-livestock', 'forestry-development', 'mineral-exploration',
              'petroleum-exploration', 'grain-processing', 'wood-processing', 'feed-processing',
              'pulp-technology', 'metallurgy', 'textile-technology', 'food-industry', 'papermaking',
              'oil-refining', 'fertilizer-engineering', 'veterinary-medicine', 'beverage-industry',
              'furniture-manufacturing', 'garment-manufacturing', 'tool-manufacturing',
            ],
            completedAtByTechnologyId: {},
            completedAt: fixedNow - 60_000,
            active: {
              technologyId: 'mechanical-engineering',
              technologyName: '机械工程',
              targetComplexity: 'C5',
              startedAt: fixedNow - 60 * 60_000,
              completesAt: fixedNow + 30 * 60_000,
              durationMs: 90 * 60_000,
              cost: 2_500,
              employmentReleased: 1_667,
              gemAccelerationMs: 30 * 60_000,
              gemAccelerationCost: 1,
            },
          }
        : {
            unlockedComplexity: 'C1',
            completedTechnologyIds: ['basic-crops', 'basic-livestock'],
            completedAtByTechnologyId: {},
            completedAt: fixedNow - 60_000,
            active: null,
          };'''
replace_regex(
    'tests/browser/runtime-harness.tsx',
    r"    next\.game\.research = scenario === 'research-active'.*?\n    Object\.assign\(next, \{",
    research_state + '\n    Object.assign(next, {',
)

# Replace the authority rules rather than creating parallel design documents.
industry_section = '''### 1.2 复杂度与科技研发准入

工厂 `complexity` 继续负责建造费、施工时间、系统参考值、人口承载权重、岗位结构和产业阶段展示；工厂研发准入由具体科技节点决定，不再把同一复杂度的全部工厂作为一个不可拆分解锁包。服务器权威科技目录为 `server/src/research-catalog.js`，每座正式工厂必须且只能映射一个 `required technology`，科技所属 `stage` 必须与工厂 `complexity` 一致。

科技树固定为 24 个节点，其中“基础种植”和“基础养殖”在新玩家建档时初始掌握，其余 22 个节点按真实产业链设置前置关系。玩家可以在满足前置科技后选择产业方向，不要求先清空整个阶段；C1–C7 只表示产业难度阶段，不提供整级工厂准入。工厂的建设、买入、竞拍、启动、切换配方、切换作业制度和租入运营资格均必须校验该工厂对应科技，客户端隐藏或禁用不构成权威判断。

现有玩家迁移不得失去资产或承诺：旧 `unlockedComplexity` 授予对应完整阶段及之前阶段的全部科技；已拥有、施工、公开买单或最高竞拍承诺中的工厂授予该工厂科技及全部前置科技。迁移后 `unlockedComplexity` 仅表示从 C1 开始连续全部完成的最高阶段，用于兼容与展示，不得再用于具体工厂准入。
'''
replace_regex(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    r'### 1\.2 复杂度研发准入\n.*?(?=\n## 2\.)',
    industry_section.rstrip(),
)

page_section = '''### 5.4 研发页面

研发页面使用路由 ID `research` 和 `ResearchPage`，固定排列在生产右侧、拍卖左侧。页面读取服务器权威的 `researchLevels`、`researchTechnologies` 与玩家 `research`。C1–C7 只作为产业阶段和视觉分组，不再作为新客户端可点击的整级研发项目；玩家实际选择并研发具体科技节点。

科技目录固定为 24 个节点：C1 的“基础种植”“基础养殖”由新玩家初始掌握，其余节点按照真实产业链设置前置关系。玩家满足节点全部前置科技即可研发，不要求清空同阶段其他科技；同时只能进行一项研发，开始后不可取消、不可排队。完成科技只获得其声明工厂的建设、购买、竞拍、启动、配置和租入运营资格，不提供产量、周期、成本、配方、作业制度或仓库加成。

研发页固定分为“研发新技术”和“技术树”两个一级区域。大于 `1380px` 时复用生产工作区三轨宽度：左侧操作列为 `280px–320px`，右侧技术树跨两条轨道；`961px–1380px` 保持左侧固定操作列和右侧剩余宽度，宽度不大于 `960px` 时改为单列。桌面操作卡只在研发工作区内 `sticky`。桌面代表工厂图标固定为 `4.5rem` 的 1:1 正圆，移动详情继续使用共享底部详情面板。

技术树按 C1–C7 阶段横向组织，每个阶段内部展示具体科技节点。节点显示科技名称、代表工厂图标、已掌握／研发中／可研发／锁定状态和研发中环形进度；点击锁定节点仍可查看缺少的具体前置科技。技术树宽度不足时只允许自身滚动，不得让整个页面横向溢出。默认选择进行中的科技，其次选择第一个满足前置关系的可研发科技，全部完成时选择最终科技。

点击科技节点后，操作区必须显示前置科技、研发费用、当前资金与缺口、研发队列、产业阶段、基础时间、解锁工厂和权限边界。开始研发仍需二次确认费用、时间与不可取消边界。研发费用在启动时一次性扣除，研发期间继续按时间进度释放为基础人口 10%、技术人口 40%、专业人口 50% 的研发就业收入；1 宝石固定减少 30 分钟，倒计时归零后由权威倒计时协调器刷新，客户端不得自行完成。

旧客户端继续可以提交 `targetComplexity`。服务器仅允许其研发当前连续完整阶段的下一级，并把该阶段尚未完成的节点合并为一个 `legacy-stage-Cn` 兼容项目；费用与时间等于剩余节点之和，完成后授予这些节点。新客户端只提交 `technologyId`，不得恢复以 `unlockedComplexity` 判断具体工厂权限。
'''
replace_regex(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    r'### 5\.4 研发页面\n.*?(?=\n### 5\.5|\n## 6\.)',
    page_section.rstrip(),
)

server_append = '''

## 科技节点研发状态与迁移

世界版本 27 将研发持久状态从单一 `unlockedComplexity` 扩展为 `completedTechnologyIds`、`completedAtByTechnologyId` 和单个 `active` 科技项目。`active` 保存 `technologyId`、所属阶段、原始 `durationMs`、截止时间、费用和已释放就业资金；宝石加速只缩短截止时间，进度和就业释放仍使用原始基础时长计算。

服务器 `research-catalog.js` 是科技节点、前置关系与工厂映射的唯一目录。所有工厂资产入口、生产操作和工厂租赁运营资格均调用同一具体科技校验；`unlockedComplexity` 只作为连续完整阶段的兼容派生值。旧世界按既有等级、资产、施工、买单与最高竞拍承诺授予科技及前置闭包；旧进行中阶段研发保存为 `legacy-stage-Cn`，到期授予该阶段剩余节点。迁移、处理和加速必须幂等，不得重复扣费、重复发放就业资金或降低既有准入。
'''
server_doc = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md')
if '## 科技节点研发状态与迁移' not in server_doc:
    write('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', server_doc.rstrip() + server_append + '\n')

replace_once(
    'docs/README.md',
    'C1-C7 顺序研发入口与技术路线',
    'C1-C7 产业阶段与按产业链拆分的科技节点研发入口',
)

# Record the schema migration version consistently in all authoritative documents.
for path in [ROOT / 'README.md', *sorted((ROOT / 'docs').glob('*.md'))]:
    content = path.read_text(encoding='utf-8')
    content = content.replace('> 世界状态版本：26', '> 世界状态版本：27')
    content = content.replace('世界状态版本 `26`', '世界状态版本 `27`')
    path.write_text(content, encoding='utf-8')

for path in [
    'scripts/verify-document-authority.mjs',
    'scripts/verify-client-state-version.mjs',
    'scripts/verify-state-delivery-capacity.mjs',
    'scripts/verify-runtime-reliability.mjs',
]:
    target = ROOT / path
    if not target.exists():
        continue
    content = target.read_text(encoding='utf-8')
    content = content.replace('世界状态版本：26', '世界状态版本：27')
    content = re.sub(r'(WORLD_VERSION\s*=\s*)26\b', r'\g<1>27', content)
    content = content.replace('RESEARCH_WORLD_VERSION = 26', 'RESEARCH_WORLD_VERSION = 27')
    target.write_text(content, encoding='utf-8')

# The research page verification checks the additive optional state field.
verification = read('scripts/verify-research-progression.mjs')
verification = verification.replace(
    'researchTechnologies: ResearchTechnologyDefinition[]',
    'researchTechnologies?: ResearchTechnologyDefinition[]',
)
write('scripts/verify-research-progression.mjs', verification)

# Temporary workflow and templates must not remain in the final tree.
workflow = ROOT / '.github/workflows/agent-split-research.yml'
if workflow.exists():
    workflow.unlink()
shutil.rmtree(ROOT / '.agent')

print('split research technology changes applied')
