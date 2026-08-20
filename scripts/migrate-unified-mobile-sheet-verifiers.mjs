import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, from, to) {
  const source = readFileSync(path, 'utf8');
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`${path}: missing migration source: ${from.slice(0, 120)}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`${path}: migration source is not unique`);
  writeFileSync(path, source.slice(0, first) + to + source.slice(first + from.length));
}

replaceOnce(
  'scripts/verify-overlay-scrollbars.mjs',
  "  facilitySheet: 'src/components/ui/MobileWorkspaceDetailSheet.tsx',\n  facilitySheetStyles: 'src/styles/mobile-detail-sheet.css',",
  "  facilitySheet: 'src/components/ui/MobileWorkspaceDetailSheet.tsx',\n  facilitySheetHost: 'src/components/ui/MobileWorkspaceSheetHost.tsx',\n  facilitySheetStyles: 'src/styles/mobile-detail-sheet.css',",
);
replaceOnce(
  'scripts/verify-overlay-scrollbars.mjs',
  "]) requireText(paths.facilitySheet, text);\n  requireText(paths.facilitySheetStyles, 'padding: var(--space-2) var(--space-3);');",
  "]) requireText(paths.facilitySheetHost, text);\n  requireText(paths.facilitySheet, 'createPortal(children, host.detailContentLayer)');\n  requireText(paths.facilitySheetStyles, 'padding: var(--space-2) var(--space-3);');",
);

replaceOnce(
  'scripts/verify-interaction-modality.mjs',
  "const mobileDetailPath = 'src/components/ui/MobileWorkspaceDetailSheet.tsx';\nconst requiredFiles = [",
  "const mobileDetailPath = 'src/components/ui/MobileWorkspaceDetailSheet.tsx';\nconst mobileSheetHostPath = 'src/components/ui/MobileWorkspaceSheetHost.tsx';\nconst requiredFiles = [",
);
replaceOnce(
  'scripts/verify-interaction-modality.mjs',
  "  mobileDetailPath,\n  'src/styles/facility-group-card-grid.css',",
  "  mobileDetailPath,\n  mobileSheetHostPath,\n  'src/styles/facility-group-card-grid.css',",
);
replaceOnce(
  'scripts/verify-interaction-modality.mjs',
  "  requireText(mobileDetailPath, 'returnFocusRef.current?.focus({ preventScroll: true })');",
  "  requireText(mobileDetailPath, 'returnFocusRef = returnFocusRef;');\n  requireText(mobileSheetHostPath, 'previousDetail.controllerRef.current.returnFocusRef.current?.focus({ preventScroll: true })');",
);

replaceOnce(
  'scripts/verify-facility-groups.mjs',
  "  'src/components/ui/MobileWorkspaceDetailSheet.tsx',\n  'src/components/ui/MobileDetailSummary.tsx',",
  "  'src/components/ui/MobileWorkspaceDetailSheet.tsx',\n  'src/components/ui/MobileWorkspaceSheetHost.tsx',\n  'src/components/ui/MobileDetailSummary.tsx',",
);
replaceOnce(
  'scripts/verify-facility-groups.mjs',
  "for (const text of [\n  'useLayoutEffect',\n  \"window.visualViewport?.height ?? window.innerHeight\",\n  \"sheet?.focus({ preventScroll: true });\",\n  \"returnFocusRef.current?.focus({ preventScroll: true })\",\n  'const onCloseRef = useRef(onClose);',\n  'onCloseRef.current();',\n]) requireText('src/components/ui/MobileWorkspaceDetailSheet.tsx', text);",
  "for (const text of [\n  'useLayoutEffect',\n  \"window.visualViewport?.height ?? window.innerHeight\",\n  \"root.focus({ preventScroll: true });\",\n  \"previousDetail.controllerRef.current.returnFocusRef.current?.focus({ preventScroll: true })\",\n]) requireText('src/components/ui/MobileWorkspaceSheetHost.tsx', text);\nfor (const text of [\n  'const onCloseRef = useRef(onClose);',\n  'onCloseRef.current();',\n  'createPortal(children, host.detailContentLayer)',\n]) requireText('src/components/ui/MobileWorkspaceDetailSheet.tsx', text);",
);

replaceOnce(
  'scripts/verify-warehouse-expansion.mjs',
  "  '必须覆盖完整移动视口的模态业务详情统一作为二级 Detail Sheet',\n  '移动工厂详情、移动研发详情与市场自动交易设置必须共同复用 `MobileWorkspaceDetailSheet`',",
  "  '所有玩家业务页面与业务详情共用同一个唯一根级 Mobile Workspace Sheet',\n  '`MobileWorkspaceDetailSheet` API',\n  '不得创建第二个 Sheet DOM',",
);

replaceOnce(
  'docs/UI_DESIGN_SYSTEM.md',
  '任何业务页、工厂详情、研发详情或自动交易设置都不得创建嵌套 `.mobile-detail-sheet`、第二个 backdrop、第二个根级 Portal 或平行拖动状态机。',
  '任何业务页、工厂详情、研发详情或自动交易设置都不得创建嵌套 `.mobile-detail-sheet`、第二个 backdrop、第二个根级 Portal 或平行拖动状态机。市场自动交易详情继续复用统一商品选择器、采购／出售页签和既有仓库表单信息层级，并把原子保存动作放在唯一 Host 的固定底栏。',
);

console.log('Unified mobile sheet verifier migration completed.');
