import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

function windowsPythonCandidates() {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) return [];
  const root = join(process.env.LOCALAPPDATA, 'Programs', 'Python');
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => /^Python\d+$/i.test(name))
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    .map((name) => join(root, name, 'python.exe'))
    .filter(existsSync);
}

function resolvePythonExecutable() {
  const candidates = [
    process.env.PYTHON_EXECUTABLE,
    'python3',
    'python',
    ...windowsPythonCandidates(),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8', windowsHide: true });
    if (probe.status === 0) return candidate;
  }
  return candidates[0] || 'python3';
}

const pythonExecutable = resolvePythonExecutable();

export function spawnPythonSync(args, options = {}) {
  return spawnSync(pythonExecutable, args, { windowsHide: true, ...options });
}

export function pythonFailureOutput(result) {
  return result?.stderr || result?.stdout || result?.error?.message || `无法执行 ${pythonExecutable}`;
}
