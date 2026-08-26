import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const write = (path, content) => writeFileSync(resolve(root, path), content, 'utf8');

function replaceOnce(path, before, after) {
  const content = read(path);
  const index = content.indexOf(before);
  if (index < 0) throw new Error(`${path}: replacement source not found: ${before.slice(0, 100)}`);
  if (content.indexOf(before, index + before.length) >= 0) throw new Error(`${path}: replacement source is not unique`);
  write(path, content.slice(0, index) + after + content.slice(index + before.length));
}

function replaceAll(path, before, after) {
  const content = read(path);
  if (!content.includes(before)) throw new Error(`${path}: replacement source not found: ${before}`);
  write(path, content.split(before).join(after));
}

function insertBefore(path, marker, insertion) {
  const content = read(path);
  if (content.includes(insertion.trim())) return;
  const index = content.indexOf(marker);
  if (index < 0) throw new Error(`${path}: insert marker not found: ${marker}`);
  write(path, content.slice(0, index) + insertion + content.slice(index));
}

function appendIfMissing(path, marker, appendix) {
  const content = read(path);
  if (content.includes(marker)) return;
  write(path, `${content.trimEnd()}\n\n${appendix.trim()}\n`);
}

// Formatters keep exact values available for inputs/tooltips while adding a compact money presentation.
replaceOnce(
  'src/utils/formatters.ts',
  "function formatFullNumber(value: number) {\n  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Math.round(value));\n}",
  "export function formatFullNumber(value: number) {\n  const normalized = Number.isFinite(value) ? value : 0;\n  return new Intl.NumberFormat('zh-CN', {\n    maximumFractionDigits: 6,\n    useGrouping: true,\n  }).format(normalized);\n}",
);
insertBefore(
  'src/utils/formatters.ts',
  'export function formatExactCurrency',
  "export function formatCompactCurrency(value: number) {\n  if (Number.isFinite(value) && value !== 0 && Math.abs(value) < 0.01) {\n    return value < 0 ? '-<0.01' : '<0.01';\n  }\n  const rounded = roundCurrencyForDisplay(value);\n  if (Math.abs(rounded) < 1_000) return formatCurrency(rounded);\n  return formatAbbreviatedNumber(rounded);\n}\n\n",
);
replaceOnce(
  'src/utils/formatters.ts',
  "  return Number.isInteger(value) && Number(value) > 0 ? `#${value}` : '#--';",
  "  return Number.isInteger(value) && Number(value) > 0 ? `#${formatNumber(Number(value))}` : '#--';",
);

// CurrencyAmount is the shared money surface: visible value compact, tooltip exact.
replaceOnce(
  'src/components/ui/CurrencyAmount.tsx',
  "import { Fragment, type ReactNode } from 'react';\nimport { CreditsIcon } from '../icons/GameIcons';",
  "import { Fragment, type ReactNode } from 'react';\nimport { CreditsIcon } from '../icons/GameIcons';\nimport { formatCompactCurrency, formatCurrency } from '../../utils/formatters';\nimport { SafeTooltip } from './SafeTooltip';",
);
insertBefore(
  'src/components/ui/CurrencyAmount.tsx',
  'export function CurrencyAmount',
  `function primitiveCurrency(children: ReactNode) {
  if (typeof children === 'number' && Number.isFinite(children)) {
    return { value: children, full: formatCurrency(children) };
  }
  if (typeof children !== 'string') return null;
  const normalized = children.trim();
  if (!/^-?(?:\\d{1,3}(?:,\\d{3})*|\\d+)(?:\\.\\d+)?$/.test(normalized)) return null;
  const value = Number(normalized.replaceAll(',', ''));
  return Number.isFinite(value) ? { value, full: normalized } : null;
}

function renderCurrencyValue(children: ReactNode, sign: ReactNode) {
  const primitive = primitiveCurrency(children);
  if (!primitive) return children;
  const signText = typeof sign === 'string' || typeof sign === 'number' ? String(sign) : '';
  return (
    <SafeTooltip content={\`${'${signText}'}${'${primitive.full}'}\`}>
      <span>{formatCompactCurrency(primitive.value)}</span>
    </SafeTooltip>
  );
}

`,
);
replaceOnce(
  'src/components/ui/CurrencyAmount.tsx',
  '<span className="currency-amount__value">{children}</span>',
  '<span className="currency-amount__value">{renderCurrencyValue(children, sign)}</span>',
);

