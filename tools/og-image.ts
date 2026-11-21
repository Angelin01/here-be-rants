import * as childProcess from 'node:child_process';
import * as path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.join(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'static', 'og.png');
const PORT = 4112;
const BASE = `http://127.0.0.1:${PORT}`;
// The size Open Graph previews expect, also set in base.html
const WIDTH = 1200;
const HEIGHT = 630;
const POLL_MS = 100;
const SERVER_TIMEOUT_MS = 5000;

async function waitForServer() {
  for (let waited = 0; waited < SERVER_TIMEOUT_MS; waited += POLL_MS) {
    try {
      await fetch(BASE);
      return;
    } catch {
      await new Promise(r => setTimeout(r, POLL_MS));
    }
  }

  throw new Error('zola serve did not start');
}

async function main() {
  const zola = childProcess.spawn('zola', ['serve', '--port', String(PORT)], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });

  try {
    await waitForServer();
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, colorScheme: 'dark' });

    await page.goto(`${BASE}/?theme=meadow`);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '#themes, .posts { display: none; }' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: OUT });

    await browser.close();
  } finally {
    zola.kill();
  }

  console.log(`wrote ${path.relative(ROOT, OUT)}`);
}

await main();
