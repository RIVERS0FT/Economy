from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, got {count}: {old[:120]!r}')
    target.write_text(text.replace(old, new), encoding='utf-8')


replace_once(
    'src/pages/ContractPage.tsx',
    "    <PagePanel\n      className={`contract-card contract-card--${contract.graceEndsAt ? 'danger' : needsAttention ? 'attention' : 'normal'}`}\n      data-attention={needsAttention ? 'true' : 'false'}\n    >",
    "    <PagePanel className={`contract-card contract-card--${contract.graceEndsAt ? 'danger' : needsAttention ? 'attention' : 'normal'}`}>",
)

replace_once(
    'src/styles/contracts.css',
    '.contract-card--attention[data-attention="true"] {',
    '.contract-workspace .contract-card--attention {',
)

replace_once(
    'tests/browser/contract-layout.spec.ts',
    "  await expect(page.getByRole('checkbox', { name: '自动补充货款' })).toBeVisible();",
    "  const autoFundToggles = page.getByRole('checkbox', { name: '自动补充货款' });\n  await expect(autoFundToggles).toHaveCount(2);\n  await expect(autoFundToggles.first()).toBeVisible();",
)

replace_once(
    'tests/browser/contract-layout.spec.ts',
    "  await expect(page.locator('.contract-active-grid .contract-card').first()).toHaveAttribute('data-attention', 'true');",
    "  await expect(page.locator('.contract-active-grid .contract-card').first()).toHaveClass(/contract-card--attention/);",
)

replace_once(
    'scripts/verify-page-content.mjs',
    "  'data-attention={needsAttention',",
    "  \"contract.graceEndsAt ? 'danger' : needsAttention ? 'attention' : 'normal'\",",
)

replace_once(
    'scripts/verify-contract-layout.mjs',
    "  'data-attention={needsAttention',",
    "  \"contract.graceEndsAt ? 'danger' : needsAttention ? 'attention' : 'normal'\",",
)

replace_once(
    'scripts/verify-contract-layout.mjs',
    "  '.contract-card--attention[data-attention=\"true\"]',",
    "  '.contract-workspace .contract-card--attention {',",
)

replace_once(
    'scripts/verify-contract-layout.mjs',
    "  \"page.locator('.contract-active-grid')\",\n  \"toHaveAttribute('data-attention', 'true')\",\n]) requireText(browserTestPath, text);",
    "  \"page.locator('.contract-active-grid')\",\n  'toHaveClass(/contract-card--attention/)',\n]) requireText(browserTestPath, text);",
)

replace_once(
    'scripts/verify-contract-layout.mjs',
    "  \"getByRole('tab', { name: '历史合同', exact: true })\",\n  \"toHaveAttribute('data-attention', 'true')\",\n  \"toHaveAttribute('data-attention', 'false')\",\n]) requireText(workspaceTestPath, text);",
    "  \"getByRole('tab', { name: '历史合同', exact: true })\",\n  'toHaveClass(/contract-card--attention/)',\n  'toHaveClass(/contract-card--normal/)',\n]) requireText(workspaceTestPath, text);",
)
