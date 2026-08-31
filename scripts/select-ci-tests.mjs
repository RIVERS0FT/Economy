import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();

const FULL_TRIGGER_PATTERNS = [
  /^package(?:-lock)?\.json$/,
  /^tsconfig(?:\.[^/]+)?\.json$/,
  /^vite\.config\./,
  /^playwright\.config\./,
  /^postcss\.config\./,
  /^\.github\/workflows\//,
  /^scripts\/select-ci-tests\.mjs$/,
  /^scripts\/verify-deployment-pipeline\.mjs$/,
  /^scripts\/prepare-playwright-chromium\.sh$/,
  /^src\/main\.tsx$/,
  /^src\/app\/GameApp\.tsx$/,
  /^src\/app\/gameViewModel\.ts$/,
  /^src\/styles\/(?:index|globals?|tokens?|theme)\.[^/]+$/,
  /^shared\//,
  /^server\/shared\//,
  /^server\/src\/(?:app|domain|domain-core|storage|runtime-store|runtime-store-core|state-partitions|order-book-runtime)\.js$/,
];

const DOMAIN_RULES = [
  {
    name: 'market',
    source: /(?:market|order|trade|warehouse|asset)/i,
    candidate: /(?:market|order|trade|warehouse|asset)/i,
  },
  {
    name: 'facility',
    source: /(?:facility|factory|building|production|recipe|industry)/i,
    candidate: /(?:facility|factory|building|production|recipe|industry)/i,
  },
  {
    name: 'province',
    source: /(?:province|region|map)/i,
    candidate: /(?:province|region|map)/i,
  },
  {
    name: 'shell',
    source: /(?:navigation|sidebar|outliner|tutorial|notification|mobile|shell|page-sheet|liquid-glass|chrome)/i,
    candidate: /(?:navigation|sidebar|outliner|tutorial|notification|mobile|shell|page-sheet|layout|application|liquid-glass|chrome)/i,
  },
  {
    name: 'auth',
    source: /(?:auth|registration|invite|invitation|ban|login)/i,
    candidate: /(?:auth|registration|invite|invitation|ban|login)/i,
  },
  {
    name: 'banking',
    source: /(?:bank|loan|deposit|cash-settlement)/i,
    candidate: /(?:bank|loan|deposit|cash-settlement)/i,
  },
  {
    name: 'contract',
    source: /contract/i,
    candidate: /contract/i,
  },
  {
    name: 'auction',
    source: /auction/i,
    candidate: /auction/i,
  },
  {
    name: 'admin',
    source: /(?:admin|gift-code|population-policy)/i,
    candidate: /(?:admin|gift-code|population-policy)/i,
  },
  {
    name: 'research',
    source: /research/i,
    candidate: /research/i,
  },
  {
    name: 'settings',
    source: /settings/i,
    candidate: /settings/i,
  },
  {
    name: 'leaderboards',
    source: /(?:leaderboard|ranking)/i,
    candidate: /(?:leaderboard|ranking)/i,
  },
  {
    name: 'overview',
    source: /(?:overview|daily-check-in|check-in)/i,
    candidate: /(?:overview|daily-check-in|check-in)/i,
  },
];

const DOMAIN_BROWSER_BASELINES = new Map([
  ['facility', ['tests/browser/all-pages-preview.spec.ts']],
]);

const COMPOSED_VERIFY_ENTRYPOINTS = new Map([
  ['scripts/verify-market-page-layout-regional.mjs', 'scripts/verify-market-page-layout.mjs'],
]);

const normalizePath = (path) => path.replaceAll('\\', '/').replace(/^\.\//, '');

const uniquePaths = (paths) => [...new Set(paths.map(normalizePath).filter(Boolean))].sort();

const listFiles = (root, directory, predicate) => {
  const absoluteDirectory = resolve(root, directory);
  if (!existsSync(absoluteDirectory)) return [];
  const files = [];
  const visit = (absolutePath) => {
    for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
      const child = join(absolutePath, entry.name);
      if (entry.isDirectory()) {
        visit(child);
      } else if (entry.isFile()) {
        const repoPath = normalizePath(relative(root, child));
        if (!predicate || predicate(repoPath)) files.push(repoPath);
      }
    }
  };
  visit(absoluteDirectory);
  return files.sort();
};

const commandKey = (command) => JSON.stringify(command);

const addCommand = (commands, seen, command, args = []) => {
  const item = { command, args };
  const key = commandKey(item);
  if (seen.has(key)) return;
  seen.add(key);
  commands.push(item);
};

const getReferenceTokens = (path) => {
  const normalized = normalizePath(path);
  const fileName = basename(normalized);
  const extension = extname(fileName);
  const stem = extension ? fileName.slice(0, -extension.length) : fileName;
  const tokens = new Set([normalized, fileName]);
  if (stem.length >= 5) tokens.add(stem);
  if (normalized.startsWith('src/')) tokens.add(normalized.slice('src/'.length));
  if (normalized.startsWith('server/src/')) tokens.add(normalized.slice('server/src/'.length));
  return [...tokens].filter((token) => token.length >= 5);
};

