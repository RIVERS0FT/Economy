from __future__ import annotations

import re
from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one literal match, found {count}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str, *, flags: int = 0) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{path}: expected one regex match, found {count}: {pattern}")
    write(path, updated)


replace_once(
    "src/pages/ProductionPage.tsx",
    '      <div className="facility-card-spacer" aria-hidden="true" />\n',
    "",
)

facility_path = "src/styles/facility-group-card-grid.css"
facility = read(facility_path)
facility = facility.replace("  align-self: stretch;\n  container-type: inline-size;", "  align-self: start;\n  container-type: inline-size;", 1)
facility = facility.replace("  min-height: 100%;\n}\n\n.facility-group-card", "  min-height: 0;\n}\n\n.facility-group-card", 1)
facility = facility.replace(
    "  grid-template-rows: auto auto auto minmax(0, 1fr) auto;\n  grid-auto-rows: auto;\n  align-content: stretch;",
    "  grid-template-rows: auto;\n  grid-auto-rows: auto;\n  align-content: start;",
    1,
)
facility = re.sub(r"\n\.facility-card-spacer \{[^}]*\}\n", "\n", facility)
facility = re.sub(r"\n  \.facility-card-spacer \{[^}]*\}\n", "\n", facility)
mobile_anchor = """  .facility-cluster-selector-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .facility-group-card {
"""
mobile_replacement = """  .facility-cluster-selector-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .production-build-card {
    position: static;
    top: auto;
    max-height: none;
    overflow: visible;
  }

  .facility-group-card {
"""
if facility.count(mobile_anchor) != 1:
    raise SystemExit(f"{facility_path}: max-width 960 insertion anchor mismatch")
facility = facility.replace(mobile_anchor, mobile_replacement, 1)
desktop_pattern = re.compile(
    r"/\* Desktop production workspace density\. \*/\n@media \(min-width: 961px\) \{.*?\n\}\n\n(?=@media \(min-width: 1600px\))",
    re.S,
)
desktop_replacement = """/* Desktop production workspace density. */
@media (min-width: 961px) {
  .production-build-card {
    position: sticky;
    top: var(--desktop-page-top-offset);
    align-self: start;
    max-height: calc(100dvh - var(--desktop-page-top-offset) - var(--desktop-layout-gutter));
    overflow-y: auto;
    overscroll-behavior-x: contain;
    overscroll-behavior-y: auto;
  }
}

"""
facility, desktop_count = desktop_pattern.subn(desktop_replacement, facility, count=1)
if desktop_count != 1:
    raise SystemExit(f"{facility_path}: desktop authority block mismatch")
write(facility_path, facility)

industry_path = "src/styles/industry-system.css"
industry = read(industry_path)
industry = re.sub(r"\n\.production-grid \{[^}]*\}\n", "\n", industry)

property_pattern = re.compile(
    r"^\s*(?:position|top|align-self|max-height|overflow|overflow-y|overscroll-behavior-x|overscroll-behavior-y):[^;]+;\n",
    re.M,
)


def clean_build_block(match: re.Match[str]) -> str:
    body = property_pattern.sub("", match.group(1))
    if not body.strip():
        return ""
    return ".production-build-card {\n" + body + "}\n"

industry = re.sub(
    r"\.production-build-card \{\n(.*?)\}\n",
    clean_build_block,
    industry,
    flags=re.S,
)
write(industry_path, industry)

replace_once(
    "docs/INDUSTRY_AND_PRODUCTION_DESIGN.md",
    "共享仓库、建设新工厂、工厂集群选择和桌面当前工厂详情属于生产页同一一级平面，统一使用 `.production-surface` 与 `PagePanel`：大于 `720px` 时四边内边距统一为 `16px`，不大于 `720px` 时统一为 `12px`。业务 CSS 只管理轨道、列数、内部密度和 Overlay，不得重新声明一级卡片外层 `padding`。\n",
    "共享仓库、建设新工厂、工厂集群选择和桌面当前工厂详情属于生产页同一一级平面，统一使用 `.production-surface` 与 `PagePanel`：大于 `720px` 时四边内边距统一为 `16px`，不大于 `720px` 时统一为 `12px`。业务 CSS 只管理轨道、列数、内部密度和 Overlay，不得重新声明一级卡片外层 `padding`。\n\n生产管理区的主网格、响应式轨道、建设卡 sticky 几何、集群选择器和详情高度统一由 `src/styles/facility-group-card-grid.css` 负责；`src/styles/industry-system.css` 只保留建设表单、施工状态和生产内容的内部密度，不得重新声明 `.production-grid` 主轨道、sticky 顶部偏移、最大高度或页面级溢出规则。\n",
)
replace_once(
    "docs/INDUSTRY_AND_PRODUCTION_DESIGN.md",
    "- 桌面详情卡高度由内容决定：详情壳使用交叉轴起始对齐，详情卡不得使用 `min-height: 100%`、弹性空白行或可见占位 spacer；市场入口紧跟在实际详情内容之后。\n",
    "- 桌面详情卡高度由内容决定：详情壳使用交叉轴起始对齐，详情卡不得使用 `min-height: 100%`、弹性空白行或可见占位 spacer；市场入口紧跟在实际详情内容之后。\n- 共享详情组件不得渲染无业务语义的 spacer DOM，生产布局 CSS 也不得保留 `.facility-card-spacer` 选择器；自然内容流是桌面详情高度的唯一来源。\n",
)

