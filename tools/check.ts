// usage: pnpm check [chromium|firefox]...
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { chromium, firefox, type Browser, type BrowserType, type Page } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { DEFAULT_THEMES, THEMES } from '../src/themes.ts';

const ROOT = path.join(import.meta.dirname, '..');
const SHOTS = path.join(ROOT, 'shots');

const HOST = '127.0.0.1';
const PORT = 4111;
const BASE = `http://${HOST}:${PORT}`;
const NOT_FOUND_PAGE = '/does/not/exist/should/http404/';
const PAGES = ['/', '/posts/kitchen-sink/', '/about/', '/license/', '/tags/', NOT_FOUND_PAGE];
const NOJS_PAGE = '/posts/kitchen-sink/';
const THEME_PAGE = '/posts/kitchen-sink/';
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
  const lh = parseFloat(getComputedStyle(court).lineHeight);

  const probe = document.createElement('span');
  probe.textContent = 'M'.repeat(PROBE_CHARS);
  probe.style.cssText = 'position: absolute; white-space: pre';
  court.append(probe);
  const cw = probe.getBoundingClientRect().width / PROBE_CHARS;
  probe.remove();

  const out: string[] = [];
  const offGrid = (v: number, unit: number) => Math.abs(v / unit - Math.round(v / unit)) > TOLERANCE;
  const origin = walls.getBoundingClientRect();

  // A glyph from a fallback font has a different width and drags the rest of its row along.
  // Padding or wrapping rows would also throw the castle off while its box still looks aligned.
  const width = Number(walls.dataset.cols) * cw;
  const height = walls.textContent!.split('\n').length * lh;
  if (Math.abs(origin.width - width) > TOLERANCE * cw) {
    out.push(`walls are ${origin.width}px wide, expected ${width}px (glyph width drift or padding)`);
  }
  if (Math.abs(origin.height - height) > TOLERANCE * lh) {
    out.push(`walls are ${origin.height}px tall, expected ${height}px (wrapping rows or padding)`);
  }

  for (const el of court.querySelectorAll('*')) {
    // Snap boxes are padded to whole rows as a unit, whatever is inside them is free
    if (el.parentElement?.closest('[data-snap]')) {
      continue;
    }
    if (!BLOCK_DISPLAYS.includes(getComputedStyle(el).display)) {
      continue;
    }

    const b = el.getBoundingClientRect();
    const x = b.left - origin.left;
    const y = b.top - origin.top;

    if (offGrid(x, cw) || offGrid(y, lh) || offGrid(b.height, lh)) {
      const tag = el.tagName.toLowerCase() + (el.className ? `.${el.className}` : '');
      const text = el.textContent!.slice(0, SNIPPET_CHARS).trim();
      out.push(`${tag} "${text}" at ${x},${y} h=${b.height}`);
    }
  }

  return out;
}

// Runs inside the page, so it can't use anything from this file
function checkReadable(): string[] {
  const out: string[] = [];
  const root = document.documentElement;

  if (document.querySelector('main')!.innerText.trim().length === 0) {
    out.push('no visible text');
  }
  if (root.scrollWidth > root.clientWidth) {
    out.push(`page scrolls sideways: ${root.scrollWidth}px of content in ${root.clientWidth}px`);
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

function report(name: string, problems: string[]): boolean {
  console.log(`${problems.length > 0 ? 'FAIL' : 'ok  '} ${name}`);
  for (const p of problems.slice(0, MAX_PROBLEMS_SHOWN)) {
    console.log(`     ${p}`);
  }

  return problems.length === 0;
}

interface PageOptions {
  js?: boolean;
  theme?: string;
}

async function pageOk(page: Page, urlPath: string, name: string, { js = true, theme }: PageOptions = {}): Promise<boolean> {
  await page.goto(BASE + urlPath);

  const problems: string[] = [];
  if (!(await waitForFont(page))) {
    problems.push(`font did not load in ${FONT_TIMEOUT_MS}ms`);
  }

  if (js) {
    // walls.ts repaints a frame after the font loads, measuring before that would see no castle
    await waitTwoFrames(page);
    if (await page.evaluate(() => document.getElementById('walls')!.dataset.cols)) {
      problems.push(...await page.evaluate(checkGrid));
    } else {
      problems.push('castle was not painted');
    }

    const applied = await page.evaluate(() => document.documentElement.dataset.theme);
    if (theme && applied !== theme) {
      problems.push(`theme is ${applied}, expected ${theme}`);
    }

    // The castle is decoration hidden from screen readers, contrast rules don't apply to it
    const axe = await new AxeBuilder({ page }).exclude('#walls').analyze();
    for (const v of axe.violations) {
      const where = v.nodes.slice(0, MAX_A11Y_NODES_SHOWN).map(n => n.target.join(' ')).join(', ');
      problems.push(`a11y ${v.id}: ${v.help} (${where})`);
    }
  } else {
    // Without JS images can't snap to rows, so only readability is promised. axe injects a script, and this page already passed it with JS on
    problems.push(...await page.evaluate(checkReadable));
  }

  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

  return report(name, problems);
}

async function pagesOk(browser: Browser, name: string): Promise<boolean> {
  let ok = true;

  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT }, colorScheme: 'dark' });
    const page = await context.newPage();

    for (const urlPath of PAGES) {
      ok = await pageOk(page, urlPath, `${name}-${width}${slug(urlPath)}`) && ok;
    }

    await context.close();
  }

  return ok;
}

