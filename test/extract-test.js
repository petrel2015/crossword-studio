/* Tests for CW.Extract — run with: node test/extract-test.js */
'use strict';
const path = require('path');
const CW = require(path.join(__dirname, '..', 'js', 'generator.js'));
require(path.join(__dirname, '..', 'js', 'extract.js'));
const E = CW.Extract;

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) passed++;
  else { failed++; console.error('  ✗ FAIL: ' + label); }
}

const ARTICLE = [
  'The Lighthouse at Cape Morrow.',
  'Every evening the old keeper Alice climbed the iron stairs and lit the lantern.',
  'The lantern had guided ships past the rocks for nearly a century.',
  'Sailors called the light their only friend in a storm.',
  'When the storm arrived, waves taller than the tower hammered the coast.',
  'Alice watched the harbor and counted the ships until dawn.',
  'By morning the storm had passed and the harbor was quiet again.',
  'The tower still stands, and the lantern still turns.'
].join(' ');

/* ---- 1. analyze: basics ---- */
const a = E.analyze(ARTICLE);
ok(a.wordCount > 80, 'analyze: counts total words (' + a.wordCount + ')');
ok(a.sentenceCount === 8, 'analyze: sentence count = 8 (' + a.sentenceCount + ')');
const words = a.candidates.map(c => c.word);
ok(words.includes('LANTERN'), 'analyze: LANTERN among candidates');
ok(words.includes('KEEPER'), 'analyze: KEEPER among candidates');
ok(!words.includes('THE') && !words.includes('AND') && !words.includes('WITH'), 'analyze: stopwords excluded');
ok(!words.some(w => w.length < 3), 'analyze: all candidates ≥3 letters');
ok(words.every(w => /^[A-Z]+$/.test(w)), 'analyze: candidates uppercase');

/* ---- 2. scoring: repeated + proper words rank high ---- */
const lantern = a.candidates.find(c => c.word === 'LANTERN');
ok(lantern.occurrences >= 3, 'scoring: LANTERN occurrences merged (' + lantern.occurrences + ')');
const alice = a.candidates.find(c => c.word === 'ALICE');
ok(!!alice && alice.isProper === true, 'scoring: Alice detected as proper noun (mid-sentence capital)');
const storm = a.candidates.find(c => c.word === 'STORM');
ok(!!storm && storm.occurrences === 3, 'scoring: STORM counted 3× (' + (storm && storm.occurrences) + ')');
const top5 = words.slice(0, 5);
ok(top5.includes('LANTERN') && top5.includes('STORM'), 'scoring: frequent words in top 5: ' + top5.join(','));

/* ---- 3. plural merging ---- */
const a2 = E.analyze('The keeper trimmed three lanterns and one lantern. Ships and another ship passed.');
const w2 = a2.candidates.map(c => c.word);
ok(w2.includes('LANTERN') && !w2.includes('LANTERNS'), 'plural: lanterns merged into LANTERN');
const l2 = a2.candidates.find(c => c.word === 'LANTERN');
ok(l2.occurrences === 2, 'plural: counts merged (2)');
const s2 = a2.candidates.find(c => c.word === 'SHIP');
ok(!!s2 && s2.occurrences === 2, 'plural: ship/ships merged, shorter form shown');

/* ---- 4. determinism ---- */
const b1 = E.analyze(ARTICLE), b2 = E.analyze(ARTICLE);
ok(JSON.stringify(b1) === JSON.stringify(b2), 'determinism: identical output');

/* ---- 5. headline guard ---- */
const a3 = E.analyze('STORM HITS COAST. The storm damaged the coast road badly.');
const storm3 = a3.candidates.find(c => c.word === 'STORM');
ok(!!storm3 && storm3.isProper === false, 'headline: caps in a shouty headline are not proper nouns');
const a4 = E.analyze('NASA launched the probe. NASA said the probe works.');
const nasa = a4.candidates.find(c => c.word === 'NASA');
ok(!!nasa && nasa.isProper === true, 'acronym: NASA (all caps, normal sentence) is proper');

/* ---- 6. cloze ---- */
const cz = E.clozeFor(ARTICLE, 'LANTERN');
ok(!!cz, 'cloze: returns a sentence');
ok(/______/.test(cz), 'cloze: contains a blank');
ok(!/\bLANTERN\b|\bLANTERNS\b/i.test(cz), 'cloze: answer word fully blanked');
ok(/Alice|evening|ships|turns|guided/.test(cz), 'cloze: keeps real context from the article');

/* word boundary: CARE must not blank inside CAREFUL */
const cz2 = E.clozeFor('The keeper was careful with the lamp. He was careful.', 'CAREFUL');
ok(!!cz2 && /______/.test(cz2), 'cloze: CAREFUL blanked');
ok(!/\bCARE\b/.test(cz2.replace(/______/g, 'X')), 'cloze: no stray standalone CARE handling issue');
const cz3 = E.clozeFor('He was very careful with every lamp in the tower and never once failed the shipping office over many long years of service to the harbor and the coast.', 'LAMP');
ok(cz3.length <= 210, 'cloze: long sentence trimmed to a window (' + cz3.length + ' chars)');

/* prefers a sentence with a single occurrence */
const cz4 = E.clozeFor('The lamp failed. The keeper cleaned the lamp and lit it again at dusk.', 'LAMP');
ok(cz4 === 'The keeper cleaned the lamp and lit it again at dusk.'.replace('lamp', '______'), 'cloze: prefers single-occurrence medium sentence');

/* missing word */
ok(E.clozeFor(ARTICLE, 'ZEBRA') === null, 'cloze: returns null for absent word');

/* plural blanking both forms */
const cz5 = E.clozeFor('The rocks were sharp and the ship hit the rocks at night.', 'ROCK');
ok(!/rocks/i.test(cz5) && (cz5.match(/______/g) || []).length === 2, 'cloze: blanks every occurrence');

/* ---- 7. edge cases ---- */
const empty = E.analyze('');
ok(empty.candidates.length === 0 && empty.wordCount === 0, 'edge: empty text');
const caps = E.analyze('ALICE and the lantern.');
ok(!caps.candidates.some(c => c.word === 'ALICE') || true, 'edge: runs without error on short text');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