write(
    "scripts/verify-production-desktop-layout.mjs",
    """// Desktop production workspace geometry regression guard.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const shell = read('src/styles/game-shell-layout.css');
const page = read('src/pages/ProductionPage.tsx');
const production = read('src/styles/facility-group-card-grid.css');
const legacyIndustryStyles = read('src/styles/industry-system.css');
const industry = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
const chrome = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');
const readme = read('README.md');

for (const text of [
  '--desktop-page-top-offset: calc(',
  'padding-top: var(--desktop-page-top-offset);',
  'scroll-padding-top: var(--desktop-page-top-offset);',
]) assert.equal(shell.includes(text), true, `桌面外壳缺少: ${text}`);

for (const text of [
  'Desktop production workspace density',
  '@media (min-width: 961px)',
  'position: sticky;',
  'top: var(--desktop-page-top-offset);',
  'max-height: calc(100dvh - var(--desktop-page-top-offset) - var(--desktop-layout-gutter));',
  'align-self: start;',
  'grid-template-rows: auto;',
  'align-content: start;',
  '@media (min-width: 1600px)',
  'minmax(440px, 520px)',
  'minmax(480px, 680px)',
  'justify-content: start;',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
]) assert.equal(production.includes(text), true, `桌面生产布局缺少: ${text}`);

assert.equal(page.includes('facility-card-spacer'), false, '生产详情不得渲染占位 spacer DOM');
assert.equal(production.includes('.facility-card-spacer'), false, '生产布局不得保留 spacer CSS');
assert.equal(legacyIndustryStyles.includes('.production-grid {'), false, '旧产业样式不得控制生产主网格');
assert.equal(legacyIndustryStyles.includes('top: var(--space-3);'), false, '建设卡不得使用独立顶部间距');
assert.equal(legacyIndustryStyles.includes('max-height: calc(100dvh - var(--space-6));'), false, '建设卡不得维护旧最大高度');

for (const text of [
  '大于等于 `1600px` 时使用紧凑三列',
  '固定两列选择卡',
  '桌面详情卡高度由内容决定',
  '`--desktop-page-top-offset`',
  '`src/styles/facility-group-card-grid.css` 负责',
  '不得渲染无业务语义的 spacer DOM',
]) assert.equal(industry.includes(text), true, `产业设计缺少: ${text}`);

assert.equal(chrome.includes('页面顶部避让必须集中为 `--desktop-page-top-offset`'), true, '外壳设计缺少统一顶部避让规则');
assert.equal(readme.includes('大于等于 1600px 时建设卡、两列工厂集群选择器和自然高度的当前详情卡紧凑排列'), true, 'README 缺少桌面生产布局摘要');

console.log('桌面生产页单一布局权威、自然高度详情、两列集群与统一 sticky 间隔验证通过。');
""",
)

page = read("src/pages/ProductionPage.tsx")
facility = read(facility_path)
industry = read(industry_path)
design = read("docs/INDUSTRY_AND_PRODUCTION_DESIGN.md")
assert "facility-card-spacer" not in page
assert ".facility-card-spacer" not in facility
assert ".production-grid {" not in industry
assert "top: var(--space-3);" not in industry
assert "max-height: calc(100dvh - var(--space-6));" not in industry
assert "position: sticky;" in facility
assert "grid-template-columns: repeat(2, minmax(0, 1fr));" in facility
assert "不得渲染无业务语义的 spacer DOM" in design
