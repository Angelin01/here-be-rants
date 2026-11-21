import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castle, footerRow, layout, outline, type Painting, type Scenery } from './castle.ts';
import { rng } from './random.ts';

const POND_TINT = 'pond';
const SCENERY: Scenery = {
  fluff: [
    { glyphs: `"',.`, tint: 'grass', weight: 8 },
    { glyphs: '♣τ♠', tint: 'tree', weight: 3 },
    { glyphs: '*', tint: 'flower', weight: 1 },
  ],
  pond: { glyph: '≈', tint: POND_TINT },
};
const NO_FLUFF: Scenery = { fluff: [] };
const WIDE_COLS = 200;
const MIN_COLS = 30;
const MAX_COLS = 260;
const CONTENT_ROWS = [0, 1, 7, 40, 100];

// Kept separate from castle.ts on purpose: a test reusing the code's own mirror would agree with its bugs
const MIRRORED: Record<string, string> = {
  '╔': '╗', '╗': '╔',
  '╚': '╝', '╝': '╚',
  '╠': '╣', '╣': '╠',
  '╢': '╟', '╟': '╢',
  '┌': '┐', '┐': '┌',
  '└': '┘', '┘': '└',
  '\\': '/', '/': '\\',
};

function paint(cols: number, contentRows: number, seed = 'seed', scenery = SCENERY): Painting {
  return castle(layout(cols), contentRows, rng(seed), scenery);
}

function build(cols: number, contentRows: number, seed = 'seed', scenery = SCENERY): string[] {
  return paint(cols, contentRows, seed, scenery).rows;
}

function untinted(rows: string[]): Painting {
  return { rows, tints: rows.map(row => [...row].map(() => '')) };
}

// Rows can't come out too wide, the grid clips them. A wall piece of the wrong width breaks the moat instead.
test('when building at any width, then every row is cols wide and the moat is unbroken on both sides', () => {
  for (let cols = MIN_COLS; cols <= MAX_COLS; cols++) {
    const { moatX, moatWidth, frameWidth } = layout(cols);
    const rightMoatEnd = moatX + 2 * moatWidth + frameWidth - 1;

    for (const contentRows of CONTENT_ROWS) {
      for (const [i, row] of build(cols, contentRows, 'seed', NO_FLUFF).entries()) {
        const glyphs = [...row];
        const where = `cols=${cols} contentRows=${contentRows} row ${i}: "${row}"`;
        assert.equal(glyphs.length, cols, where);
        assert.equal(glyphs[moatX] === '≈', glyphs[rightMoatEnd] === '≈', where);
      }
    }
  }
});

test('given no fluff, when building at any width, then the castle is symmetric', () => {
  for (let cols = MIN_COLS; cols <= MAX_COLS; cols++) {
    const { moatX, moatWidth, frameWidth } = layout(cols);
    const rowsWithoutFluff = build(cols, 40, 'seed', NO_FLUFF).map(r => r.replace(/[⌂♣τ]/g, ' '));

    for (const [i, row] of rowsWithoutFluff.entries()) {
      const span = [...row].slice(moatX, moatX + frameWidth + 2 * moatWidth);
      const flipped = span.map(g => MIRRORED[g] ?? g).reverse();
      assert.equal(flipped.join(''), span.join(''), `cols=${cols} row ${i}`);
    }
  }
});

test('given the same seed, when building twice, then the castles match', () => {
  assert.deepEqual(build(120, 40, 'a'), build(120, 40, 'a'));
});

test('given different seeds, when building, then the castles differ', () => {
  assert.notDeepEqual(build(120, 40, 'a'), build(120, 40, 'b'));
});

test('when laying out at any width, then the content sits inside the courtyard', () => {
  for (let cols = MIN_COLS; cols <= MAX_COLS; cols++) {
    const { content, moatX, moatWidth, frameWidth } = layout(cols);
    const frameLeft = moatX + moatWidth;
    const frameRight = frameLeft + frameWidth;
    assert.ok(content.width > 0, `cols=${cols}`);
    assert.ok(content.col > frameLeft, `cols=${cols}`);
    assert.ok(content.col + content.width < frameRight, `cols=${cols}`);
  }
});

