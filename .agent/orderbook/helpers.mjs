import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

export function replaceExact(path, oldText, newText) {
  const current = readFileSync(path, 'utf8');
  if (!current.includes(oldText)) throw new Error(`${path} 缺少预期片段: ${oldText.slice(0, 120)}`);
  if (current.indexOf(oldText) !== current.lastIndexOf(oldText)) throw new Error(`${path} 预期片段不唯一: ${oldText.slice(0, 120)}`);
  writeFileSync(path, current.replace(oldText, newText));
}

export function appendOnce(path, marker, text) {
  const current = readFileSync(path, 'utf8');
  if (current.includes(marker)) return;
  appendFileSync(path, text);
}
