// usage: pnpm check [chromium|firefox]...
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { chromium, firefox, type Browser, type BrowserType, type Page } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const ROOT = path.join(import.meta.dirname, '..');
const SHOTS = path.join(ROOT, 'shots');

const HOST = '127.0.0.1';
const PORT = 4111;
const BASE = `http://${HOST}:${PORT}`;
const PAGES = ['/', '/posts/kitchen-sink/', '/tags/'];
const NOJS_PAGE = '/posts/kitchen-sink/';
const WIDTHS = [390, 768, 1280];
const VIEWPORT_HEIGHT = 900;

const ENGINES: Record<string, BrowserType> = { chromium, firefox };
const POLL_MS = 100;
const SERVER_TIMEOUT_MS = 5000;
const FONT_TIMEOUT_MS = 5000;
const MAX_PROBLEMS_SHOWN = 10;
const MAX_A11Y_NODES_SHOWN = 3;

// Runs inside the page, so it can't use anything from this file
function checkGrid(): string[] {
  const PROBE_CHARS = 100;
  const TOLERANCE = 0.02;
  const SNIPPET_CHARS = 30;
  const BLOCK_DISPLAYS = ['block', 'list-item', 'table', 'flex', 'table-row'];

  // Same measuring as walls.ts, keep them in sync
  const walls = document.getElementById('walls')!;
  const court = document.getElementById('court')!;
  const style = getComputedStyle(court);
  const lh = parseFloat(style.lineHeight);

  const probe = document.createElement('span');
  probe.textContent = 'M'.repeat(PROBE_CHARS);
  probe.style.cssText = 'position: absolute; white-space: pre';
  court.append(probe);
  const cw = probe.getBoundingClientRect().width / PROBE_CHARS;
  probe.remove();

  const out: string[] = [];
  const offGrid = (v: number, unit: number) => Math.abs(v / unit - Math.round(v / unit)) > TOLERANCE;

  // With the castle painted, content must line up with it. Without JS there's no castle, only the column itself.
  let originX: number;
  let originY: number;
  if (walls.dataset.cols) {
    const box = walls.getBoundingClientRect();
    originX = box.left;
    originY = box.top;

    // A glyph from a fallback font has a different width and drags the rest of its row along.
    // Padding or wrapping rows would also throw the castle off while its box still looks aligned.
    const width = Number(walls.dataset.cols) * cw;
    const height = walls.textContent!.split('\n').length * lh;
    if (Math.abs(box.width - width) > TOLERANCE * cw) {
      out.push(`walls are ${box.width}px wide, expected ${width}px (glyph width drift or padding)`);
    }
    if (Math.abs(box.height - height) > TOLERANCE * lh) {
      out.push(`walls are ${box.height}px tall, expected ${height}px (wrapping rows or padding)`);
    }
  } else {
    const box = court.getBoundingClientRect();
    originX = box.left + parseFloat(style.paddingLeft);
    originY = box.top;
  }

  for (const el of court.querySelectorAll('*')) {
    if (!BLOCK_DISPLAYS.includes(getComputedStyle(el).display)) {
      continue;
    }

    const b = el.getBoundingClientRect();
    const x = b.left - originX;
    const y = b.top - originY;

    if (offGrid(x, cw) || offGrid(y, lh) || offGrid(b.height, lh)) {
      const tag = el.tagName.toLowerCase() + (el.className ? `.${el.className}` : '');
      const text = el.textContent!.slice(0, SNIPPET_CHARS).trim();
      out.push(`${tag} "${text}" at ${x},${y} h=${b.height}`);
    }
  }

  return out;
}

function slug(urlPath: string): string {
  return urlPath.replaceAll('/', '_');
}

// Polled from out here because with JS off, Firefox never resolves page promises like fonts.ready
async function waitForFont(page: Page): Promise<boolean> {
  for (let waited = 0; waited < FONT_TIMEOUT_MS; waited += POLL_MS) {
    if (await page.evaluate(() => document.fonts.status) === 'loaded') {
      return true;
    }
    await page.waitForTimeout(POLL_MS);
  }

  return false;
}

