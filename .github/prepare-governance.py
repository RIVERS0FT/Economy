from pathlib import Path
import re
import subprocess

BASE = '53a8561de91610829e8337db9896655fdb60ba27'

def original(path):
    return subprocess.check_output(['git', 'show', f'{BASE}:{path}'], text=True)

def replace(text, before, after):
    if text.count(before) != 1:
        raise RuntimeError(f'Expected one edit anchor, found {text.count(before)}: {before[:120]}')
    return text.replace(before, after, 1)

def write(path, text):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text.rstrip() + '\n', encoding='utf-8')

agents = original('AGENTS.md')
subtitle = '- 涉及页面标题的修改时，除非对应权威设计明确要求副标题，默认不得在主标题下新增灰色小标题；需要例外时先更新对应权威设计文档并写明必要的 `non-obvious reason`。\n'
agents = replace(agents, subtitle, '')
agents = replace(agents, '- 修改应遵守任务对应的权威设计；新增或改变规则时，在同一变更中更新权威文档和防回退检查，避免后续修改回来。', '- 修改应遵守任务对应的权威设计；新增或改变业务规则、接口契约或长期约束时，在同一变更中更新对应设计与验证。纯重构、措辞整理和恢复既定行为的修复，不机械新增设计条款；优先用行为测试保护结果，不要求每次修改都新增字符串 verifier。')
agents = replace(agents, '- PR 描述只记录合入后的最终行为；不得写 diff 看不出来的取舍、`intermediate attempts`、临时开发过程或任何从未合入的状态。', '- PR 描述记录最终行为、必要原因、验证结果和风险；允许解释重要取舍，不记录临时开发流水账或把从未合入的状态写成事实。')
agents = replace(agents, '- 若合并、部署或线上验收失败，继续定位并修复；不得把本地修改或动作已经提交后的补拉失败误报为完整成功。', '- 若合并、部署或线上验收失败，根据新证据定位并修复；同一失败且没有新证据时，不反复盲目重跑或部署，应说明阻塞。区分已修改、已验证、已合并、已部署与已验收，不得把局部完成误报为全部成功。')
agents = replace(agents, '## 集成与交付', '## 技能使用\n\n- 按任务相关性读取实际可用的技能，不要求每次加载全部技能，也不指定必须使用某个模型。\n- 维护技能前核对其实际来源、覆盖层级和上游说明，保留本地定制；技能只自动化可复用操作，不复制项目业务规范。没有实际复用需求时不新增技能。\n\n## 集成与交付')
write('AGENTS.md', agents)

page = original('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md')
page = replace(page, '## 1. 正式页面与导航', '## 页面标题边界\n\n除对应权威设计明确要求副标题外，主标题下默认不得新增灰色小标题。例外应在页面规则中说明用途与必要原因；本规则不取消已明确规定的地区导航等有效标题内容。标题内容由本文负责，通用字体与颜色由 `UI_DESIGN_SYSTEM.md` 负责，协作规则不保存页面细节。\n\n## 1. 正式页面与导航')
write('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', page)

index = original('docs/README.md')
index = replace(index, '| 文档 | 唯一职责 | 明确不负责 |', '<!-- design-registry:start -->\n| 文档 | 唯一职责 | 明确不负责 |')
index = replace(index, '\n文档名称表达领域而不是版本。', '\n<!-- design-registry:end -->\n\n文档名称表达领域而不是版本。')
index = replace(index, '7. `scripts/verify-document-authority.mjs` 只验证文档登记、层级边界、README 越界和 DESIGN 路由完整性，不承担具体玩法回归。', '7. `scripts/verify-document-authority.mjs` 从上述登记表读取唯一文档清单，只阻断缺失／空文档、重复或未登记文档及失效的本地 Markdown 链接。登记表的机器边界标记和文件路径是结构契约；自然语言措辞、标题、章节顺序及合理篇幅不是硬门禁。篇幅检查仅提示，不声称证明语义没有重复或 README 没有越界；职责与语义一致性由设计审查确认。')
index = replace(index, '10. 修改完成后按 `AGENTS.md` 执行对应验证、压缩合并与主线部署。', '10. 只有形成或改变长期规则时才新增设计约束，并说明保护的风险、适用范围和验证方式；纯重构、措辞和恢复既定行为的修复不机械增加永久禁令。修改完成后按 `AGENTS.md` 执行对应验证、压缩合并与主线部署。')
write('docs/README.md', index)

