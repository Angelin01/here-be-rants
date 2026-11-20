import type { Rand } from './random.ts';

const MOAT = '≈';
const ROAD = '++++';
const BRIDGE = '≡≡≡≡';
const HUTS = '⌂⌂♣τ';

const TEXT_MAX = 72;
// Below this the double wall and towers don't fit, so we fall back to a thin single wall
const WIDE_MIN = 72;
const WIDE_WALL = 5;
const WIDE_PAD = 3;
// Two wide, to match the top and bottom where the moat row plus the wall's moat run make two
const WIDE_MOAT = 2;
// Meadow left beside the moat, both sides together
const WIDE_MEADOW = 6;
const NARROW_WALL = 1;
const NARROW_PAD = 1;
const NARROW_MOAT = 1;

// Courtyard rows the road runs into from the gate, and again up to the keep
const ROAD_ROWS = 2;
// Grass along the road just inside the gate keeps this far from the middle, so the road stays clear
const ROADSIDE_CLEARANCE = 4;
const MEADOW_DENSITY = 0.3;
const ROADSIDE_DENSITY = 0.15;
const HUT_DENSITY = 0.15;
const TOWER_EVERY = 24;
const TOWER_OFFSET = 18;
const TORCH_EVERY = 8;
const TORCH_OFFSET = 4;

const KEEP = art(String.raw`
╔═══╗                    ╔═══╗
║\ /║                    ║\ /║
║ • ╠═╧═╧═╧═╧═◘◘═╧═╧═╧═╧═╣ • ║
║/ \║  ►      ++      ►  ║/ \║
╚═╦═╝    ╔════◘◘════╗    ╚═╦═╝
  ╢  ☼   ║ ┌──────┐ ║   ☼  ╟
  ║      ║ │  ▲▲  │ ║      ║
  ╢  Ω   ║ └──────┘ ║   Ω  ╟
╔═╩═╗    ╚══════════╝    ╔═╩═╗
║\ /║  ♣              ♣  ║\ /║
║ • ╠═╤═╤═╤═╤════╤═╤═╤═╤═╣ • ║
║/ \║                    ║/ \║
╚═══╝                    ╚═══╝
`);

const TOWER = art(String.raw`
╔╩══╩═╗
║\   /║
║  •  ║
║/   \║
╚╦══╦═╝
`);

const MIRRORED: Record<string, string> = {
  '╔': '╗', '╗': '╔',
  '╚': '╝', '╝': '╚',
  '╠': '╣', '╣': '╠',
  '╢': '╟', '╟': '╢',
  '┌': '┐', '┐': '┌',
  '└': '┘', '┘': '└',
  '\\': '/', '/': '\\',
};

export interface Layout {
  cols: number;
  wide: boolean;
  // Courtyard width between the inner walls
  courtWidth: number;
  // Walls included, moat not
  frameWidth: number;
  // Column where the left moat starts
  moatX: number;
  // Moat width, one side
  moatWidth: number;
  // First courtyard row, right below the gate
  courtY: number;
  // Where the page content goes, in cells
  content: { col: number; row: number; width: number };
}

// Everything that changes between the wide and narrow castle
interface Style {
  // Wall thickness, one side
  wall: number;
  // Gap between the inner wall and the text
  pad: number;
  // Meadow above the moat at the top, and below it at the bottom
  meadowRows: number;
  // Empty courtyard rows between the gate and the content
  gateRows: number;
  gate: string[];
  back: string[];
}

// A rectangle of grid cells, edges included
export interface Cells {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// Fills n cells of a row, n is whatever the fixed parts left over
type Fill = (n: number) => string;

// Editors strip trailing spaces, so rows get padded back to the widest one
function art(block: string): string[] {
  const rows = block.split('\n').slice(1, -1);
  const width = Math.max(...rows.map(r => r.length));
  return rows.map(r => r.padEnd(width));
}

function even(n: number): number {
  return n - (n % 2);
}

function spaces(n: number): string {
  return ' '.repeat(Math.max(0, n));
}

function repeat(glyph: string): Fill {
  return n => glyph.repeat(Math.max(0, n));
}

function alternating(a: string, b: string): Fill {
  return n => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? a : b)).join('');
}

