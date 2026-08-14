import { readFileSync, writeFileSync } from 'node:fs';

const path = 'tests/stress/run.mjs';
let source = readFileSync(path, 'utf8');
const before = `  } catch (error) {\n    failures.push(String(error?.message || error || '未知压力测试错误'));\n  }\n\n  const measuredDurationMs`;
const after = `  } catch (error) {\n    failures.push(String(error?.message || error || '未知压力测试错误'));\n    if (harness) {\n      storageAfter ||= await harness.storageSnapshot();\n      diagnostics ||= harness.diagnostics();\n    }\n  }\n\n  const measuredDurationMs`;
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error('stress catch patch source not found');
  source = source.replace(before, after);
  writeFileSync(path, source);
}
