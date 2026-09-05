import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { checkDocumentation } from '../../scripts/verify-document-authority.mjs';
import { selectCiPlan } from '../../scripts/select-ci-tests.mjs';

const registry = '<!-- design-registry:start -->\n| `EXAMPLE_DESIGN.md` | 当前职责 | 相邻职责 |\n<!-- design-registry:end -->';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'economy-governance-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  put('AGENTS.md', '# 协作入口\n\n[设计](docs/README.md)\n');
  put('README.md', '# 项目\n\n[协作](AGENTS.md)\n');
  put('docs/README.md', `# 自由命名的索引\n\n${registry}\n`);
  put('docs/EXAMPLE_DESIGN.md', '# 当前设计\n\n这是可以自由改写的业务规则说明。\n');
  return { root, put };
}

test('document wording, section names, and advisory size do not gate changes', (t) => {
  const { root, put } = fixture(t);
  put('AGENTS.md', '# Different heading\n\n' + '合理说明。'.repeat(2000));
  put('docs/EXAMPLE_DESIGN.md', '# 更合适的标题\n\n## 不同的章节\n\n同一规则的另一种表达。\n');
  const result = checkDocumentation(root);
  assert.deepEqual(result.failures, []);
  assert.ok(result.warnings.length > 0);
  assert.deepEqual(result.designDocs, ['EXAMPLE_DESIGN.md']);
});
for (const scenario of ['missing', 'empty', 'unregistered', 'duplicate', 'broken-link', 'missing-registry', 'empty-owner']) {
  test(`document structural error remains blocking: ${scenario}`, (t) => {
    const { root, put } = fixture(t);
    if (scenario === 'missing') rmSync(join(root, 'docs/EXAMPLE_DESIGN.md'));
    if (scenario === 'empty') put('docs/EXAMPLE_DESIGN.md', '  \n');
    if (scenario === 'unregistered') put('docs/OTHER_DESIGN.md', '# Other\n\nBody');
    if (scenario === 'duplicate') put('docs/README.md', registry.replace('<!-- design-registry:end -->', '| `EXAMPLE_DESIGN.md` | owner | other |\n<!-- design-registry:end -->'));
    if (scenario === 'broken-link') put('README.md', '# Entry\n\n[missing](docs/MISSING.md#section)');
    if (scenario === 'missing-registry') put('docs/README.md', '# Index without registry');
    if (scenario === 'empty-owner') put('docs/README.md', registry.replace('当前职责', ''));
    assert.ok(checkDocumentation(root).failures.length > 0);
  });
}
test('links ignore fenced examples and external URLs but resolve local fragments', (t) => {
  const { root, put } = fixture(t);
  put('README.md', '# Entry\n\n[design](docs/EXAMPLE_DESIGN.md#标题)\n[web](https://example.test/no-file)\n```md\n[example](not-a-file.md)\n```\n');
  assert.deepEqual(checkDocumentation(root).failures, []);
  put('README.md', '# Entry\n\n[reference][target]\n[target]: docs/MISSING.md\n');
  assert.ok(checkDocumentation(root).failures.length > 0);
});

test('domain-named documentation has only document DT and no business dependencies', (t) => {
  const { root, put } = fixture(t);
  put('scripts/verify-market.mjs', "// docs/MARKET_DESIGN.md\n");
  put('server/test/market.test.js', '// market');
  put('tests/browser/market.spec.ts', '// docs/MARKET_DESIGN.md');
  for (const path of ['docs/MARKET_DESIGN.md', 'docs/PRODUCTION_DESIGN.md', 'docs/MAP_DESIGN.md', 'server/README.md', 'AGENTS.md']) {
    const plan = selectCiPlan([path], { root });
    assert.equal(plan.mode, 'targeted');
    assert.equal(plan.needsDependencies, false);
    assert.deepEqual(plan.it.tests, []);
    assert.equal(plan.browser.mode, 'none');
    assert.deepEqual(plan.dt.commands.map((item) => item.args), [['run', 'verify:repository-text-format'], ['scripts/verify-document-authority.mjs']]);
  }
});
test('mixed changes infer executable impact without domain expansion from docs', (t) => {
  const { root, put } = fixture(t);
  put('server/test/banking.test.js', '// banking');
  put('server/test/market.test.js', '// market');
  put('tests/browser/bank.spec.ts', '// banking');
  put('tests/browser/market.spec.ts', '// docs/MARKET_DESIGN.md');
  const code = selectCiPlan(['server/src/banking.js'], { root });
  const mixed = selectCiPlan(['server/src/banking.js', 'docs/MARKET_DESIGN.md'], { root });
  assert.deepEqual(mixed.it, code.it);
  assert.deepEqual(mixed.browser, code.browser);
  assert.ok(mixed.it.tests.includes('server/test/banking.test.js'));
});
test('shared infrastructure, selector changes, unknown source, and explicit full stay full', (t) => {
  const { root } = fixture(t);
  for (const path of ['.github/workflows/ci.yml', 'scripts/select-ci-tests.mjs', 'scripts/verify-document-authority.mjs', 'package-lock.json', 'shared/state.js', 'src/utils/unknownCrossCutting.ts']) {
    assert.equal(selectCiPlan([path], { root }).mode, 'full');
  }
  assert.equal(selectCiPlan(['README.md'], { root, forceFull: true }).mode, 'full');
});

