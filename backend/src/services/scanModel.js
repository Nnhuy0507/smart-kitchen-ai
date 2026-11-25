const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { setTimeout: delay } = require('node:timers/promises');

const backend = path.resolve(__dirname, '../..');
let modelUrl;

function getScanModelUrl() {
  if (!modelUrl) modelUrl = startModel();
  return modelUrl;
}

async function startModel() {
  const venvPython = path.join(backend, '.venv', ...(process.platform === 'win32'
    ? ['Scripts', 'python.exe'] : ['bin', 'python']));
  const python = process.env.AI_PYTHON || (existsSync(venvPython) ? venvPython : 'python');
  const child = spawn(python, ['-m', 'src.convnext_service'], {
    cwd: backend,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const lines = readline.createInterface({ input: child.stdout });
  const stopped = new Promise((_, reject) => {
    child.once('error', reject);
    child.once('close', (code) => reject(new Error(`ConvNeXt stopped (exit code ${code})`)));
  });
  child.once('close', () => { modelUrl = undefined; });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const port = await Promise.race([
      stopped,
      new Promise((resolve, reject) => {
        lines.once('line', resolve);
        controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
      }),
    ]);
    if (!/^\d+$/.test(port)) throw new Error('Invalid ConvNeXt port');
    const url = `http://127.0.0.1:${port}`;
    await Promise.race([stopped, waitForModel(url, controller.signal)]);
    return url;
  } catch (error) {
    child.stdin.destroy();
    child.kill();
    throw error;
  } finally {
    controller.abort();
    clearTimeout(timeout);
    lines.close();
    child.stdout.resume();
  }
}

async function waitForModel(url, signal) {
  while (!signal.aborted) {
    const response = await fetch(`${url}/health`, { signal }).catch(() => null);
    if (response?.ok) {
      await response.body?.cancel();
      return;
    }
    await delay(250, undefined, { signal });
  }
  signal.throwIfAborted();
}

module.exports = getScanModelUrl;
