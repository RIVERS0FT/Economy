import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少人口政策发布规则: ${fragment}`);
  }
}

function forbidText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (content.includes(fragment)) failures.push(`${path} 恢复了已禁止的人口政策发布行为: ${fragment}`);
  }
}

requireText('server/src/population-policy.js', [
  "requestedDurationMode === undefined ? 'temporary'",
  "durationMode !== 'temporary' && durationMode !== 'permanent'",
  'let expiresAfterCycleId = null;',
  "if (durationMode === 'temporary')",
  "throw invalid('政策生效方式无效')",
  'Number(policy?.effectiveCycleId) === 0',
  '? Math.max(0, currentCycleId - policy.effectiveCycleId)',
]);

requireText('src/components/AdminPopulationControl.tsx', [
  "type DurationMode = 'temporary' | 'permanent'",
  "return !economy.policy.isDefault && economy.policy.expiresAfterCycleId === null ? 'permanent' : 'temporary'",
  'economy.policy.remainingCycles !== null',
  "setDraft((current) => ({ ...current, ...presets[name] }))",
  '限时生效',
  '永久生效',
  '实时预览',
  '发布永久政策',
  '发布 ${payload.durationCycles} 周期限时政策',
  '此政策不会自动到期，将持续到下一次发布政策或手动恢复默认政策。',
  '当前政策操作',
  '[economy.policy.updatedAt, economy.policy.expiresAfterCycleId]',
]);
forbidText('src/components/AdminPopulationControl.tsx', [
  'setPreviewVisible',
  "name: '预览政策'",
  '[economy.policy.updatedAt, economy.policy.currentCycleId',
]);

requireText('server/test/population-admin-control.test.js', [
  'custom permanent population policy survives later cycles and normalization',
  "durationMode: 'permanent'",
  'assert.equal(summary.policy.elapsedCycles, 50)',
  'population policy rejects unsupported duration modes',
]);

requireText('tests/browser/admin-runtime.spec.ts', [
  "getByRole('button', { name: '限时生效', exact: true })",
  "getByRole('button', { name: '永久生效', exact: true })",
  "getByRole('button', { name: '发布永久政策', exact: true })",
  "getByRole('button', { name: '预览政策', exact: true })).toHaveCount(0)",
  "getByLabel('政策有效周期', { exact: true })).toHaveValue('18')",
  '此政策不会自动到期，将持续到下一次发布政策或手动恢复默认政策。',
]);

requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', [
  '人口政策固定分为默认、限时自定义和永久自定义三种语义',
  '`expiresAfterCycleId = null`',
  '不得使用极大周期数模拟永久',
  '参数变化直接驱动实时影响预览，不再设置独立“预览政策”确认步骤',
  '人口政策预设只改变经济参数，不得改变限时／永久选择或有效周期',
  '当前五分钟周期、下周期时间或只读诊断刷新不得覆盖管理员尚未发布的草稿',
  '`durationMode: "temporary" | "permanent"`',
]);

if (failures.length) {
  console.error(`人口政策发布验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('人口政策发布验证通过：默认／限时／永久三态、实时预览、草稿隔离、旧请求兼容与永久无到期语义均已锁定。');