function jobSection(source, name) {
  const marker = `  ${name}:\n`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0);
  const rest = source.slice(start + marker.length);
  const next = rest.search(/^  [\w-]+:\s*$/m);
  return next < 0 ? rest : rest.slice(0, next);
}
function runBlock(section) {
  const match = /^        run: \|\n([\s\S]*)/m.exec(section);
  assert.ok(match);
  return match[1].replace(/^ {10}/gm, '');
}
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const gate = runBlock(jobSection(ci, 'build'));
for (const [dt, it, required, browser, success] of [
  ['success', 'success', 'true', 'success', true],
  ['success', 'success', 'false', 'skipped', true],
  ['failure', 'success', 'false', 'skipped', false],
  ['success', 'cancelled', 'false', 'skipped', false],
  ['success', 'success', 'true', 'failure', false],
  ['success', 'success', 'true', 'skipped', false],
  ['success', 'success', 'true', 'cancelled', false],
  ['success', 'success', 'false', 'cancelled', false],
  ['success', 'success', '', 'skipped', false],
]) {
  test(`actual aggregate gate: ${dt}/${it}/${required}/${browser}`, () => {
    const result = spawnSync('bash', ['-c', gate], { encoding: 'utf8', env: { ...process.env, DT_RESULT: dt, IT_RESULT: it, BROWSER_REQUIRED: required, BROWSER_RESULT: browser } });
    assert.equal(result.status === 0, success, result.stdout + result.stderr);
  });
}

const deployment = jobSection(readFileSync('.github/workflows/deploy.yml', 'utf8'), 'deploy');
const artifactStart = deployment.indexOf('        id: build_artifact\n');
assert.ok(artifactStart >= 0);
const artifactRest = deployment.slice(artifactStart);
const artifactEnd = artifactRest.indexOf('\n      - name:');
const unpack = runBlock(artifactEnd < 0 ? artifactRest : artifactRest.slice(0, artifactEnd));
for (const scenario of ['valid', 'wrong-source', 'wrong-digest', 'missing-digest', 'missing-archive']) {
  test(`actual artifact verification: ${scenario}`, (t) => {
    const { root, put } = fixture(t);
    put('site/index.html', '<!doctype html><title>fixture</title>');
    mkdirSync(join(root, 'economy-dist'), { recursive: true });
    const archive = join(root, 'economy-dist/economy-dist.tar.gz');
    assert.equal(spawnSync('tar', ['-czf', archive, '-C', join(root, 'site'), '.']).status, 0);
    let digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
    if (scenario === 'wrong-digest') digest = '0'.repeat(64);
    if (scenario === 'missing-digest') digest = '';
    if (scenario === 'missing-archive') rmSync(archive);
    const result = spawnSync('bash', ['-c', unpack], { cwd: root, encoding: 'utf8', env: { ...process.env, RUNNER_TEMP: root, EXPECTED_SHA256: digest, SOURCE_SHA: scenario === 'wrong-source' ? 'b'.repeat(40) : 'a'.repeat(40), GITHUB_SHA: 'a'.repeat(40) } });
    assert.equal(result.status === 0, scenario === 'valid', result.stdout + result.stderr);
    if (scenario === 'valid') assert.match(readFileSync(join(root, 'dist/index.html'), 'utf8'), /fixture/);
  });
}