ci = original('.github/workflows/ci.yml')
ci = replace(ci, '  push:\n    branches-ignore:\n      - main\n', '')
a = ci.index('  verify-head-ci-registration:\n')
b = ci.index('  dt:\n', a)
ci = ci[:a] + ci[b:]
a = ci.index('          if [ "$EVENT_NAME" = "workflow_dispatch" ]; then')
b = ci.index('          echo "ECONOMY_CI_CHANGED_FILES"', a)
ci = ci[:a] + '''          scope_args=()
          if [ "$EVENT_NAME" = "workflow_dispatch" ]; then
            : > "$changed_files"
            scope_args+=(--full)
          elif [ "$EVENT_NAME" = "pull_request" ]; then
            git diff --check "$PR_BASE_SHA" "$PR_HEAD_SHA"
            git diff --name-only "$PR_BASE_SHA" "$PR_HEAD_SHA" > "$changed_files"
          else
            echo "Unsupported CI event: $EVENT_NAME" >&2
            exit 1
          fi
          node scripts/select-ci-tests.mjs plan \\
            --changed-files-file "$changed_files" \\
            --plan-file "$plan_file" \\
            --github-output "$GITHUB_OUTPUT" \\
            "${scope_args[@]}"

''' + ci[b:]
ci = replace(ci, 'needs: [verify-head-ci-registration, dt, it, browser-test]', 'needs: [dt, it, browser-test]')
a = ci.index('  build:\n')
gate = ci[a:]
gate = replace(gate, '          EVENT_NAME: ${{ github.event_name }}\n', '')
gate = replace(gate, '          REGISTRATION_RESULT: ${{ needs.verify-head-ci-registration.result }}\n', '')
a_run = gate.index('        run: |\n')
gate = gate[:a_run] + '''        run: |
          set -euo pipefail
          test "$DT_RESULT" = "success"
          test "$IT_RESULT" = "success"
          case "$BROWSER_REQUIRED" in
            true) test "$BROWSER_RESULT" = "success" ;;
            false)
              case "$BROWSER_RESULT" in
                skipped|success) ;;
                *) echo "Unexpected browser result: $BROWSER_RESULT" >&2; exit 1 ;;
              esac ;;
            *) echo "Missing or invalid browser requirement: $BROWSER_REQUIRED" >&2; exit 1 ;;
          esac
          echo "ECONOMY_QUALITY_GATE_OK dt=$DT_RESULT it=$IT_RESULT browser=$BROWSER_RESULT"
'''
ci = ci[:a] + gate
write('.github/workflows/ci.yml', ci)