async function waitTwoFrames(page: Page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function pageOk(page: Page, urlPath: string, name: string, js = true): Promise<boolean> {
  await page.goto(BASE + urlPath);

  const problems: string[] = [];
  if (!(await waitForFont(page))) {
    problems.push(`font did not load in ${FONT_TIMEOUT_MS}ms`);
  }

  if (js) {
    // walls.ts repaints a frame after the font loads. Without waiting, checkGrid sees no castle and
    // mistakes the page for the no-JS one.
    await waitTwoFrames(page);
    if (!(await page.evaluate(() => document.getElementById('walls')!.dataset.cols))) {
      problems.push('castle was not painted');
    }
  }

  problems.push(...await page.evaluate(checkGrid));

  // axe injects a script to run, so it can't with JS off. The same page already went through it with JS on
  if (js) {
    // The castle is decoration hidden from screen readers, contrast rules don't apply to it
    const axe = await new AxeBuilder({ page }).exclude('#walls').analyze();
    for (const v of axe.violations) {
      const where = v.nodes.slice(0, MAX_A11Y_NODES_SHOWN).map(n => n.target.join(' ')).join(', ');
      problems.push(`a11y ${v.id}: ${v.help} (${where})`);
    }
  }

  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

  console.log(`${problems.length > 0 ? 'FAIL' : 'ok  '} ${name}`);
  for (const p of problems.slice(0, MAX_PROBLEMS_SHOWN)) {
    console.log(`     ${p}`);
  }

  return problems.length === 0;
}

async function engineOk(browser: Browser, name: string): Promise<boolean> {
  let ok = true;

  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT } });
    const page = await context.newPage();

    for (const urlPath of PAGES) {
      ok = await pageOk(page, urlPath, `${name}-${width}${slug(urlPath)}`) && ok;
    }

    await context.close();
  }

  // The no-JS page is the promise to readers on weird browsers, so it gets checked too
  const width = WIDTHS[WIDTHS.length - 1];
  const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT }, javaScriptEnabled: false });
  ok = await pageOk(await context.newPage(), NOJS_PAGE, `${name}-nojs${slug(NOJS_PAGE)}`, false) && ok;
  await context.close();

  return ok;
}

async function serverUp(): Promise<boolean> {
  try {
    await fetch(BASE);
    return true;
  } catch {
    return false;
  }
}

async function waitForServer() {
  for (let waited = 0; waited < SERVER_TIMEOUT_MS; waited += POLL_MS) {
    if (await serverUp()) {
      return;
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }

  throw new Error('zola serve did not start');
}

// Binding is the only way to know nothing else holds the port
async function checkPortAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(PORT, HOST, () => probe.close(() => resolve(true)));
  });
}

async function main(args: string[]): Promise<number> {
  const unknown = args.filter(a => !(a in ENGINES));
  if (unknown.length > 0) {
    console.error(`unknown browser: ${unknown.join(', ')}. Expected any of: ${Object.keys(ENGINES).join(', ')}`);
    return 2;
  }
  const engines = args.length > 0 ? args.map(a => ENGINES[a]) : Object.values(ENGINES);

  // Our zola couldn't start, and we'd silently test whatever stale server is there instead
  if (!(await checkPortAvailable())) {
    console.error(`port ${PORT} is taken, a leftover zola serve?`);
    return 2;
  }

  fs.mkdirSync(SHOTS, { recursive: true });
  const zola = childProcess.spawn('zola', ['serve', '--drafts', '--port', String(PORT)], { cwd: ROOT, stdio: 'ignore' });

  let ok = true;
  try {
    await waitForServer();

    for (const engine of engines) {
      const browser = await engine.launch();
      ok = await engineOk(browser, engine.name()) && ok;
      await browser.close();
    }
  } finally {
    zola.kill();
  }

  return ok ? 0 : 1;
}

process.exit(await main(process.argv.slice(2)));