test('when the content grows, then side towers never reach the keep', () => {
  const keepTop = '╔═══╗                    ╔═══╗';
  const towerBottom = '╚╦══╦═╝';
  const backWallCorner = '╚═════╝';

  for (let contentRows = 0; contentRows <= 100; contentRows++) {
    const rows = build(120, contentRows, 'seed', NO_FLUFF);
    const keepRow = rows.findIndex(r => r.includes(keepTop));
    const lastTowerRow = rows.findLastIndex(r => r.includes(towerBottom) && !r.includes(backWallCorner));
    assert.ok(keepRow > 0, `contentRows=${contentRows}: no keep`);
    assert.ok(lastTowerRow < keepRow - 2, `contentRows=${contentRows}: tower at ${lastTowerRow}, keep at ${keepRow}`);
  }
});

test('given a footer, when building, then it gets empty rows between the keep and the back wall', () => {
  const footerRows = 3;
  const keepBottom = '╚═══╝                    ╚═══╝';
  const backWallTop = '╔╩══╩═╦';

  for (let cols = 80; cols <= MAX_COLS; cols += 10) {
    const l = layout(cols);
    const rows = castle(l, 40, rng('seed'), NO_FLUFF, footerRows).rows;
    const top = footerRow(l, 40);
    const court = (r: number) => [...rows[r]].slice(l.content.col, l.content.col + l.content.width).join('');

    assert.ok(top > rows.findIndex(r => r.includes(keepBottom)), `cols=${cols}: footer above the keep`);
    assert.ok(top + footerRows < rows.findIndex(r => r.includes(backWallTop)), `cols=${cols}: footer runs into the back wall`);
    for (let r = top; r < top + footerRows; r++) {
      assert.equal(court(r).trim(), '', `cols=${cols} row ${r}: something drawn where the footer goes`);
    }
  }
});

test('given fluff and a pond, when building, then only fluff and pond cells are tinted', () => {
  const tinted = new Set([...SCENERY.fluff.flatMap(f => [...f.glyphs]), SCENERY.pond!.glyph]);
  const { rows, tints } = paint(WIDE_COLS, 40);

  rows.forEach((row, r) => [...row].forEach((glyph, c) => {
    if (tints[r][c]) {
      assert.ok(tinted.has(glyph), `row ${r} col ${c}: "${glyph}" tinted ${tints[r][c]}`);
    }
  }));
});

// A pond reaching into the castle gets painted over, so the visible bug is one touching the moat
test('given a pond, when building wide, then ponds show up in the meadow with a gap before the moat', () => {
  let pondCells = 0;

  // From where ponds barely fit beside the castle, so a misplaced one has nowhere to hide
  for (let cols = 100; cols <= WIDE_COLS; cols += 4) {
    const { moatX, moatWidth, frameWidth } = layout(cols);
    const moatEnd = moatX + frameWidth + 2 * moatWidth;

    for (const seed of ['a', 'b', 'c', 'd']) {
      paint(cols, 100, seed).tints.forEach((row, r) => row.forEach((tint, c) => {
        if (tint !== POND_TINT) {
          return;
        }
        assert.ok(c < moatX - 1 || c > moatEnd, `cols=${cols} seed ${seed} row ${r} col ${c}: pond touches the moat`);
        pondCells++;
      }));
    }
  }

  assert.ok(pondCells > 0, 'no ponds at all');
});

test('given a pond, when building narrow, then there are no ponds', () => {
  for (let cols = MIN_COLS; cols < 72; cols++) {
    const tints = paint(cols, 40).tints.flat();
    assert.ok(!tints.includes(POND_TINT), `cols=${cols}`);
  }
});

test('given a frame, when outlining, then a box is drawn on its edges and the inside is untouched', () => {
  const rows = ['......', '......', '......', '......'];
  const frame = { top: 0, bottom: 3, left: 1, right: 4 };

  assert.deepEqual(outline(untinted(rows), [frame], []).rows, [
    '.┌──┐.',
    '.│..│.',
    '.│..│.',
    '.└──┘.',
  ]);
});

test('given a bar, when outlining, then only its left column gets a line', () => {
  const rows = ['....', '....', '....'];
  const bar = { top: 1, bottom: 2, left: 1, right: 3 };

  assert.deepEqual(outline(untinted(rows), [], [bar]).rows, [
    '....',
    '.│..',
    '.│..',
  ]);
});