selector = original('scripts/select-ci-tests.mjs')
selector = replace(selector, '  /^scripts\\/select-ci-tests\\.mjs$/,', '  /^scripts\\/select-ci-tests\\.mjs$/,\n  /^scripts\\/verify-document-authority\\.mjs$/,')
selector = replace(selector, "const isDocumentationOnly = (path) => /^(?:docs\\/.*\\.md|README\\.md|AGENTS\\.md)$/.test(path);", "const isDocumentationOnly = (path) => /\\.md$/i.test(path);")
a = selector.index("  addCommand(commands, seenCommands, 'node', ['scripts/verify-deployment-pipeline.mjs']);")
b = selector.index('  const frontendChanges =', a)
selector = selector[:a] + '''  const documentationChanges = changedFiles.filter(isDocumentationOnly);
  const executableChanges = changedFiles.filter((path) => !isDocumentationOnly(path));
  addCommand(commands, seenCommands, 'npm', ['run', 'verify:repository-text-format']);
  if (documentationChanges.length > 0) addCommand(commands, seenCommands, 'node', ['scripts/verify-document-authority.mjs']);

  // Paths classify executable impact, not the meaning of prose. Changes to a
  // contract still need implementation/tests or an explicitly requested full run.
  if (executableChanges.length === 0) {
    plan.dt.commands = commands;
    plan.reasons.push('documentation-only');
    return plan;
  }
  addCommand(commands, seenCommands, 'node', ['scripts/verify-deployment-pipeline.mjs']);
  addCommand(commands, seenCommands, 'node', ['scripts/verify-runtime-reliability.mjs']);

''' + selector[b:]
selector = replace(selector, 'const domains = inferDomains(changedFiles);', 'const domains = inferDomains(executableChanges);')
selector = replace(selector, 'const isReferenceCandidate = (candidate) => candidateReferencesAnyChangedFile(root, candidate, changedFiles);', 'const isReferenceCandidate = (candidate) => candidateReferencesAnyChangedFile(root, candidate, executableChanges);')
write('scripts/select-ci-tests.mjs', selector)

write('scripts/verify-document-authority.mjs', r'''import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// The index owns the registry. Prose and semantic ownership are reviewed, not
// inferred from mandatory sentences or a second hard-coded list of designs.
export function checkDocumentation(root = process.cwd()) {
  root = resolve(root);
  const failures = [];
  const warnings = [];
  const designDocs = [];
  const contents = new Map();
  const read = (path) => {
    const target = resolve(root, path);
    if (!existsSync(target) || !statSync(target).isFile()) {
      failures.push(`缺少文档: ${path}`);
      return '';
    }
    const text = readFileSync(target, 'utf8');
    if (!text.trim()) failures.push(`空文档: ${path}`);
    contents.set(path, text);
    return text;
  };
  for (const path of ['AGENTS.md', 'README.md', 'docs/README.md']) read(path);
  const index = contents.get('docs/README.md') ?? '';
  const start = '<!-- design-registry:start -->';
  const end = '<!-- design-registry:end -->';
  if (index.split(start).length !== 2 || index.split(end).length !== 2 || index.indexOf(end) < index.indexOf(start)) {
    failures.push('设计索引必须包含唯一且有序的 design-registry 边界');
  } else {
    const registry = index.slice(index.indexOf(start) + start.length, index.indexOf(end));
    for (const match of registry.matchAll(/^\|\s*`([^`]+)`\s*\|([^|]*)\|([^|]*)\|\s*$/gm)) {
      const [, name, responsibility, exclusions] = match;
      if (!/^[A-Za-z0-9_-]+\.md$/.test(name) || name === 'README.md') {
        failures.push(`无效的设计文档路径: ${name}`);
        continue;
      }
      if (designDocs.includes(name)) failures.push(`重复登记: ${name}`);
      else designDocs.push(name);
      if (!responsibility.trim() || !exclusions.trim()) failures.push(`缺少职责或不负责范围: ${name}`);
    }
    if (designDocs.length === 0) failures.push('设计文档登记表为空');
  }
  for (const name of designDocs) {
    const text = read(`docs/${name}`);
    if (text.trim() && !text.replace(/^#[^\n]*(?:\n|$)/, '').trim()) failures.push(`设计文档缺少正文: docs/${name}`);
  }
  const docsPath = resolve(root, 'docs');
  if (existsSync(docsPath) && statSync(docsPath).isDirectory()) {
    const allowed = new Set(['README.md', ...designDocs]);
    for (const entry of readdirSync(docsPath, { withFileTypes: true })) {
      if (entry.isFile() && /\.md$/i.test(entry.name) && !allowed.has(entry.name)) failures.push(`未登记文档: docs/${entry.name}`);
    }
  }
  const checkLink = (path, raw) => {
    if (!raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) return;
    let destination;
    try { destination = decodeURIComponent(raw.split(/[?#]/, 1)[0]); }
    catch { failures.push(`${path} 含无效链接: ${raw}`); return; }
    if (!destination) return;
    const target = destination.startsWith('/') ? resolve(root, `.${destination}`) : resolve(root, dirname(path), destination);
    const fromRoot = relative(root, target);
    if (fromRoot === '..' || fromRoot.startsWith('../') || isAbsolute(fromRoot) || !existsSync(target)) {
      failures.push(`${path} 的本地链接失效: ${raw}`);
    }
  };
  let totalDesignBytes = 0;
  for (const [path, content] of contents) {
    // Code examples are not navigation. Heading fragments remain a renderer concern.
    const prose = content.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
    for (const match of prose.matchAll(/!?\[[^\]\n]*\]\((?:<([^>\n]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)) checkLink(path, match[1] ?? match[2]);
    for (const match of prose.matchAll(/^ {0,3}\[[^\]\n]+\]:\s*<?([^\s>]+)>?/gm)) checkLink(path, match[1]);
    const bytes = Buffer.byteLength(content, 'utf8');
    const limit = path === 'AGENTS.md' ? 6 * 1024 : path === 'README.md' ? 14 * 1024 : path === 'docs/README.md' ? 24 * 1024 : 130 * 1024;
    if (bytes > limit) warnings.push(`${path} 较长（${bytes} 字节）；请审查职责与可读性，不据此阻断变更`);
    if (path.startsWith('docs/') && path !== 'docs/README.md') totalDesignBytes += bytes;
  }
  if (totalDesignBytes > 820 * 1024) warnings.push('设计文档总量较大；请按职责审查，不以总字节数判断质量');
  return { failures, warnings, designDocs };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = checkDocumentation();
  for (const warning of result.warnings) console.warn(`文档提示: ${warning}`);
  if (result.failures.length) {
    console.error(`文档结构验证失败:\n- ${result.failures.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log('文档登记与本地链接检查通过；语义归属和内容边界仍需设计审查。');
  }
}
''')