// Shared avatar stylesheet is loaded before page-specific styles.
replaceOnce(
  'src/main.tsx',
  "import './styles/icon-system.css';",
  "import './styles/icon-system.css';\nimport './styles/player-avatar.css';",
);

// Existing profile write endpoint accepts only the already-resized avatar payload.
insertBefore(
  'src/api/game.ts',
  'export const gameActions = {',
  `export function updatePlayerAvatar(avatarData: string) {
  return request<GameActionResponse>('/profile', {
    method: 'PATCH',
    body: JSON.stringify({ avatarData }),
  });
}

`,
);

// Settings: preview and replace the avatar, never upload the original source image.
replaceOnce(
  'src/pages/SettingsPage.tsx',
  '  resetGameStateDelivery,\n  type SaveDeletionPreflight,',
  '  resetGameStateDelivery,\n  updatePlayerAvatar,\n  type SaveDeletionPreflight,',
);
replaceOnce(
  'src/pages/SettingsPage.tsx',
  "import { SelectInput, TextInput } from '../components/ui/FormControls';",
  "import { FileInput, SelectInput, TextInput } from '../components/ui/FormControls';\nimport { CompactNumber } from '../components/ui/CompactNumber';\nimport { PlayerAvatar } from '../components/ui/PlayerAvatar';",
);
replaceOnce(
  'src/pages/SettingsPage.tsx',
  "import { formatDate, formatNumber } from '../utils/formatters';",
  "import { formatDate } from '../utils/formatters';\nimport { announcePlayerAvatarUpdated, preparePlayerAvatar } from '../utils/playerAvatar';",
);
replaceOnce(
  'src/pages/SettingsPage.tsx',
  "  const avatarText = (game.playerName || user.email).slice(0, 1).toUpperCase();\n",
  '',
);
replaceOnce(
  'src/pages/SettingsPage.tsx',
  '  const [deletingSave, setDeletingSave] = useState(false);',
  "  const [deletingSave, setDeletingSave] = useState(false);\n  const [avatarUploading, setAvatarUploading] = useState(false);\n  const [avatarError, setAvatarError] = useState('');",
);
insertBefore(
  'src/pages/SettingsPage.tsx',
  '  function restartTutorial() {',
  `  async function changePlayerAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || avatarUploading) return;
    setAvatarUploading(true);
    setAvatarError('');
    try {
      const avatarData = await preparePlayerAvatar(file);
      const response = await updatePlayerAvatar(avatarData);
      if (!response.result.ok) throw new Error(response.result.message);
      announcePlayerAvatarUpdated(user.id);
      model.notify(response.result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : '头像更新失败';
      setAvatarError(message);
      model.notify(message);
    } finally {
      input.value = '';
      setAvatarUploading(false);
    }
  }

`,
);
replaceOnce(
  'src/pages/SettingsPage.tsx',
  '<div className="profile-avatar">{avatarText}</div>',
  '<PlayerAvatar userId={user.id} playerName={game.playerName || user.email} size={64} className="profile-avatar" />',
);
insertBefore(
  'src/pages/SettingsPage.tsx',
  '          <div className="nickname-editor">',
  `          <div className="avatar-editor">
            <FileInput
              label="玩家头像"
              accept="image/jpeg,image/png,image/webp"
              disabled={avatarUploading}
              error={avatarError || undefined}
              description={avatarUploading
                ? '正在本地裁剪并压缩头像…'
                : '原图只在浏览器本地处理；服务器只接收并加载 64×64 WebP 缩略图。'}
              onChange={(event) => void changePlayerAvatar(event)}
            />
          </div>

`,
);
replaceAll('src/pages/SettingsPage.tsx', '<strong>{formatNumber(facilityCount)}</strong>', '<strong><CompactNumber value={facilityCount} /></strong>');
replaceAll('src/pages/SettingsPage.tsx', '<strong>{formatNumber(game.stats.producedGoods)}</strong>', '<strong><CompactNumber value={game.stats.producedGoods} /></strong>');
replaceAll('src/pages/SettingsPage.tsx', '<strong>{formatNumber(game.stats.boughtGoods)}</strong>', '<strong><CompactNumber value={game.stats.boughtGoods} /></strong>');
replaceAll('src/pages/SettingsPage.tsx', '<strong>{formatNumber(game.stats.soldGoods)}</strong>', '<strong><CompactNumber value={game.stats.soldGoods} /></strong>');

