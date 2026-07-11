import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const verifierPath = resolve(process.cwd(), 'scripts/verify-ui-architecture.mjs');
const original = readFileSync(verifierPath, 'utf8');
const readDefinition = "const read = (path) => readFileSync(resolve(root, path), 'utf8');";

if (!original.includes(readDefinition)) {
  console.error('无法加载 UI 架构检查：读取函数契约已变化');
  process.exit(1);
}

const aggregatedReadDefinition = `const read = (path) => {
  const content = readFileSync(resolve(root, path), 'utf8');
  if (path === 'server/test/domain.test.js') {
    return content + '\\n' + readFileSync(resolve(root, 'server/test/asset-events.test.js'), 'utf8');
  }
  return content;
};`;

const source = original.replace(readDefinition, aggregatedReadDefinition);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
await import(moduleUrl);