# Reuse the exact artifact from the successful build in this same workflow run.
deploy = original('.github/workflows/deploy.yml')
needle = '  build:\n    runs-on: ubuntu-latest\n    timeout-minutes: 20\n'
deploy = replace(deploy, needle, needle + '''    outputs:
      artifact_id: ${{ steps.upload_dist.outputs.artifact-id }}
      artifact_sha256: ${{ steps.package_dist.outputs.sha256 }}
      source_sha: ${{ steps.package_dist.outputs.source_sha }}
''')
needle = '      - name: Upload failed build validation log\n'
deploy = replace(deploy, needle, '''      - name: Package validated website
        id: package_dist
        shell: bash
        run: |
          set -euo pipefail
          test -s dist/index.html
          tar -czf "$RUNNER_TEMP/economy-dist.tar.gz" -C dist .
          echo "sha256=$(sha256sum "$RUNNER_TEMP/economy-dist.tar.gz" | cut -d ' ' -f 1)" >> "$GITHUB_OUTPUT"
          echo "source_sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"

      - name: Upload validated website
        id: upload_dist
        uses: actions/upload-artifact@v4
        with:
          name: economy-dist-${{ github.sha }}-${{ github.run_id }}-${{ github.run_attempt }}
          path: ${{ runner.temp }}/economy-dist.tar.gz
          if-no-files-found: error
          retention-days: 1
          compression-level: 0

''' + needle)
a = deploy.index('      - name: Build production artifact from validated source\n')
b = deploy.index('      - name: Ensure rsync is available\n', a)
deploy = deploy[:a] + '''      - name: Download validated website
        uses: actions/download-artifact@v4
        with:
          artifact-ids: ${{ needs.build.outputs.artifact_id }}
          path: ${{ runner.temp }}/economy-dist
          merge-multiple: true

      - name: Verify and unpack validated website
        id: build_artifact
        shell: bash
        env:
          EXPECTED_SHA256: ${{ needs.build.outputs.artifact_sha256 }}
          SOURCE_SHA: ${{ needs.build.outputs.source_sha }}
        run: |
          exec > >(tee /tmp/economy-build-artifact.log) 2>&1
          set -euo pipefail
          test "$SOURCE_SHA" = "$GITHUB_SHA"
          [[ "$EXPECTED_SHA256" =~ ^[0-9a-f]{64}$ ]]
          archive="$RUNNER_TEMP/economy-dist/economy-dist.tar.gz"
          printf '%s  %s\\n' "$EXPECTED_SHA256" "$archive" | sha256sum -c -
          mkdir -p dist
          tar -xzf "$archive" -C dist
          test -s dist/index.html

''' + deploy[b:]
write('.github/workflows/deploy.yml', deploy)

