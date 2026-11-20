import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castle, layout } from './castle.ts';
import { rng } from './random.ts';

const FLUFF = `"",,''..♣τ♠*`;
const NO_FLUFF = ' ';
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

function build(cols: number, contentRows: number, seed = 'seed', fluff = FLUFF): string[] {
  return castle(layout(cols), contentRows, rng(seed), fluff);
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
