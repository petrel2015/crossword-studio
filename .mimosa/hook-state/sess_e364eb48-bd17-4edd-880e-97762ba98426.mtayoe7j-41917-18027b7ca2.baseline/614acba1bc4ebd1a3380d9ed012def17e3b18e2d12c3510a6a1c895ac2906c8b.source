/* Algorithm tests for CW.Generator — run with: node test/gen-test.js */
'use strict';
const path = require('path');
const CW = require(path.join(__dirname, '..', 'js', 'generator.js'));
const G = CW.Generator;

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ FAIL: ' + label); }
}

/* ---- invariant checker ------------------------------------------------
   1. every entry's letters reproduce its answer on the grid
   2. every horizontal run of length>=2 is exactly one across entry and
      vice versa; same for vertical runs (no accidental/merged runs)
   3. when >=2 entries exist, every entry crosses at least one other
   4. numbers are 1..N in row-major order and sit on entry starts      */
function checkLayout(layout, label) {
  const { rows, cols, solution, entries, numbers } = layout;

  const entryAt = new Map();  // "r,c,dir" -> entry (by start cell)
  const cellOwner = new Map(); // "r,c,dir" -> entry (every cell)
  for (const e of entries) {
    ok(entryAt.get(e.row + ',' + e.col + ',' + e.dir) === undefined, label + ': no two entries share a start (' + e.answer + ')');
    entryAt.set(e.row + ',' + e.col + ',' + e.dir, e);
    for (let i = 0; i < e.len; i++) {
      const r = e.dir === 'down' ? e.row + i : e.row;
      const c = e.dir === 'across' ? e.col + i : e.col;
      ok(solution[r][c] === e.answer[i], label + ': grid letter matches ' + e.answer + '[' + i + ']');
      cellOwner.set(r + ',' + c + ',' + e.dir, e);
    }
  }

  // runs
  const acrossRuns = [], downRuns = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (solution[r][c]) {
        let e = c;
        while (e < cols && solution[r][e]) e++;
        if (e - c >= 2) acrossRuns.push([r, c, e - c]);
        c = e;
      } else c++;
    }
  }
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      if (solution[r][c]) {
        let e = r;
        while (e < rows && solution[e][c]) e++;
        if (e - r >= 2) downRuns.push([r, c, e - r]);
        r = e;
      } else r++;
    }
  }
  const acrossEntries = entries.filter(e => e.dir === 'across');
  const downEntries = entries.filter(e => e.dir === 'down');
  ok(acrossRuns.length === acrossEntries.length, label + ': across runs (' + acrossRuns.length + ') == across entries (' + acrossEntries.length + ')');
  ok(downRuns.length === downEntries.length, label + ': down runs (' + downRuns.length + ') == down entries (' + downEntries.length + ')');
  for (const [r, c, len] of acrossRuns) {
    const e = entryAt.get(r + ',' + c + ',across');
    ok(e && e.len === len, label + ': across run at ' + r + ',' + c + ' len ' + len + ' matches an entry');
  }
  for (const [r, c, len] of downRuns) {
    const e = entryAt.get(r + ',' + c + ',down');
    ok(e && e.len === len, label + ': down run at ' + r + ',' + c + ' len ' + len + ' matches an entry');
  }

  // crossings
  if (entries.length >= 2) {
    for (const e of entries) {
      let crosses = false;
      for (let i = 0; i < e.len && !crosses; i++) {
        const r = e.dir === 'down' ? e.row + i : e.row;
        const c = e.dir === 'across' ? e.col + i : e.col;
        if (cellOwner.has(r + ',' + c + ',' + (e.dir === 'across' ? 'down' : 'across'))) crosses = true;
      }
      ok(crosses, label + ': entry ' + e.answer + ' crosses at least one other entry');
    }
  }

  // numbering
  const nums = Object.values(numbers).sort((a, b) => a - b);
  const startCells = new Set(entries.map(e => e.row + ',' + e.col));
  ok(nums.length === startCells.size, label + ': number count == distinct entry start cells');
  for (let i = 0; i < nums.length; i++) ok(nums[i] === i + 1, label + ': numbers are sequential from 1');
  for (const e of entries) ok(numbers[e.row + ',' + e.col] === e.number, label + ': entry ' + e.answer + ' number matches grid');
}

function ascii(layout) {
  return layout.solution.map(row => row.map(ch => ch || '·').join(' ')).join('\n');
}

/* ---- 1. sample fruit set --------------------------------------------- */
console.log('— sample fruit puzzle —');
const sample = ['APPLE', 'BANANA', 'ORANGE', 'GRAPE', 'LEMON', 'PEACH', 'MELON', 'PLUM', 'PEAR', 'CHERRY', 'APRICOT', 'MANGO'].map(w => ({ answer: w, clue: '' }));
const fruit = G.generate(sample, { difficulty: 'medium', seed: 20260820 });
console.log(ascii(fruit));
console.log('placed ' + fruit.meta.placed + '/' + fruit.meta.total + ', grid ' + fruit.rows + 'x' + fruit.cols + ', crossings ' + fruit.meta.intersections);
console.log('unplaced:', fruit.unplaced.map(u => u.answer + ' (' + u.reasonCode + ')').join('; ') || 'none');
checkLayout(fruit, 'fruit');
ok(fruit.meta.placed >= 8, 'fruit: places most words');