# Keep workflow invariants and existing business/deployment checks, not prose locks.
verifier = original('scripts/verify-deployment-pipeline.mjs')
for line in ["const ciDesignPath = resolve(root, 'docs/CI_EXECUTION_DESIGN.md');\n", "const ciDesign = readFileSync(ciDesignPath, 'utf8');\n", "const selectorPath = resolve(root, 'scripts/select-ci-tests.mjs');\n", "const selector = readFileSync(selectorPath, 'utf8');\n"]:
    verifier = replace(verifier, line, '')
for name in ['requireSelectorText', 'requireCiDesignText']:
    verifier, count = re.subn(r'const ' + name + r' = \(text, reason\) => \{.*?\n\};\n', '', verifier, flags=re.S)
    assert count == 1, name
verifier, count = re.subn(r"for \(const text of \[\n  'FULL_TRIGGER_PATTERNS',.*?\]\) requireSelectorText\(text\);\n", '', verifier, flags=re.S)
assert count == 1
verifier = re.sub(r'^requireCiDesignText\(.*\);\n', '', verifier, flags=re.M)
for line in ["  'git merge-base origin/main \"$GITHUB_SHA\"',\n", "  'npm run test:browser -- --shard=${{ matrix.shard }}/4',\n", "  'ECONOMY_PLAYWRIGHT_SHARD: ${{ matrix.shard }}/4',\n", "  'Aggregate DT IT ST quality gate',\n"]:
    verifier = replace(verifier, line, '')