function braziers(every: number): Fill {
  const offset = 5;
  const endGap = 4;
  return n => Array.from({ length: n }, (_, i) => (i % every === offset && i < n - endGap ? '☼' : ' ')).join('');
}

function centered(s: string, width: number): string {
  const side = spaces((width - s.length) / 2);
  return side + s + side;
}

function mirror(s: string): string {
  return [...s].reverse().map(g => MIRRORED[g] ?? g).join('');
}

function withMirror(left: string, middle = ''): string {
  return left + middle + mirror(left);
}

// Wall rows are written as their left half and mirrored, so merlons always line up around the gate
function mirroredRows(half: number): (left: string, fill: Fill, right?: string) => string {
  return (left, fill, right = '') => withMirror(left + fill(half - left.length - right.length) + right);
}

function sprinkle(rand: Rand, glyphs: string, density: number): string {
  return rand() < density ? glyphs[Math.floor(rand() * glyphs.length)] : ' ';
}

function scatter(n: number, rand: Rand, glyphs: string, density: number): string {
  return Array.from({ length: n }, () => sprinkle(rand, glyphs, density)).join('');
}

// Anything falling outside the grid is clipped
function put(grid: string[][], r: number, c: number, s: string) {
  [...s].forEach((glyph, i) => {
    if (r >= 0 && r < grid.length && c + i >= 0 && c + i < grid[r].length) {
      grid[r][c + i] = glyph;
    }
  });
}

function meadow(cols: number, rows: number, rand: Rand, fluff: string): string[][] {
  return Array.from({ length: rows }, () => [...scatter(cols, rand, fluff, MEADOW_DENSITY)]);
}

function wideStyle(courtWidth: number): Style {
  const row = mirroredRows(courtWidth / 2 + WIDE_WALL);

  return {
    wall: WIDE_WALL,
    pad: WIDE_PAD,
    meadowRows: 1,
    gateRows: 3,
    gate: [
      row('╔═════╗', repeat(MOAT), '╔═╧═╧═╗≡≡'),
      row(String.raw`║\   /╠`, alternating('╧', '═'), '╣     ║╤╤'),
      row('║  •  ║', braziers(6), '║  ►  ║++'),
      row(String.raw`║/   \║`, spaces, '║     ║++'),
      row('╚╦══╦═╩', repeat('═'), '╩═════╝++'),
    ],
    back: [
      row('╔╩══╩═╦', repeat('═')),
      row(String.raw`║\   /║`, braziers(12)),
      row('║  •  ║', spaces),
      row(String.raw`║/   \╠`, alternating('═', '╤'), '═'),
      row('╚═════╝', repeat(MOAT)),
    ],
  };
}

function narrowStyle(courtWidth: number): Style {
  const row = mirroredRows(courtWidth / 2 + NARROW_WALL);

  return {
    wall: NARROW_WALL,
    pad: NARROW_PAD,
    meadowRows: 0,
    gateRows: 2,
    gate: [
      row('╔', alternating('═', '╧'), '╗≡≡'),
      row('║', spaces, '► ╚++'),
    ],
    back: [
      row('╚', repeat('═')),
    ],
  };
}

function style(wide: boolean, courtWidth: number): Style {
  return wide ? wideStyle(courtWidth) : narrowStyle(courtWidth);
}

// Huts only on every other row, so they never touch
function keepRow(keepRowIndex: number, courtWidth: number, rand: Rand): string {
  const row = KEEP[keepRowIndex];
  const side = (courtWidth - row.length) / 2;
  const huts = () => (keepRowIndex % 2 === 0 ? scatter(side, rand, HUTS, HUT_DENSITY) : spaces(side));
  return huts() + row + huts();
}

function roadside(road: string, rand: Rand, fluff: string): string {
  const middle = road.length / 2;
  return [...road]
    .map((c, x) => (c === ' ' && Math.abs(x - middle) > ROADSIDE_CLEARANCE ? sprinkle(rand, fluff, ROADSIDE_DENSITY) : c))
    .join('');
}

function yardRow(i: number, l: Layout, keepY: number, keepRows: number, rand: Rand, fluff: string): string {
  if (i >= keepY && i < keepY + keepRows) {
    return keepRow(i - keepY, l.courtWidth, rand);
  }

  const onRoad = i < ROAD_ROWS || (i >= keepY - ROAD_ROWS && i < keepY);
  if (!onRoad) {
    return spaces(l.courtWidth);
  }

  const road = centered(ROAD, l.courtWidth);
  return i === 1 && l.wide ? roadside(road, rand, fluff) : road;
}

