import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test, { type TestContext } from 'node:test';

const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
const uploadStep = workflow.match(/      - name: Upload website and game API\n([\s\S]*?)(?=\n      - name:)/)?.[1];
assert.ok(uploadStep, 'the production upload step must exist');
const run = uploadStep.match(/        run: \|\n([\s\S]*)/)?.[1];
assert.ok(run, 'the actual upload shell must be tested');
// Only omit the runner-specific outer log redirect; execute all upload logic unchanged.
const shell = run.replace(/^ {10}/gm, '').replace('exec > >(tee /tmp/economy-upload.log) 2>&1\n', '');
type Outcome = { code: number; message?: string };
type Call = { command: string; args: string[]; source?: string };

function exercise(t: TestContext, plan: Record<string, Outcome[]> = {}, runtime = false, loggerFails = false) {
  const root = mkdtempSync(join(tmpdir(), 'economy-upload-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  const mock = join(root, 'commands.mjs');
  const callsPath = join(root, 'calls.jsonl');
  writeFileSync(mock, `
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const [command, ...args] = process.argv.slice(2);
const calls = process.env.TEST_CALLS;
const prior = existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse) : [];
const source = command === 'rsync' ? args.at(-2) : undefined;
appendFileSync(calls, JSON.stringify({ command, args, source }) + '\\n');
if (command === 'timeout') {
  const result = spawnSync(args[1], args.slice(2), { stdio: 'inherit', env: process.env });
  process.exit(result.status ?? 1);
}
if (command === 'rsync') {
  const count = prior.filter(call => call.command === 'rsync' && call.source === source).length;
  const outcome = (JSON.parse(process.env.TEST_PLAN)[source] ?? [])[count] ?? { code: 0 };
  if (outcome.message) console.error(outcome.message);
  process.exit(outcome.code);
}
if (command === 'tee') {
  const input = readFileSync(0);
  if (process.env.TEST_LOGGER_FAILS === 'true') process.exit(74);
  writeFileSync(args[0], input);
  process.stdout.write(input);
}
`);
  for (const command of ['timeout', 'rsync', 'sleep', 'tee']) {
    writeFileSync(join(bin, command), `#!/usr/bin/env bash\nexec "$TEST_NODE" "$TEST_MOCK" ${command} "$@"\n`, { mode: 0o755 });
  }
  const result = spawnSync('bash', ['-c', shell], {
    cwd: root, encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TEST_NODE: process.execPath,
      TEST_MOCK: mock, TEST_CALLS: callsPath, TEST_PLAN: JSON.stringify(plan),
      TEST_LOGGER_FAILS: String(loggerFails), TMPDIR: root,
      SERVER_USER: 'fixture', SERVER_PORT: '22', ECONOMY_PRODUCTION_PUBLIC_IP: 'fixture.invalid',
      RUNTIME_UPLOAD: String(runtime) },
  });
  assert.ifError(result.error);
  const calls: Call[] = readFileSync(callsPath, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  return { ...result, calls, transfers: calls.filter(call => call.command === 'rsync') };
}

for (const runtime of [false, true]) {
  test(`actual upload preserves ordering, immutable assets, entry and runtime protection: runtime=${runtime}`, t => {
    const result = exercise(t, {}, runtime);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(result.transfers.map(call => call.source), [
      'dist/assets/', 'dist/', 'shared/', 'server/', ...(runtime ? ['/tmp/economy-node-runtime/'] : []),
    ]);
    for (const call of result.transfers) {
      assert.ok(call.args.includes('--partial-dir=.rsync-partial'));
      assert.ok(call.args.includes('--timeout=60'));
      assert.ok(call.args.includes('--info=progress2,stats2'));
      assert.ok(call.args.includes('--outbuf=L'));
      for (const unsafe of ['--inplace', '--partial', '--size-only', '--ignore-existing']) assert.ok(!call.args.includes(unsafe));
    }
    assert.ok(result.transfers[0].args.includes('--checksum'));
    assert.ok(!result.transfers[0].args.some(arg => arg.startsWith('--delete')));
    assert.deepEqual(result.transfers[1].args.filter((_, i, args) => args[i - 1] === '--exclude'), ['assets/', 'index.html']);
    assert.ok(result.transfers[2].args.includes('--delete'));
    assert.ok(result.transfers[3].args.includes('--delete-before'));
    assert.ok(result.transfers[3].args.includes('runtime/'));
    if (runtime) assert.ok(result.transfers[4].args.includes('--delete-before'));
    for (const call of result.calls.filter(call => call.command === 'timeout')) assert.deepEqual(call.args.slice(0, 2), ['300s', 'rsync']);
    assert.equal(result.calls.filter(call => call.command === 'sleep').length, 0);
    assert.match(uploadStep, /timeout-minutes: 14/);
    assert.match(workflow, /  deploy:\n[\s\S]*?timeout-minutes: 20/);
    assert.match(result.stdout, /ECONOMY_UPLOAD_OK phase=api attempt=1/);
    assert.ok(!result.transfers.some(call => call.args.some(arg => arg.endsWith('index.html.next'))));
  });
}

for (const code of [10, 12, 30, 35, 124, 255]) {
  test(`actual upload resumes only the failed phase after transient exit ${code}`, t => {
    const result = exercise(t, { 'shared/': [{ code }] });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(result.transfers.map(call => call.source), ['dist/assets/', 'dist/', 'shared/', 'shared/', 'server/']);
    assert.deepEqual(result.transfers[2].args, result.transfers[3].args);
    assert.deepEqual(result.calls.filter(call => call.command === 'sleep').map(call => call.args), [['5']]);
    assert.match(result.stdout, /ECONOMY_UPLOAD_RETRY phase=shared next_attempt=2/);
    assert.match(result.stdout, /ECONOMY_UPLOAD_OK phase=shared attempt=2/);
  });
}

test('actual upload can recover on the third attempt', t => {
  const result = exercise(t, { 'dist/assets/': [{ code: 124 }, { code: 30 }] });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.transfers.filter(call => call.source === 'dist/assets/').length, 3);
  assert.match(result.stdout, /ECONOMY_UPLOAD_OK phase=assets attempt=3/);
});

test('actual upload stops after three failures and never uploads later phases', t => {
  const result = exercise(t, { 'dist/assets/': Array.from({ length: 4 }, () => ({ code: 124 })) });
  assert.equal(result.status, 124);
  assert.equal(result.transfers.length, 3);
  assert.ok(result.transfers.every(call => call.source === 'dist/assets/'));
  assert.equal(result.calls.filter(call => call.command === 'sleep').length, 2);
  assert.doesNotMatch(result.stdout, /ECONOMY_UPLOAD_OK|phase=website/);
});

for (const code of [1, 2, 11, 23, 24, 126, 127, 130, 137, 143]) {
  test(`actual upload never retries deterministic or cancelled exit ${code}`, t => {
    const result = exercise(t, { 'dist/assets/': [{ code }] });
    assert.equal(result.status, code);
    assert.equal(result.transfers.length, 1);
    assert.doesNotMatch(result.stdout, /ECONOMY_UPLOAD_RETRY|ECONOMY_UPLOAD_OK/);
  });
}

for (const message of ['Permission denied (publickey).', 'Host key verification failed.',
  'REMOTE HOST IDENTIFICATION HAS CHANGED', 'No space left on device', 'Read-only file system',
  'rsync: command not found', 'rsync: not found', 'protocol version mismatch']) {
  test(`actual upload rejects nontransient SSH/protocol failure: ${message}`, t => {
    const result = exercise(t, { 'dist/assets/': [{ code: 255, message }] });
    assert.equal(result.status, 255);
    assert.equal(result.transfers.length, 1);
    assert.doesNotMatch(result.stdout, /ECONOMY_UPLOAD_RETRY|ECONOMY_UPLOAD_OK/);
  });
}

test('an upload logger failure cannot be reported as transfer success', t => {
  const result = exercise(t, {}, false, true);
  assert.equal(result.status, 74);
  assert.equal(result.transfers.length, 1);
  assert.match(result.stderr, /ECONOMY_UPLOAD_LOG_FAILED phase=assets code=74/);
  assert.doesNotMatch(result.stdout, /ECONOMY_UPLOAD_RETRY|ECONOMY_UPLOAD_OK/);
});