verifier = replace(verifier, 'planCalls.length !== 3', 'planCalls.length !== 1')
verifier = replace(verifier, 'CI 只允许 DT 的三种事件分支调用同一 plan 入口，IT/ST 不得再次计算 changed files', 'CI 必须在 DT 生成一次计划，IT/ST 复用该计划')
verifier = replace(verifier, "if (!docsPlan.needsDependencies) failures.push('选中的 verifier 直接依赖 npm 包时 targeted CI 必须安装依赖');", "if (docsPlan.needsDependencies || docsPlan.it.tests.length || docsPlan.browser.mode !== 'none') failures.push('纯文档计划不得因文档名称或正文引用扩散到业务测试或依赖安装');")
# Definition order and exact shard count are configuration, not safety properties.
a = verifier.index('const itSectionStart =')
b = verifier.index("if (itSection.includes('git diff --name-only')", a)
verifier = verifier[:a] + '''const jobSection = (source, name) => {
  const marker = `  ${name}:\\n`;
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const rest = source.slice(start + marker.length);
  const next = rest.search(/^  [\\w-]+:\\s*$/m);
  return marker + (next < 0 ? rest : rest.slice(0, next));
};
const requireNeeds = (source, name, expected) => {
  const section = jobSection(source, name);
  const match = /^    needs: *([^\\n]*)/m.exec(section);
  const raw = match?.[1]?.trim() ?? '';
  const needs = raw.startsWith('[') ? raw.slice(1, -1).split(',').map((value) => value.trim())
    : raw ? [raw] : [...section.matchAll(/^      - ([\\w-]+)$/gm)].map((item) => item[1]);
  if (!section || expected.some((value) => !needs.includes(value))) failures.push(`${name} 缺少必要的依赖门禁: ${expected.join(', ')}`);
};
const checkShards = (source, label) => {
  const section = jobSection(source, 'browser-test');
  const shards = /shard:\\s*\\[([^\\]]+)\\]/.exec(section)?.[1]?.split(',').map((value) => Number(value.trim())) ?? [];
  const denominator = /--shard=\\$\\{\\{\\s*matrix\\.shard\\s*\\}\\}\\/(\\d+)/.exec(section)?.[1];
  if (!shards.length || shards.some((value, index) => value !== index + 1) || Number(denominator) !== shards.length) failures.push(`${label} 必须完整且一致地分配所有浏览器 shard`);
  if (!/fail-fast:\\s*false/.test(section) || !/timeout-minutes:\\s*[1-9]\\d*/.test(section)) failures.push(`${label} 必须保留失败诊断与有限超时`);
  const targeted = /ECONOMY_PLAYWRIGHT_SHARD:\\s*\\$\\{\\{\\s*matrix\\.shard\\s*\\}\\}\\/(\\d+)/.exec(section);
  if (targeted && Number(targeted[1]) !== shards.length) failures.push(`${label} targeted shard 总数不一致`);
};
requireNeeds(ciWorkflow, 'it', ['dt']);
requireNeeds(ciWorkflow, 'browser-test', ['dt', 'it']);
requireNeeds(ciWorkflow, 'build', ['dt', 'it', 'browser-test']);
requireNeeds(workflow, 'deploy', ['build', 'browser-test']);
checkShards(ciWorkflow, 'PR CI');
checkShards(workflow, 'main CI');
if (!/if:\\s*always\\(\\)/.test(jobSection(ciWorkflow, 'build'))) failures.push('required build 必须在依赖结束后报告结果');
if (/^  push:/m.test(ciWorkflow) || ciWorkflow.includes('verify-head-ci-registration') || /^\\s+paths(?:-ignore)?:/m.test(ciWorkflow)) failures.push('PR CI 不得要求重复 push 登记或用路径过滤跳过整个 required 工作流');
for (const event of ['pull_request', 'workflow_dispatch']) {
  if (!new RegExp(`^  ${event}:`, 'm').test(ciWorkflow)) failures.push(`CI 缺少事件入口: ${event}`);
}
const itSection = jobSection(ciWorkflow, 'it');
const browserSection = jobSection(ciWorkflow, 'browser-test');
''' + verifier[b:]
verifier = '\n'.join(line for line in verifier.split('\n') if not (
    line.startswith('requireText(') and any(token in line for token in ["shard: [1, 2, 3, 4]", 'npm run test:browser -- --shard=', "'  deploy:", 'npm run generate:artwork', 'npm run generate:local-preview', "'./node_modules/.bin/tsc'", "'./node_modules/.bin/vite build'"])
    or line.startswith('requireCiText(') and any(token in line for token in ["'  it:", "'  browser-test:", "'  build:", 'shard: [1, 2, 3, 4]'])
))
a = verifier.index('const ciDtIndex =')
b = verifier.index('for (const forbidden of', a)
verifier = verifier[:a] + "const ciBuildSection = jobSection(ciWorkflow, 'build');\n" + verifier[b:]
a = verifier.index('const browserIndex =')
b = verifier.index("if (deploySection.includes('npm run test:browser'))", a)
verifier = verifier[:a] + "const deploySection = jobSection(workflow, 'deploy');\n" + verifier[b:]
needle = 'if (failures.length > 0) {'
verifier = replace(verifier, needle, '''for (const forbidden of ['npm run generate:artwork', 'npm run generate:local-preview', './node_modules/.bin/tsc', './node_modules/.bin/vite build']) {
  if (deploySection.includes(forbidden)) failures.push(`deploy 不得重新编译已验证产物: ${forbidden}`);
}
for (const required of ['actions/download-artifact@', 'artifact-ids: ${{ needs.build.outputs.artifact_id }}', 'SOURCE_SHA: ${{ needs.build.outputs.source_sha }}', 'EXPECTED_SHA256: ${{ needs.build.outputs.artifact_sha256 }}', 'sha256sum -c -']) {
  if (!deploySection.includes(required)) failures.push(`部署产物缺少来源或完整性验证: ${required}`);
}
if (/^\\s+(?:github-token|repository|run-id):/m.test(deploySection)) failures.push('正式产物只允许来自同一次受信任工作流');
const buildProducer = jobSection(workflow, 'build');
for (const required of ['npm run build', 'id: package_dist', 'id: upload_dist', 'actions/upload-artifact@']) {
  if (!buildProducer.includes(required)) failures.push(`生产 build 必须验证并提供部署产物: ${required}`);
}

''' + needle)
verifier = replace(verifier, "console.log('DT/IT/ST 已按同一 changed-file 计划分层执行，DT/IT coverage 为硬门禁，四分片 ST-browser 通过后由稳定 build 状态统一聚合；main 仍以完整 build 与四分片浏览器回归作为部署硬门禁。');", "console.log('CI 计划、聚合门禁、浏览器分片与同运行部署产物边界检查通过；完整 DT/IT/ST 与线上验收保持有效。');")
write('scripts/verify-deployment-pipeline.mjs', verifier)

