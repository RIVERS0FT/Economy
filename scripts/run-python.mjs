import { pythonFailureOutput, spawnPythonSync } from './python-runtime.mjs';

const result = spawnPythonSync(process.argv.slice(2), { stdio: 'inherit' });
if (result.status !== 0) {
  if (result.error) console.error(pythonFailureOutput(result));
  process.exit(result.status || 1);
}