const candidateReferencesAnyChangedFile = (root, candidate, changedFiles) => {
  let content = '';
  try {
    content = readFileSync(resolve(root, candidate), 'utf8');
  } catch {
    return false;
  }
  return changedFiles.some((changedFile) => getReferenceTokens(changedFile).some((token) => content.includes(token)));
};

const inferDomains = (changedFiles) => DOMAIN_RULES.filter((rule) => changedFiles.some((path) => rule.source.test(path)));

const isDocumentationOnly = (path) => /^(?:docs\/.*\.md|README\.md|AGENTS\.md)$/.test(path);
const isFrontendSource = (path) => /^(?:src\/|index\.html$|all-pages-preview\.html$|.*-runtime-test\.html$)/.test(path);
const isServerSource = (path) => /^server\/src\/.*\.js$/.test(path);
const isVerificationScript = (path) => /^scripts\/verify-[^/]+\.mjs$/.test(path);
const isServerTest = (path) => /^server\/test\/.*\.test\.js$/.test(path);
const isBrowserSpec = (path) => /^tests\/browser\/.*\.spec\.ts$/.test(path);
const isBrowserHarness = (path) => /^tests\/browser\/.*(?:harness|fixture).*\.(?:ts|tsx)$/.test(path);

const verificationNeedsDependencies = (root, path) => {
  let content = '';
  try {
    content = readFileSync(resolve(root, path), 'utf8');
  } catch {
    return false;
  }
  const importPattern = /(?:from\s*|import\s*\(\s*)['\"]([^'\"]+)['\"]/g;
  for (const match of content.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith('node:') && !specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('data:')) return true;
  }
  return false;
};

const findFullTrigger = (changedFiles) => changedFiles.find((path) => FULL_TRIGGER_PATTERNS.some((pattern) => pattern.test(path)));
const verificationEntrypoint = (path) => COMPOSED_VERIFY_ENTRYPOINTS.get(path) ?? path;

export function selectCiPlan(inputFiles, { root = ROOT, forceFull = false } = {}) {
  const changedFiles = uniquePaths(inputFiles);
  const plan = {
    mode: 'targeted',
    reasons: [],
    changedFiles,
    needsDependencies: false,
    checks: [],
    browser: { mode: 'none', tests: [] },
  };

  if (forceFull) {
    plan.mode = 'full';
    plan.reasons.push('manual-full-run');
    plan.needsDependencies = true;
    plan.browser = { mode: 'all', tests: [] };
    return plan;
  }

  if (changedFiles.length === 0) {
    plan.mode = 'full';
    plan.reasons.push('no-changed-files');
    plan.needsDependencies = true;
    plan.browser = { mode: 'all', tests: [] };
    return plan;
  }

  const fullTrigger = findFullTrigger(changedFiles);
  if (fullTrigger) {
    plan.mode = 'full';
    plan.reasons.push(`high-risk:${fullTrigger}`);
    plan.needsDependencies = true;
    plan.browser = { mode: 'all', tests: [] };
    return plan;
  }

  const commands = [];
  const seenCommands = new Set();
  addCommand(commands, seenCommands, 'node', ['scripts/verify-deployment-pipeline.mjs']);
  addCommand(commands, seenCommands, 'node', ['scripts/verify-runtime-reliability.mjs']);
  addCommand(commands, seenCommands, 'npm', ['run', 'verify:repository-text-format']);

  const documentationChanges = changedFiles.filter(isDocumentationOnly);
  if (documentationChanges.length > 0) {
    addCommand(commands, seenCommands, 'node', ['scripts/verify-document-authority.mjs']);
  }

  const frontendChanges = changedFiles.filter(isFrontendSource);
  if (frontendChanges.length > 0) {
    plan.needsDependencies = true;
    addCommand(commands, seenCommands, 'npm', ['run', 'generate:artwork']);
    addCommand(commands, seenCommands, 'npm', ['run', 'typecheck']);
    addCommand(commands, seenCommands, './node_modules/.bin/vite', ['build']);
  }

  const serverChanges = changedFiles.filter(isServerSource);
  if (serverChanges.length > 0) {
    plan.needsDependencies = true;
    addCommand(commands, seenCommands, 'npm', ['run', 'server:check']);
  }

  for (const path of changedFiles.filter(isVerificationScript)) {
    const entrypoint = verificationEntrypoint(path);
    addCommand(commands, seenCommands, 'node', [entrypoint]);
    if (verificationNeedsDependencies(root, entrypoint)) plan.needsDependencies = true;
  }
  for (const path of changedFiles.filter(isServerTest)) {
    plan.needsDependencies = true;
    addCommand(commands, seenCommands, 'node', ['--test', path]);
  }

  const verifyCandidates = listFiles(root, 'scripts', (path) => /^scripts\/verify-[^/]+\.mjs$/.test(path) && !COMPOSED_VERIFY_ENTRYPOINTS.has(path));
  const serverTestCandidates = listFiles(root, 'server/test', (path) => /^server\/test\/.*\.test\.js$/.test(path));
  const browserCandidates = listFiles(root, 'tests/browser', (path) => /^tests\/browser\/.*\.spec\.ts$/.test(path));
  const domains = inferDomains(changedFiles);

  const isDomainCandidate = (candidate) => domains.some((rule) => rule.candidate.test(candidate));
  const isReferenceCandidate = (candidate) => candidateReferencesAnyChangedFile(root, candidate, changedFiles);

  for (const candidate of verifyCandidates) {
    if (isDomainCandidate(candidate) || isReferenceCandidate(candidate)) {
      addCommand(commands, seenCommands, 'node', [candidate]);
      if (verificationNeedsDependencies(root, candidate)) plan.needsDependencies = true;
    }
  }

  const selectedServerTests = new Set(changedFiles.filter(isServerTest));
  for (const candidate of serverTestCandidates) {
    if (isDomainCandidate(candidate) || isReferenceCandidate(candidate)) selectedServerTests.add(candidate);
  }
  for (const candidate of [...selectedServerTests].sort()) {
    plan.needsDependencies = true;
    addCommand(commands, seenCommands, 'node', ['--test', candidate]);
  }

  const selectedBrowserTests = new Set(changedFiles.filter(isBrowserSpec));
  for (const candidate of browserCandidates) {
    if (isDomainCandidate(candidate) || isReferenceCandidate(candidate)) selectedBrowserTests.add(candidate);
  }
  for (const rule of domains) {
    for (const baseline of DOMAIN_BROWSER_BASELINES.get(rule.name) ?? []) {
      if (browserCandidates.includes(baseline)) selectedBrowserTests.add(baseline);
    }
  }
  if (changedFiles.some(isBrowserHarness) && selectedBrowserTests.size === 0) {
    plan.mode = 'full';
    plan.reasons.push('unclassified-browser-harness');
  }

  const sourceChanges = changedFiles.filter((path) => isFrontendSource(path) || isServerSource(path));
  const unclassifiedSource = sourceChanges.filter((path) => !domains.some((rule) => rule.source.test(path)) && !isReferenceCandidateForSource(root, path, verifyCandidates, serverTestCandidates, browserCandidates));
  if (unclassifiedSource.length > 0) {
    plan.mode = 'full';
    plan.reasons.push(`unclassified-source:${unclassifiedSource[0]}`);
  }

  if (plan.mode === 'full') {
    plan.needsDependencies = true;
    plan.checks = [];
    plan.browser = { mode: 'all', tests: [] };
    return plan;
  }

  plan.checks = commands;
  const browserTests = [...selectedBrowserTests].sort();
  if (browserTests.length > 0) {
    plan.needsDependencies = true;
    plan.browser = { mode: 'selected', tests: browserTests };
  }
  plan.reasons.push(domains.length > 0 ? `domains:${domains.map((rule) => rule.name).join(',')}` : 'path-specific');
  return plan;
}

function isReferenceCandidateForSource(root, sourcePath, ...candidateGroups) {
  const candidates = candidateGroups.flat();
  return candidates.some((candidate) => candidateReferencesAnyChangedFile(root, candidate, [sourcePath]));
}

const runCommand = ({ command, args }) => {
  console.log(`> ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
};

const writeGithubOutputs = (path, plan) => {
  if (!path) return;
  appendFileSync(path, `mode=${plan.mode}\n`);
  appendFileSync(path, `browser=${plan.browser.mode === 'none' ? 'false' : 'true'}\n`);
  appendFileSync(path, `dependencies=${plan.needsDependencies ? 'true' : 'false'}\n`);
};

const readChangedFiles = (path) => readFileSync(path, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

const requireValue = (args, flag) => {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) throw new Error(`缺少参数 ${flag}`);
  return args[index + 1];
};

function main() {
  const [, , action, ...args] = process.argv;
  if (action === 'plan') {
    const planFile = requireValue(args, '--plan-file');
    const githubOutput = args.includes('--github-output') ? requireValue(args, '--github-output') : null;
    const forceFull = args.includes('--full');
    const changedFiles = forceFull ? [] : readChangedFiles(requireValue(args, '--changed-files-file'));
    const plan = selectCiPlan(changedFiles, { forceFull });
    writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);
    writeGithubOutputs(githubOutput, plan);
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (action === 'run') {
    const plan = JSON.parse(readFileSync(requireValue(args, '--plan-file'), 'utf8'));
    const phase = requireValue(args, '--phase');
    if (plan.mode !== 'targeted') throw new Error('run 仅用于 targeted 计划');
    if (phase === 'checks') {
      for (const command of plan.checks) runCommand(command);
      return;
    }
    if (phase === 'browser') {
      if (plan.browser.mode === 'none') return;
      if (plan.browser.mode !== 'selected' || plan.browser.tests.length === 0) throw new Error('targeted browser 计划缺少测试文件');
      runCommand({ command: 'npm', args: ['run', 'test:browser', '--', ...plan.browser.tests] });
      return;
    }
    throw new Error(`未知 phase: ${phase}`);
  }

  throw new Error('用法: node scripts/select-ci-tests.mjs plan|run ...');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  }
}