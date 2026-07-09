import { rm } from 'node:fs/promises';

export async function closeBrowserWithFallback(browser, label = 'Browser smoke') {
  if (!browser) return;
  const browserProcess = browser.process?.();
  let timer;
  try {
    await Promise.race([
      browser.close(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('browser.close timed out after 15s')), 15000);
      }),
    ]);
  } catch (error) {
    console.warn(`${label} browser close fallback: ${error?.message || error}`);
    if (browserProcess && !browserProcess.killed) browserProcess.kill('SIGKILL');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function removeTempProfileDir(profileDir, label = 'Browser smoke') {
  try {
    await rm(profileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  } catch (error) {
    console.warn(`${label} temp profile cleanup skipped: ${error?.message || error}`);
  }
}
