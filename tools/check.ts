// usage: pnpm check [chromium|firefox]...
import * as childProcess from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { chromium, firefox, type Browser, type BrowserType, type Page } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'

const ROOT = path.join(import.meta.dirname, '..')
const SHOTS = path.join(ROOT, 'shots')

const PORT = 4111
const BASE = `http://127.0.0.1:${PORT}`
const PAGES = ['/', '/posts/kitchen-sink/', '/tags/']
const NOJS_PAGE = '/posts/kitchen-sink/'
const WIDTHS = [390, 768, 1280]
const VIEWPORT_HEIGHT = 900

const ENGINES: Record<string, BrowserType> = { chromium, firefox }
const POLL_MS = 100
const SERVER_TIMEOUT_MS = 5000
const FONT_TIMEOUT_MS = 5000
const MAX_PROBLEMS_SHOWN = 10
const MAX_A11Y_NODES_SHOWN = 3

async function main(args: string[]): Promise<number> {
  const unknown = args.filter(a => !(a in ENGINES))
  if (unknown.length > 0) {
    console.error(`unknown browser: ${unknown.join(', ')}. Expected any of: ${Object.keys(ENGINES).join(', ')}`)
    return 2
  }
  const engines = args.length > 0 ? args.map(a => ENGINES[a]) : Object.values(ENGINES)

  fs.mkdirSync(SHOTS, { recursive: true })
  const zola = childProcess.spawn('zola', ['serve', '--drafts', '--port', String(PORT)], { cwd: ROOT, stdio: 'ignore' })

  let ok = true
  try {
    await waitForServer()

    for (const engine of engines) {
      const browser = await engine.launch()
      ok = await engineOk(browser, engine.name()) && ok
      await browser.close()
    }
  } finally {
    zola.kill()
  }

  return ok ? 0 : 1
}

async function waitForServer() {
  for (let waited = 0; waited < SERVER_TIMEOUT_MS; waited += POLL_MS) {
    try {
      await fetch(BASE)
      return
    } catch {
      await new Promise(r => setTimeout(r, POLL_MS))
    }
  }

  throw new Error('zola serve did not start')
}

async function engineOk(browser: Browser, name: string): Promise<boolean> {
  let ok = true

  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT } })
    const page = await context.newPage()

    for (const urlPath of PAGES) {
      ok = await pageOk(page, urlPath, `${name}-${width}${slug(urlPath)}`) && ok
    }

    await context.close()
  }

  // The no-JS page is the promise to readers on weird browsers, so it gets checked too
  const width = WIDTHS[WIDTHS.length - 1]
  const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT }, javaScriptEnabled: false })
  ok = await pageOk(await context.newPage(), NOJS_PAGE, `${name}-nojs${slug(NOJS_PAGE)}`, false) && ok
  await context.close()

  return ok
}

async function pageOk(page: Page, urlPath: string, name: string, js = true): Promise<boolean> {
  await page.goto(BASE + urlPath)

  const problems: string[] = []
  if (!(await waitForFont(page))) {
    problems.push(`font did not load in ${FONT_TIMEOUT_MS}ms`)
  }

  problems.push(...await page.evaluate(checkGrid))

  // axe injects a script to run, so it can't with JS off. The same page already went through it with JS on
  if (js) {
    const axe = await new AxeBuilder({ page }).analyze()
    for (const v of axe.violations) {
      const where = v.nodes.slice(0, MAX_A11Y_NODES_SHOWN).map(n => n.target.join(' ')).join(', ')
      problems.push(`a11y ${v.id}: ${v.help} (${where})`)
    }
  }

  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true })

  console.log(`${problems.length > 0 ? 'FAIL' : 'ok  '} ${name}`)
  for (const p of problems.slice(0, MAX_PROBLEMS_SHOWN)) {
    console.log(`     ${p}`)
  }

  return problems.length === 0
}

// Polled from out here because with JS off, Firefox never resolves page promises like fonts.ready
async function waitForFont(page: Page): Promise<boolean> {
  for (let waited = 0; waited < FONT_TIMEOUT_MS; waited += POLL_MS) {
    if (await page.evaluate(() => document.fonts.status) === 'loaded') {
      return true
    }
    await page.waitForTimeout(POLL_MS)
  }

  return false
}

function slug(urlPath: string): string {
  return urlPath.replaceAll('/', '_')
}

// Runs inside the page, so it can't use anything from this file
// Every block box must start on a cell boundary and be a whole number of rows tall
function checkGrid(): string[] {
  const PROBE_CHARS = 100
  const TOLERANCE = 0.02
  const SNIPPET_CHARS = 30
  const BLOCK_DISPLAYS = ['block', 'list-item', 'table', 'flex', 'table-row']

  const main = document.querySelector('main')!
  const style = getComputedStyle(main)
  const lh = parseFloat(style.lineHeight)

  const probe = document.createElement('span')
  probe.textContent = 'M'.repeat(PROBE_CHARS)
  probe.style.cssText = 'position: absolute; white-space: pre'
  main.append(probe)
  const cw = probe.getBoundingClientRect().width / PROBE_CHARS
  probe.remove()

  // ponytail: grid origin is main's content box until the castle exists, then measure from #walls
  const box = main.getBoundingClientRect()
  const originX = box.left + parseFloat(style.paddingLeft)
  const originY = box.top

  const offGrid = (v: number, unit: number) => Math.abs(v / unit - Math.round(v / unit)) > TOLERANCE

  const out: string[] = []
  for (const el of main.querySelectorAll('*')) {
    if (!BLOCK_DISPLAYS.includes(getComputedStyle(el).display)) {
      continue
    }

    const b = el.getBoundingClientRect()
    const x = b.left - originX
    const y = b.top - originY

    if (offGrid(x, cw) || offGrid(y, lh) || offGrid(b.height, lh)) {
      const tag = el.tagName.toLowerCase() + (el.className ? `.${el.className}` : '')
      const text = el.textContent!.slice(0, SNIPPET_CHARS).trim()
      out.push(`${tag} "${text}" at ${x},${y} h=${b.height}`)
    }
  }

  return out
}

process.exit(await main(process.argv.slice(2)))