// Leaderboard keeps the four-column layout but the second column is simply "玩家".
replaceOnce(
  'src/pages/LeaderboardPage.tsx',
  "import { CurrencyAmount } from '../components/ui/CurrencyAmount';",
  "import { CurrencyAmount } from '../components/ui/CurrencyAmount';\nimport { CompactNumber, CompactRank } from '../components/ui/CompactNumber';",
);
replaceOnce(
  'src/pages/LeaderboardPage.tsx',
  "import { formatCurrency, formatNumber, formatRank } from '../utils/formatters';",
  "import { formatCurrency, formatNumber } from '../utils/formatters';",
);
replaceOnce(
  'src/pages/LeaderboardPage.tsx',
  "  if (board.unit === 'quantity') return formatNumber(score);\n  return `${formatNumber(score)} 分`;",
  "  if (board.unit === 'quantity') return <CompactNumber value={score} />;\n  return <><CompactNumber value={score} /> 分</>;",
);
replaceOnce(
  'src/pages/LeaderboardPage.tsx',
  '>{formatRank(entry.rank)}</span>',
  '><CompactRank value={entry.rank} /></span>',
);
replaceOnce(
  'src/pages/LeaderboardPage.tsx',
  "<span className=\"leaderboard-reward\">{entry.rewardGems ? `◆ ${formatNumber(entry.rewardGems)}` : '—'}</span>",
  "<span className=\"leaderboard-reward\">{entry.rewardGems ? <>◆ <CompactNumber value={entry.rewardGems} /></> : '—'}</span>",
);
replaceAll('src/pages/LeaderboardPage.tsx', '<span>排名</span><span>头像名称</span><span>成绩</span><span>奖励</span>', '<span>排名</span><span>玩家</span><span>成绩</span><span>奖励</span>');
replaceOnce('src/pages/LeaderboardPage.tsx', '<strong>{formatRank(currentRank)}</strong>', '<strong><CompactRank value={currentRank} /></strong>');

// Status identity is a keyboard-accessible settings navigation control backed by the player avatar.
replaceOnce(
  'src/components/shell/StatusBar.tsx',
  "import { FrostedGlassSurface } from '../ui/FrostedGlassSurface';",
  "import { FrostedGlassSurface } from '../ui/FrostedGlassSurface';\nimport { PlayerAvatar } from '../ui/PlayerAvatar';",
);
replaceOnce(
  'src/components/shell/StatusBar.tsx',
  'export interface StatusBarIdentity {\n  logoSrc: string;\n  title: string;\n  playerName: string;\n}',
  'export interface StatusBarIdentity {\n  playerId: number;\n  title: string;\n  playerName: string;\n  onClick?: () => void;\n}',
);
insertBefore(
  'src/components/shell/StatusBar.tsx',
  'export function StatusBar({',
  `function StatusBarIdentityControl({ identity }: { identity: StatusBarIdentity }) {
  const content = (
    <>
      <PlayerAvatar userId={identity.playerId} playerName={identity.playerName} size={40} />
      <span className="asset-bar-identity-copy">
        <strong>{identity.title}</strong>
        <small title={identity.playerName}>{identity.playerName}</small>
      </span>
    </>
  );
  if (identity.onClick) {
    return (
      <button
        type="button"
        className="asset-bar-identity asset-bar-identity--interactive"
        aria-label={\`玩家 ${'${identity.playerName}'}，打开设置\`}
        onClick={identity.onClick}
      >
        {content}
      </button>
    );
  }
  return (
    <div className="asset-bar-identity" role="group" aria-label={\`${'${identity.title}'}，玩家 ${'${identity.playerName}'}\`}>
      {content}
    </div>
  );
}

`,
);
{
  const path = 'src/components/shell/StatusBar.tsx';
  let content = read(path);
  const pattern = /          <div\n            className="asset-bar-identity"[\s\S]*?          <\/div>\n          <div className="asset-bar-content" ref=\{contentRef\}>/;
  if (!pattern.test(content)) throw new Error(`${path}: identity DOM block not found`);
  content = content.replace(pattern, '          <StatusBarIdentityControl identity={identity} />\n          <div className="asset-bar-content" ref={contentRef}>');
  write(path, content);
}