async function themesOk(browser: Browser, name: string): Promise<boolean> {
  let ok = true;
  const width = WIDTHS[WIDTHS.length - 1];
  const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT }, colorScheme: 'dark' });
  const page = await context.newPage();

  for (const theme of Object.keys(THEMES)) {
    ok = await pageOk(page, `${THEME_PAGE}?theme=${theme}`, `${name}-theme-${theme}`, { theme }) && ok;
  }

  await context.close();
  return ok;
}

async function noJsOk(browser: Browser, name: string): Promise<boolean> {
  // Narrowest width, where sideways scrolling is likeliest
  const width = WIDTHS[0];
  const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT }, javaScriptEnabled: false });
  const ok = await pageOk(await context.newPage(), NOJS_PAGE, `${name}-nojs${slug(NOJS_PAGE)}`, { js: false });
  await context.close();

  return ok;
}

// Home is pinned to the default theme, so auto lands there
async function pickerOk(browser: Browser, name: string): Promise<boolean> {
  // A light theme from a dark OS, so the saved mode has to carry it through the reload
  const other = DEFAULT_THEMES.light;
  const width = WIDTHS[WIDTHS.length - 1];
  const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT }, colorScheme: 'dark' });
  const page = await context.newPage();
  const shown = () => page.evaluate(() => document.documentElement.dataset.theme);
  const pick = async (option: string) => {
    await page.click('#themes summary');
    await page.getByRole('button', { name: option, exact: true }).click();
  };

  const problems: string[] = [];
  await page.goto(BASE + '/');

  await pick(other);
  if (await shown() !== other) {
    problems.push(`picking ${other} showed ${await shown()}`);
  }

  await page.reload();
  if (await shown() !== other) {
    problems.push(`${other} was forgotten after a reload, showing ${await shown()}`);
  }

  await pick('auto');
  if (await shown() !== DEFAULT_THEMES.dark) {
    problems.push(`picking auto on home showed ${await shown()}, expected ${DEFAULT_THEMES.dark}`);
  }

  await context.close();
  return report(`${name}-picker`, problems);
}

async function lightOsOk(browser: Browser, name: string): Promise<boolean> {
  const width = WIDTHS[WIDTHS.length - 1];
  const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT }, colorScheme: 'light' });
  const page = await context.newPage();
  const shown = () => page.evaluate(() => `${document.documentElement.dataset.theme} (${document.documentElement.dataset.mode})`);
  const problems: string[] = [];

  await page.goto(BASE + '/');
  const home = `${DEFAULT_THEMES.light} (light)`;
  if (await shown() !== home) {
    problems.push(`home showed ${await shown()}, expected ${home}`);
  }

  await page.goto(BASE + NOT_FOUND_PAGE);
  if (await shown() !== 'barren (dark)') {
    problems.push(`the 404 page showed ${await shown()}, expected its pinned barren (dark)`);
  }

  // With walls.ts gone, only the <head> script can have set the mode, which proves it happens before first paint
  await page.route('**/js/walls.js', route => route.abort());
  await page.goto(BASE + '/');
  if (await page.evaluate(() => document.documentElement.dataset.mode) !== 'light') {
    problems.push('the <head> script did not set the light mode');
  }

  await context.close();
  return report(`${name}-light-os`, problems);
}

async function engineOk(browser: Browser, name: string): Promise<boolean> {
  const pages = await pagesOk(browser, name);
  const themes = await themesOk(browser, name);
  const picker = await pickerOk(browser, name);
  const lightOs = await lightOsOk(browser, name);
  const noJs = await noJsOk(browser, name);

  return pages && themes && picker && lightOs && noJs;
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

  if (!(await checkPortAvailable())) {
    console.error(`port ${PORT} is taken, a leftover zola serve?`);
    return 2;
  }

  fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });
  const zola = childProcess.spawn('zola', ['serve', '--drafts', '--port', String(PORT)], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });

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
