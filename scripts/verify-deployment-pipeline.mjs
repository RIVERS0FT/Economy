import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const deployPath = resolve(root, '.github/workflows/deploy.yml');
const workflow = readFileSync(deployPath, 'utf8');
const failures = [];

const requireText = (text, reason) => {
  if (!workflow.includes(text)) failures.push(reason ?? `deploy.yml 缺少: ${text}`);
};

requireText('  build:\n', '部署工作流必须保留独立 build 验证 Job');
requireText('  browser-test:\n', '部署工作流必须保留独立 browser-test 验证 Job');
requireText('      fail-fast: false\n', '浏览器分片必须允许其他 shard 完成以保留完整诊断');
requireText('        shard: [1, 2, 3, 4]\n', '浏览器回归必须固定为四个 shard');
requireText('npm run test:browser -- --shard=${{ matrix.shard }}/4', '浏览器验证必须按四分片执行完整 Playwright 集合');
requireText('  deploy:\n    needs:\n      - build\n      - browser-test\n', '生产部署必须等待 build 与全部 browser shard 成功');
requireText('npm run build', 'build 验证 Job 必须执行完整 npm run build');
requireText('npm run generate:artwork', '部署 Job 必须从同一源码 SHA 重新生成运行时美术资产');
requireText('./node_modules/.bin/tsc', '部署 Job 必须在上传前执行 TypeScript 生产构建检查');
requireText('./node_modules/.bin/vite build', '部署 Job 必须从同一源码 SHA 生成生产 dist');
requireText('ECONOMY_NODE_RUNTIME_REUSE', '固定 Node runtime 命中时必须跳过重复下载和上传');
requireText('RUNTIME_UPLOAD: ${{ steps.prepare_runtime.outputs.upload }}', 'Node runtime 上传必须由版本探测结果控制');
requireText('  report-validation-failure:\n', '验证失败必须写入 deploy/economy 失败状态');
requireText('needs: [build, browser-test]', '验证失败状态 Job 必须等待 build 与 browser-test');

const browserIndex = workflow.indexOf('  browser-test:\n');
const deployIndex = workflow.indexOf('  deploy:\n');
const reportIndex = workflow.indexOf('  report-validation-failure:\n');
if (!(browserIndex >= 0 && deployIndex > browserIndex && reportIndex > deployIndex)) {
  failures.push('部署工作流顺序必须是并行验证定义 → deploy → 验证失败状态报告');
}

const deploySection = deployIndex >= 0
  ? workflow.slice(deployIndex, reportIndex >= 0 ? reportIndex : workflow.length)
  : '';
if (deploySection.includes('npm run test:browser')) {
  failures.push('deploy Job 不得重新串行执行完整浏览器测试');
}
if (deploySection.includes('npm run build\n')) {
  failures.push('deploy Job 不得重新串行执行完整 npm run build');
}

if (failures.length > 0) {
  console.error(`部署并行门禁验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('部署并行门禁验证通过：main 构建与四分片浏览器回归并行，生产部署等待全部门禁，并复用匹配的固定 Node runtime。');