// Game shell uses the shared compact display components for status quantities and rank.
replaceOnce(
  'src/components/shell/GameShell.tsx',
  "import { BRAND_LOGO_URL, BRAND_NAME } from '../../config/brand';",
  "import { BRAND_NAME } from '../../config/brand';",
);
replaceOnce(
  'src/components/shell/GameShell.tsx',
  "import { CurrencyAmount } from '../ui/CurrencyAmount';",
  "import { CurrencyAmount } from '../ui/CurrencyAmount';\nimport { CompactNumber, CompactRank } from '../ui/CompactNumber';",
);
replaceOnce(
  'src/components/shell/GameShell.tsx',
  "id: 'gems', icon: <GemIcon />, label: '宝石', value: formatNumber(game.gems),",
  "id: 'gems', icon: <GemIcon />, label: '宝石', value: <CompactNumber value={game.gems} /> ,",
);
replaceOnce(
  'src/components/shell/GameShell.tsx',
  'value: <span aria-label={rankLabel}>{formattedRank}</span>,',
  'value: <CompactRank value={derived.currentRank?.rank} ariaLabel={rankLabel} />,',
);
replaceOnce(
  'src/components/shell/GameShell.tsx',
  "id: 'warehouse', icon: <WarehouseIcon />, label: '仓库库存', value: formatNumber(game.warehouseStoredQuantity),",
  "id: 'warehouse', icon: <WarehouseIcon />, label: '仓库库存', value: <CompactNumber value={game.warehouseStoredQuantity} /> ,",
);
replaceOnce(
  'src/components/shell/GameShell.tsx',
  '                logoSrc: BRAND_LOGO_URL,\n                title: BRAND_NAME,\n                playerName,',
  "                playerId: model.user.id,\n                title: BRAND_NAME,\n                playerName,\n                onClick: () => selectPlayerTab('settings'),",
);

// Identity/button geometry keeps the current status track dimensions.
replaceOnce(
  'src/styles/notification-center.css',
  '/* Brand identity, five economic status values and notification tooling stay in',
  '/* Player identity, five economic status values and notification tooling stay in',
);
replaceOnce(
  'src/styles/notification-center.css',
  '  border-right: 1px solid var(--color-border);\n  padding: var(--space-1) var(--space-3);',
  '  border: 0;\n  border-right: 1px solid var(--color-border);\n  padding: var(--space-1) var(--space-3);\n  color: inherit;\n  background: transparent;\n  font: inherit;\n  text-align: left;',
);
replaceOnce(
  'src/styles/notification-center.css',
  '.asset-bar-identity,\n.asset-bar-content,',
  `.asset-bar-identity--interactive {
  cursor: pointer;
}

.asset-bar-identity--interactive:focus-visible {
  outline: 2px solid var(--color-success);
  outline-offset: -2px;
}

.asset-bar-identity,\n.asset-bar-content,`,
);
replaceAll('src/styles/notification-center.css', '.asset-bar-identity > img {', '.asset-bar-identity > .player-avatar {');
replaceAll('src/styles/mobile-status-layout.css', '.asset-bar-layout > .asset-bar-identity > img {', '.asset-bar-layout > .asset-bar-identity > .player-avatar {');
insertBefore(
  'src/styles/settings.css',
  '.nickname-editor {',
  `.avatar-editor {
  min-width: 0;
}

`,
);

// Runtime profile action extends the existing PATCH /profile transaction.
insertBefore(
  'server/src/runtime-action-executor.js',
  "import { validateResearchAccess } from './research.js';",
  "import { applyPlayerProfileAction } from './player-profile.js';\n",
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  "      } else if (action === 'checkIn') {",
  "      } else if (action === 'renamePlayer') {\n        gameResult = applyPlayerProfileAction(world, user, payload);\n      } else if (action === 'checkIn') {",
);