/* ---- 2. difficulties produce valid layouts --------------------------- */
for (const d of ['easy', 'medium', 'hard']) {
  const L = G.generate(sample, { difficulty: d, seed: 42 });
  checkLayout(L, d);
  ok(L.meta.placed >= 6, d + ': places a reasonable number of words');
}

/* ---- 3. single word --------------------------------------------------- */
const one = G.generate([{ answer: 'ISOLATED', clue: '' }], { seed: 1 });
checkLayout(one, 'single');
ok(one.entries.length === 1 && one.unplaced.length === 0, 'single word places alone');

/* ---- 4. fully disjoint letters → honest unplaced list ----------------- */
const disjoint = G.generate([{ answer: 'ABBEY', clue: '' }, { answer: 'TOOT', clue: '' }].map(w => w), { seed: 7 });
ok(disjoint.entries.length === 1 && disjoint.unplaced.length === 1, 'disjoint letters: one placed, one reported unplaced');
ok(disjoint.unplaced[0].reasonCode === 'noShared', 'disjoint letters: reason code is noShared');

/* ---- 5. parsing -------------------------------------------------------- */
const parsed = G.parseWordList('apple | red fruit\nBanana\nap\napple & extra\nøøø\nBANANA\nGRAPE|wine fruit');
ok(parsed.words.length === 3, 'parse: 3 valid words');
ok(parsed.words[0].answer === 'APPLE' && parsed.words[0].clue === 'red fruit', 'parse: word + clue');
ok(parsed.words[2].clue === 'wine fruit', 'parse: no-space pipe tolerated');
ok(parsed.issues.length === 4, 'parse: short + spaced + no-letters + duplicate flagged');

/* ---- 6. buildLayout round-trip (share URL restore) -------------------- */
const rt = G.buildLayout(fruit.entries.map(e => ({ row: e.row, col: e.col, dir: e.dir, answer: e.answer, clue: e.clue })));
ok(rt.rows === fruit.rows && rt.cols === fruit.cols, 'round-trip: same dimensions');
ok(JSON.stringify(rt.solution) === JSON.stringify(fruit.solution), 'round-trip: identical grid');
checkLayout(rt, 'round-trip');

/* ---- 7. determinism ---------------------------------------------------- */
const a = G.generate(sample, { seed: 99 });
const b = G.generate(sample, { seed: 99 });
ok(JSON.stringify(a.solution) === JSON.stringify(b.solution), 'same seed -> same layout');
const c = G.generate(sample, { seed: 100 });
ok(JSON.stringify(a.solution) !== JSON.stringify(c.solution), 'different seed -> different layout');

/* ---- 8. stress: random word banks, all invariants ---------------------- */
const BANK = ['THEATER','MUSEUM','BRIDGE','STATION','COFFEE','BREAD','MARKET','GARDEN','WINDOW','SILVER','MARBLE','COPPER','PLANET','ORBIT','COMET','MELODY','RHYTHM','GUITAR','PIANO','VIOLIN','CANVAS','BRUSH','SHADOW','LIGHT','WINTER','SUMMER','AUTUMN','SPRING','MOUNTAIN','VALLEY','RIVER','OCEAN','FOREST','DESERT','CASTLE','PALACE','VILLAGE','CITY','HARBOR','ANCHOR','SAILOR','CAPTAIN','NAVIGATOR','COMPASS','LANTERN','CANDLE','MIRROR','PILLOW','BLANKET','KITCHEN','TABLE','CHAIR','CABINET','DISH','GLASS','SPOON','KNIFE','PLATE','NAPKIN','BREAKFAST','DINNER','SUPPER'];
console.log('— stress (random subsets) —');
let totalPlaced = 0, totalWords = 0;
const t0 = Date.now();
for (let trial = 0; trial < 8; trial++) {
  const rng = CW.util.mulberry32(1000 + trial);
  const subset = [];
  const used = new Set();
  while (subset.length < 14 + (trial % 10)) {
    const w = BANK[Math.floor(rng() * BANK.length)];
    if (!used.has(w)) { used.add(w); subset.push({ answer: w, clue: '' }); }
  }
  for (const d of ['easy', 'medium', 'hard']) {
    const L = G.generate(subset, { difficulty: d, seed: 5000 + trial });
    checkLayout(L, 'stress#' + trial + '/' + d);
    totalPlaced += L.meta.placed; totalWords += L.meta.total;
  }
}
const dt = Date.now() - t0;
console.log('stress: ' + totalPlaced + '/' + totalWords + ' placed across 24 generations in ' + dt + 'ms');
ok(dt < 8000, 'stress: finishes quickly');
ok(totalPlaced / totalWords > 0.72, 'stress: places most words on average');

/* ---- 9. big set --------------------------------------------------------- */
const big = BANK.map(w => ({ answer: w, clue: '' }));
const bigL = G.generate(big, { difficulty: 'hard', seed: 31337 });
console.log('big set: placed ' + bigL.meta.placed + '/' + bigL.meta.total + ' grid ' + bigL.rows + 'x' + bigL.cols);
checkLayout(bigL, 'big');
ok(bigL.meta.placed > 35, 'big set: most of 60 words place');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
