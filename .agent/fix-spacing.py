from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    if text.count(old) != 1:
        raise SystemExit(f'{path}: expected exactly one match for {old[:80]!r}')
    target.write_text(text.replace(old, new), encoding='utf-8')


replace_once(
    'src/styles/contracts.css',
    '  gap: var(--page-section-gap);\n',
    '  gap: var(--layout-gutter);\n',
)

replace_once(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '合同摘要网格、可选发布面板和四列合同工作区必须按该顺序作为 `PageLayout` 自动生成的 `.ui-page-stack` 直接子元素；工作区内部左右区域使用 `--page-section-gap`，各区标题与卡片网格使用设计令牌间距，`contracts.css` 不得用外边距补齐或取消一级区块间隔。该规则的结构静态检查和桌面／平板／移动真实几何回归必须随合同布局验证一起运行。',
    '合同摘要网格、可选发布面板和四列合同工作区必须按该顺序作为 `PageLayout` 自动生成的 `.ui-page-stack` 直接子元素；一级区块间距只由共享 `.ui-page-stack` 的 `--page-section-gap` 管理，工作区内部左右区域使用 `var(--layout-gutter)`，各区标题与卡片网格使用设计令牌间距，`contracts.css` 不得直接引用 `--page-section-gap`、使用外边距补齐或取消一级区块间隔。该规则的结构静态检查和桌面／平板／移动真实几何回归必须随合同布局验证一起运行。',
)

replace_once(
    'scripts/verify-page-content.mjs',
    "  'data-attention={needsAttention',\n]) requireText('src/pages/ContractPage.tsx', text);\nfor (const text of [\n  'collectibleId',",
    "  'data-attention={needsAttention',\n]) requireText('src/pages/ContractPage.tsx', text);\nfor (const text of [\n  '.contract-workspace {',\n  'gap: var(--layout-gutter);',\n]) requireText('src/styles/contracts.css', text);\nrequireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '工作区内部左右区域使用 `var(--layout-gutter)`');\nfor (const text of [\n  'collectibleId',",
)