// Production host creates a dedicated static avatar directory writable only by the API service.
replaceOnce(
  'scripts/install-economy-api.py',
  'STATE_DIRECTORY = Path("/var/lib/riversoft-economy")\nREGISTRATION_SECRET_PATH',
  'STATE_DIRECTORY = Path("/var/lib/riversoft-economy")\nAVATAR_DIRECTORY = Path("/var/lib/riversoft-economy-avatars")\nREGISTRATION_SECRET_PATH',
);
replaceOnce(
  'scripts/install-economy-api.py',
  '    os.chmod(STATE_DIRECTORY, 0o750)\n    backup_before_contract_audit',
  '    os.chmod(STATE_DIRECTORY, 0o750)\n    AVATAR_DIRECTORY.mkdir(parents=True, exist_ok=True)\n    os.chown(AVATAR_DIRECTORY, account.pw_uid, account.pw_gid)\n    os.chmod(AVATAR_DIRECTORY, 0o755)\n    backup_before_contract_audit',
);
replaceOnce(
  'scripts/install-economy-api.py',
  "Environment=ECONOMY_DB_PATH={STATE_DIRECTORY / 'economy.sqlite'}",
  "Environment=ECONOMY_DB_PATH={STATE_DIRECTORY / 'economy.sqlite'}\nEnvironment=ECONOMY_AVATAR_DIR={AVATAR_DIRECTORY}",
);
replaceOnce(
  'scripts/install-economy-api.py',
  'ReadWritePaths={STATE_DIRECTORY}',
  'ReadWritePaths={STATE_DIRECTORY} {AVATAR_DIRECTORY}',
);

const avatarLocation = `    location ~ ^/economy-avatars/(?<avatar_id>[1-9][0-9]{0,15})\\.webp$ {
        alias /var/lib/riversoft-economy-avatars/$avatar_id.webp;
        default_type image/webp;
        add_header Cache-Control "no-cache, max-age=0, must-revalidate" always;
        add_header X-Content-Type-Options "nosniff" always;
    }

`;
insertBefore('deploy/nginx/game.riversoft.top.economy-location.conf', '    location ^~ /economy/ {', avatarLocation);

// Nginx configurator repairs the avatar static route independently of account/game proxy snippets.
insertBefore(
  'scripts/configure-economy-nginx.py',
  '\n\ndef managed_block',
  `

AVATAR_BLOCK = """
    location ~ ^/economy-avatars/(?<avatar_id>[1-9][0-9]{0,15})\\.webp$ {
        alias /var/lib/riversoft-economy-avatars/$avatar_id.webp;
        default_type image/webp;
        add_header Cache-Control "no-cache, max-age=0, must-revalidate" always;
        add_header X-Content-Type-Options "nosniff" always;
    }
""".strip("\\n")
`,
);
insertBefore(
  'scripts/configure-economy-nginx.py',
  '\n\ndef ensure_game_api_compression',
  `

def has_avatar_location(block: str) -> bool:
    return bool(re.search(r"\\blocation\\s+~\\s+\\^/economy-avatars/", masked(block), re.IGNORECASE))


def ensure_avatar_location(block: str) -> tuple[str, bool]:
    if has_avatar_location(block):
        return block, False
    closing = block.rfind("}")
    if closing < 0:
        raise RuntimeError("Target server block has no closing brace")
    normalized = block[:closing].rstrip()
    return normalized + "\\n\\n" + AVATAR_BLOCK + "\\n" + block[closing:], True
`,
);
replaceOnce(
  'scripts/configure-economy-nginx.py',
  '    cleaned, added_compression = ensure_game_api_compression(cleaned)\n    cleaned, added_static_compression',
  '    cleaned, added_compression = ensure_game_api_compression(cleaned)\n    cleaned, added_avatar = ensure_avatar_location(cleaned)\n    cleaned, added_static_compression',
);
replaceOnce(
  'scripts/configure-economy-nginx.py',
  'not added_compression and not added_static_compression and not added_static_vary',
  'not added_compression and not added_avatar and not added_static_compression and not added_static_vary',
);

// Exact browser inputs remain untouched; migrate plain JSX numeric text to shared tooltip surfaces.
function walkFiles(directory) {
  const entries = [];
  for (const name of readdirSync(directory)) {
    const absolute = resolve(directory, name);
    if (statSync(absolute).isDirectory()) entries.push(...walkFiles(absolute));
    else entries.push(absolute);
  }
  return entries;
}

