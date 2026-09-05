import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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