design = original('docs/CI_EXECUTION_DESIGN.md')
design = replace(design, '- `.github/workflows/ci.yml` 是 PR 与非 `main` push 的唯一 CI 工作流；`.github/workflows/deploy.yml` 是 `main` 自动部署与完整生产门禁。', '- `.github/workflows/ci.yml` 负责 PR 合入验证和手动完整验证；不为普通分支 push 默认重复执行同等 CI。`.github/workflows/deploy.yml` 负责 `main` 自动部署与完整生产门禁。')
design = replace(design, '- `pull_request` 与非 `main` push 继续按各自真实 base/head 或 merge-base 计算改动，并保留 `verify-head-ci-registration` 对同一 PR head push CI 的只读登记校验。', '- `pull_request` 使用事件提供的真实 base/head 计算改动；`workflow_dispatch` 执行完整验证。合并依据实际检查结果，不要求另一条 push CI 的登记记录，也不对 required 工作流设置路径忽略。')
design = replace(design, 'PR／非 `main` push 的执行顺序固定为：', 'PR 与手动 CI 当前按以下依赖执行：')
design = replace(design, '## 4. PR 与分支执行拓扑', '## 4. PR 与手动执行拓扑')
design = replace(design, '## 5. PR 与分支浏览器门禁', '## 5. 浏览器门禁与执行配置')
design = replace(design, 'PR 与分支只在选择器判定需要浏览器验证时执行 ST-browser；', 'PR 只在选择器判定需要浏览器验证时执行 ST-browser；手动完整验证执行全部 ST-browser；')
design = replace(design, '- 只要选择器要求浏览器验证，ST-browser 固定拆成四个独立 shard，使用 `fail-fast: false`，每个 shard 保留 20 分钟 Job 上限。', '- 当前 ST-browser 使用四个独立 shard、`fail-fast: false` 与每个 Job 20 分钟上限。分片数量、并发拓扑与合理超时是可据运行数据调整的配置，不是永久禁令；调整必须保持选中集合完整、分片分母一致、失败可诊断和总耗时有界。')
design = replace(design, '- targeted 模式必须把选择器已经确定的同一组 Playwright spec 交给四个 shard，并通过 Playwright `--shard=N/4` 做确定性分配；不得为了缩短时间删除同领域基线、只跑首个 shard 或另建手工测试清单。', '- targeted 模式把同一组已选 Playwright spec 交给全部配置 shard，并通过 `--shard=N/总数` 确定性分配；不得漏跑分片、删除相关基线或另建手工测试清单。')
design = replace(design, '- 浏览器行为回归必须修复实际根因；不得通过提高 Job 超时、扩大 Playwright 单测超时、关闭 retry、降低断言或跳过 ST 门禁来掩盖失败。', '- 浏览器行为回归应根据证据修复根因；可以依据正常负载与运行数据调整合理超时，但不得用延时、吞错、降低断言或跳过必要测试来掩盖失败。同一失败且没有新证据时应报告阻塞，不盲目重跑。')
design = replace(design, '- PR/分支需要浏览器验证时只使用单个 Job 执行全部选中测试，或用延长 20 分钟上限替代四分片；', '- 改变浏览器分片或超时配置时漏跑选中集合、失去有限失败边界，或以配置调整掩盖行为错误；')
design = replace(design, 'DT 最低覆盖率固定为：', '当前 DT 最低覆盖率为：')
design = replace(design, 'IT 最低覆盖率固定为：', '当前 IT 最低覆盖率为：')
design = replace(design, '部署 Job 不得在上传阶段再次串行执行完整 `npm run build` 或 Playwright，避免同一源码重复跑完整门禁并挤压部署超时预算。', '部署 build 在完整验证通过后打包其正式 `dist`，通过同一次工作流的短期 Artifact 交给 deploy。产物 ID、源码 SHA 和归档 SHA-256 由成功 build 的 Job 输出传递；deploy 在解包前校验源码 SHA 与独立传递的摘要，任何缺失或不匹配均失败。不得下载其他运行／仓库的产物，不依赖下载 Action 仅告警的摘要提示代替硬校验。按产物 ID 下载可在仅重跑失败 deploy 时复用原成功 build 的产物；产物过期则重新执行完整发布验证。\n\n部署 Job 不再重新生成美术／预览资源或执行 TypeScript、Vite、完整 build 或 Playwright；只消费已验证产物并保留原有服务器发布、生产安全边界与线上验收。短期产物不提交仓库。')
design = replace(design, '## 9. 防回退', '## 9. 必须保护的结果')
design += '\n\n## 10. 文档与验证职责\n\nMarkdown 路径本身不表示业务源码变更。纯文档计划只执行仓库文本格式及文档结构／本地链接检查，不安装业务依赖，也不因文件名包含 market、production、map 等词或正文引用而扩散到 IT/ST。混合变更仍验证文档，但领域与引用推断仅使用非文档路径。选择器、文档验证器、共享协议、发布流程和无法分类的源码保持 full fallback。\n\n路径分类不能判断文字是否改变契约。业务语义、安全要求或接口契约改变时，应在同一变更中提供相应实现／行为测试；无法由路径体现的影响使用手动完整验证，不把文档计划当作语义审查豁免。\n\n文档验证不锁定自然语言措辞、章节标题、文档字节数或第二份手工清单；结构契约与职责路由见 `README.md`。覆盖率与业务安全断言保持现有门槛。本轮规则和 CI 基础设施修改必须运行完整回归，不能通过新的减负路径自我豁免。\n\n`tests/dt/project-governance.test.ts` 用临时文档目录、选择计划和实际工作流 shell 验证文案可改写、登记／链接错误仍失败、文档不扩大业务测试、必要检查失败不放行及错误部署产物不能解包；不使用固定设计句子代替行为断言。\n'
write('docs/CI_EXECUTION_DESIGN.md', design)

write('tests/dt/project-governance.test.ts', r'''import assert from 'node:assert/strict';
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
''')

# This one-use preparation file is not part of the delivered change.
Path(__file__).unlink()