function migrateNumericJsx() {
  const targetRoot = resolve(root, 'src');
  for (const absolute of walkFiles(targetRoot)) {
    if (!absolute.endsWith('.tsx')) continue;
    const relativePath = relative(root, absolute).replaceAll('\\\\', '/');
    if (relativePath === 'src/components/ui/CompactNumber.tsx') continue;
    let source = readFileSync(absolute, 'utf8');
    if (source.includes("components/ui/CompactNumber'") || source.includes("../ui/CompactNumber'")) continue;
    const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const edits = [];
    const needed = new Set();

    function tagName(node) {
      if (ts.isJsxElement(node)) return node.openingElement.tagName.getText(sourceFile);
      if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText(sourceFile);
      return '';
    }

    function visit(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments.length === 1) {
        const name = node.expression.text;
        if (name === 'formatNumber' || name === 'formatCurrency' || name === 'formatRank') {
          const expression = node.parent;
          if (ts.isJsxExpression(expression)) {
            let eligible = false;
            let enclosingTag = '';
            const container = expression.parent;
            if (ts.isJsxElement(container)) {
              eligible = true;
              enclosingTag = tagName(container);
            } else if (ts.isJsxAttribute(container) && container.name.getText(sourceFile) === 'value') {
              const opening = container.parent.parent;
              enclosingTag = tagName(opening);
              eligible = enclosingTag === 'DataRow' || enclosingTag === 'MetricCard';
            }
            if (eligible && !(name === 'formatCurrency' && enclosingTag === 'CurrencyAmount')) {
              const component = name === 'formatNumber' ? 'CompactNumber' : name === 'formatCurrency' ? 'CompactCurrency' : 'CompactRank';
              const argument = node.arguments[0].getText(sourceFile);
              edits.push({
                start: node.getStart(sourceFile),
                end: node.getEnd(),
                text: `<${component} value={${argument}} />`,
              });
              needed.add(component);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    if (!edits.length) continue;
    edits.sort((left, right) => right.start - left.start);
    for (const edit of edits) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);

    const compactModule = resolve(root, 'src/components/ui/CompactNumber');
    let importPath = relative(dirname(absolute), compactModule).replaceAll('\\\\', '/');
    if (!importPath.startsWith('.')) importPath = `./${importPath}`;
    const imports = [...sourceFile.statements].filter(ts.isImportDeclaration);
    const insertion = imports.length ? imports[imports.length - 1].end : 0;
    const importLine = `\nimport { ${[...needed].sort().join(', ')} } from '${importPath}';`;
    source = source.slice(0, insertion) + importLine + source.slice(insertion);
    writeFileSync(absolute, source, 'utf8');
  }
}
migrateNumericJsx();

// Static checks follow the new final behavior.
replaceOnce(
  'scripts/verify-display-format.mjs',
  "import { formatCurrency, formatDuration, formatNumber, formatRank } from '../src/utils/formatters.ts';",
  "import { formatCompactCurrency, formatCurrency, formatDuration, formatFullNumber, formatNumber, formatRank } from '../src/utils/formatters.ts';",
);
insertBefore(
  'scripts/verify-display-format.mjs',
  'try {\n  assert.equal(formatCurrency(1_280)',
  `try {
  assert.equal(formatFullNumber(12_500), '12,500');
  assert.equal(formatCompactCurrency(1_280), '1.3K');
} catch {
  failures.push('完整数字或紧凑货币格式异常');
}

`,
);
replaceOnce(
  'scripts/verify-display-format.mjs',
  "requireText('src/components/shell/GameShell.tsx', ['formatRank(', 'aria-label={rankLabel}']);",
  "requireText('src/components/shell/GameShell.tsx', ['<CompactRank', 'ariaLabel={rankLabel}']);\nrequireText('src/components/ui/CompactNumber.tsx', ['SafeTooltip', 'formatFullNumber(value)', 'formatCompactCurrency(value)']);\nrequireText('src/components/ui/CurrencyAmount.tsx', ['SafeTooltip', 'formatCompactCurrency(primitive.value)']);",
);
replaceAll('scripts/verify-display-format.mjs', "'`formatCurrency` 继续遵守普通货币两位显示精度',", "'完整数字 Tooltip',");
replaceOnce(
  'scripts/verify-display-format.mjs',
  "console.log('显示格式验证通过：数量固定使用紧凑格式，货币保持两位精度，持续时间使用 s/m/h，排名使用 #N。');",
  "console.log('显示格式验证通过：只读数量、货币与排名统一紧凑显示并提供完整数字 Tooltip，输入继续使用精确值。');",
);

replaceAll('scripts/verify-leaderboards.mjs', "if (board.unit === 'quantity') return formatNumber(score);", "if (board.unit === 'quantity') return <CompactNumber value={score} />;");
replaceAll('scripts/verify-leaderboards.mjs', '排名｜头像名称｜成绩｜奖励', '排名｜玩家｜成绩｜奖励');
replaceAll('scripts/verify-leaderboards.mjs', '<span>排名</span><span>头像名称</span><span>成绩</span><span>奖励</span>', '<span>排名</span><span>玩家</span><span>成绩</span><span>奖励</span>');
replaceAll('scripts/verify-leaderboards.mjs', "['排名', '头像名称', '成绩', '奖励']", "['排名', '玩家', '成绩', '奖励']");
replaceAll('scripts/verify-leaderboards.mjs', '头像名称列', '玩家列');
replaceAll('scripts/verify-leaderboards.mjs', '头像名称', '玩家');

replaceAll('tests/browser/all-pages-preview.spec.ts', '头像名称', '玩家');

replaceOnce(
  'scripts/verify-game-shell-layout.mjs',
  "  'logoSrc: BRAND_LOGO_URL',\n  'title: BRAND_NAME',\n  'playerName,',",
  "  'playerId: model.user.id',\n  'title: BRAND_NAME',\n  'playerName,',\n  \"onClick: () => selectPlayerTab('settings')\",",
);
replaceOnce(
  'scripts/verify-game-shell-layout.mjs',
  "  'className=\"asset-bar-identity-copy\"',",
  "  'className=\"asset-bar-identity-copy\"',\n  '<PlayerAvatar',\n  'identity.onClick',",
);

replaceOnce(
  'scripts/verify-settings-layout.mjs',
  "    '删除存档',",
  "    '删除存档',\n    '<PlayerAvatar',\n    '<FileInput',\n    '64×64 WebP',",
);

// Package verification runs avatar-specific checks as part of every build.
replaceOnce(
  'package.json',
  '    "verify:mobile-status-value-fit": "node scripts/verify-mobile-status-value-fit.mjs",',
  '    "verify:mobile-status-value-fit": "node scripts/verify-mobile-status-value-fit.mjs",\n    "verify:player-avatar": "node scripts/verify-player-avatar.mjs",',
);
replaceOnce(
  'package.json',
  'node scripts/verify-settings-layout.mjs && node scripts/verify-save-deletion.mjs',
  'node scripts/verify-settings-layout.mjs && npm run verify:player-avatar && node scripts/verify-save-deletion.mjs',
);

// Authority docs: keep only the final rule, replacing the superseded currency/logo/leaderboard wording.
replaceOnce(
  'docs/UI_DESIGN_SYSTEM.md',
  '| `src/styles/icon-system.css` | 全局 SVG 图标尺寸、商品图标标签、货币金额、导航图标槽位和移动图标尺寸 |',
  '| `src/styles/icon-system.css` | 全局 SVG 图标尺寸、商品图标标签、货币金额、导航图标槽位和移动图标尺寸 |\n| `src/styles/player-avatar.css` | 玩家 64px 头像、缺省首字符回退与圆形裁切的共享视觉 |',
);
replaceAll(
  'docs/UI_DESIGN_SYSTEM.md',
  '- “紧凑数字”是全局固定显示规则，不再是客户端偏好；`formatNumber` 与 `formatCompactNumber` 对绝对值达到 1,000 的数量类显示统一使用 K/M/B/T，不提供关闭入口或按设备分流。\n- `formatCurrency` 继续遵守普通货币两位显示精度，不因全局紧凑数量规则改写金额格式；排名、百分比、时间、时长和可编辑数字输入保持精确原值。',
  '- “紧凑数字”是全局固定显示规则，不再是客户端偏好；数量、普通货币与排名等只读业务数值对绝对值达到 1,000 的内容统一使用 K/M/B/T，不提供关闭入口或按设备分流。日期、时间、时长和百分比继续使用各自语义格式，可编辑数字输入始终显示并提交完整原值。\n- 所有紧凑只读数值必须复用 `CompactNumber`／`CompactCurrency`／`CompactRank` 或 `CurrencyAmount`；鼠标悬停和键盘聚焦统一通过 `SafeTooltip` 的毛玻璃浮层显示完整分组数字。`formatCurrency` 继续保留普通货币两位精确格式，供输入、完整数字 Tooltip 和精度边界使用，紧凑化只改变只读呈现。',
);
insertBefore(
  'docs/UI_DESIGN_SYSTEM.md',
  '- `CurrencyAmount`',
  '- `CompactNumber`\n- `CompactCurrency`\n- `CompactRank`\n- `PlayerAvatar`\n',
);
appendIfMissing(
  'docs/UI_DESIGN_SYSTEM.md',
  '玩家头像资源固定使用服务器实际 64×64 WebP',
  `### 玩家头像

玩家头像统一由 \`PlayerAvatar\` 渲染。服务器实际资源固定为 64×64 WebP；加载失败或旧玩家尚未设置头像时使用玩家名称首字符作为本地回退，不请求大图。设置页选择原图后必须先在浏览器本地居中裁成正方形、缩放至 64×64 并压缩，再上传最终缩略图；原图不得发送到服务器。状态栏和设置页不得各自实现第二套头像加载逻辑。`,
);

replaceAll('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '头像名称', '玩家');
replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '玩家 Logo、游戏标题和玩家名统一位于状态栏左侧身份轨道，不得在玩家侧栏重复；',
  '状态栏左侧玩家头像、游戏标题和玩家名统一位于身份轨道，不得在玩家侧栏重复；身份轨道整体作为只读导航入口，点击或键盘激活统一进入设置页，不直接执行资料写操作；',
);
appendIfMissing(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '设置页玩家资料允许上传头像',
  `设置页玩家资料允许上传头像。原图只在浏览器本地处理，上传前必须居中裁切并压缩为 64×64 WebP；状态栏只加载该 64px 资源并以玩家名称首字符作为缺省回退。排行榜第二列名称固定为“玩家”，仍保持“排名｜玩家｜成绩｜奖励”四列单行结构。`,
);

replaceOnce(
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  '- 状态栏中的数量类值遵循全局固定紧凑数字规则，桌面和移动端统一使用 K/M/B/T；货币值继续遵守两位显示精度，不再存在关闭紧凑数字后切换数量格式的分支。',
  '- 状态栏中的数量、普通货币与排名等只读业务数值遵循全局固定紧凑规则，桌面和移动端统一使用 K/M/B/T；悬停或键盘聚焦时通过共享 Tooltip 显示完整数字，状态栏不得恢复只在移动端紧凑或让桌面货币长期占用完整数字宽度。',
);
replaceOnce(
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  '- 玩家状态栏 DOM 固定为 `header.asset-bar → FrostedGlassSurface → .frosted-glass-surface__content → .asset-bar-layout`，内部依次为身份轨道、五列状态项和通知工具位；',
  '- 玩家状态栏 DOM 固定为 `header.asset-bar → FrostedGlassSurface → .frosted-glass-surface__content → .asset-bar-layout`，内部依次为可点击的玩家身份轨道、五列状态项和通知工具位；身份轨道使用共享 `PlayerAvatar` 加载服务器实际 64×64 WebP，点击或键盘激活只导航到设置页；',
);

appendIfMissing(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '## 玩家头像静态资源',
  `## 玩家头像静态资源

玩家头像是展示资源，不进入 EconomyState、状态分区或五秒轮询。设置页继续复用 \`PATCH /api/game/profile\` 写入口；浏览器必须先把原图居中裁切、缩放并编码为 64×64 WebP，最终请求体中的头像数据不得超过 8 KiB，服务器再次校验 WebP 容器、64×64 实际尺寸和体积后才允许原子替换文件。

生产头像目录固定为 \`/var/lib/riversoft-economy-avatars\`，由 Economy API 服务用户写入，Nginx 只读并通过 \`/economy-avatars/<userId>.webp\` 提供 \`image/webp\`。资源使用重新验证缓存而不是把图片字节写入游戏 JSON；头像更新后客户端只给 64px URL 增加本地版本查询参数触发重取。这样状态轮询大小不随头像增长，玩家选择的原始大图也不会产生服务器上传流量。`,
);
replaceOnce(
  'docs/README.md',
  'API、容量限制、Nginx、systemd 和部署',
  'API、64×64 玩家头像静态资源、容量限制、Nginx、systemd 和部署',
);
replaceAll('docs/README.md', '头像名称', '玩家');
appendIfMissing(
  'README.md',
  '### 玩家头像资源',
  `### 玩家头像资源

设置页头像原图只在浏览器本地处理，上传前固定转换为 64×64 WebP（最终不超过 8 KiB）；生产文件位于 \`/var/lib/riversoft-economy-avatars\`，由 \`/economy-avatars/<userId>.webp\` 只读提供，不进入 EconomyState 或状态轮询。`,
);

console.log('Applied player avatar and compact-number final behavior.');