function wideWallRow(i: number, yard: string, keepY: number): string {
  const t = (i % TOWER_EVERY) - TOWER_OFFSET;
  // Towers must end before the road to the keep, or they'd crash into it
  const towerFits = i - t + TOWER.length <= keepY - ROAD_ROWS;
  if (t >= 0 && t < TOWER.length && towerFits) {
    const overhang = TOWER[0].length - WIDE_WALL;
    return withMirror(TOWER[t], yard.slice(overhang, -overhang));
  }

  const merlon = i % 2 === 0 ? '╢' : '║';
  const torch = i % TORCH_EVERY === TORCH_OFFSET ? '☼ ' : '  ';
  return withMirror(' ' + merlon + torch + '║', yard);
}

export function layout(cols: number): Layout {
  const wide = cols >= WIDE_MIN;
  const moatWidth = wide ? WIDE_MOAT : NARROW_MOAT;
  const courtWidth = even(wide
    ? Math.min(cols - 2 * (WIDE_WALL + WIDE_MOAT) - WIDE_MEADOW, TEXT_MAX + 2 * WIDE_PAD)
    : cols - 2 * (NARROW_WALL + NARROW_MOAT));
  const s = style(wide, courtWidth);
  const frameWidth = courtWidth + 2 * s.wall;
  const moatX = Math.floor((cols - frameWidth - 2 * moatWidth) / 2);
  const courtY = s.meadowRows + 1 + s.gate.length;

  return {
    cols,
    wide,
    courtWidth,
    frameWidth,
    moatX,
    moatWidth,
    courtY,
    content: { col: moatX + moatWidth + s.wall + s.pad, row: courtY + s.gateRows, width: courtWidth - 2 * s.pad },
  };
}

export function castle(l: Layout, contentRows: number, rand: Rand, fluff: string): string[] {
  const s = style(l.wide, l.courtWidth);
  const keepRows = l.courtWidth >= KEEP[0].length ? KEEP.length : 0;
  // Courtyard rows, counted from the gate
  const keepY = s.gateRows + contentRows + ROAD_ROWS;
  const courtRows = keepY + keepRows + 1;
  // Grid rows, counted from the top
  const gateY = s.meadowRows + 1;
  const backY = l.courtY + courtRows;
  const height = backY + s.back.length + 1 + s.meadowRows;
  const left = l.moatX + l.moatWidth;

  const grid = meadow(l.cols, height, rand, fluff);

  for (let r = s.meadowRows; r < height - s.meadowRows; r++) {
    put(grid, r, l.moatX, MOAT.repeat(l.frameWidth + 2 * l.moatWidth));
  }

  s.gate.forEach((row, i) => put(grid, gateY + i, left, row));

  const roadX = left + s.gate[0].indexOf('≡');
  put(grid, gateY - 1, roadX, BRIDGE);
  for (let r = 0; r < gateY - 1; r++) {
    put(grid, r, roadX, ROAD);
  }

  for (let i = 0; i < courtRows; i++) {
    const yard = yardRow(i, l, keepY, keepRows, rand, fluff);
    put(grid, l.courtY + i, left, l.wide ? wideWallRow(i, yard, keepY) : withMirror('║', yard));
  }

  s.back.forEach((row, i) => put(grid, backY + i, left, row));

  return grid.map(row => row.join(''));
}

export function outline(rows: string[], frames: Cells[], bars: Cells[]): string[] {
  const grid = rows.map(row => [...row]);

  for (const { top, bottom, left, right } of frames) {
    const inner = right - left - 1;
    put(grid, top, left, '┌' + repeat('─')(inner) + '┐');
    for (let r = top + 1; r < bottom; r++) {
      put(grid, r, left, '│');
      put(grid, r, right, '│');
    }
    put(grid, bottom, left, '└' + repeat('─')(inner) + '┘');
  }

  for (const { top, bottom, left } of bars) {
    for (let r = top; r <= bottom; r++) {
      put(grid, r, left, '│');
    }
  }

  return grid.map(row => row.join(''));
}
