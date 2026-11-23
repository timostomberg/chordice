import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameHtml, nameParts } from '../../../chordice/app/names.js';

const raised = (sign) => `<span class="accidental">${sign}</span>`;
const MINOR = '<span class="minor-sign">m</span>';

test('nameHtml raises the sharp and the flat of a key or chord name', () => {
  assert.equal(nameHtml('F#'), `F${raised('♯')}`);
  assert.equal(nameHtml('Bb'), `B${raised('♭')}`);
  assert.equal(nameHtml('Ebmaj7'), `E${raised('♭')}maj7`);
});

test('nameHtml sets the minor sign after the root smaller, but not the m of maj', () => {
  assert.equal(nameHtml('Am'), `A${MINOR}`);
  assert.equal(nameHtml('D#m'), `D${raised('♯')}${MINOR}`);
  assert.equal(nameHtml('Bbm7'), `B${raised('♭')}${MINOR}7`);
  assert.equal(nameHtml('Cmaj7'), 'Cmaj7');
  assert.equal(nameHtml('Cmmaj7'), `C${MINOR}maj7`);
  // Only right after the root: a variation or a word alone has no minor sign.
  assert.equal(nameHtml('maj7'), 'maj7');
  assert.equal(nameHtml('dim'), 'dim');
});

test('nameHtml leaves names without accidentals or minor sign as they are, also the note B', () => {
  for (const name of ['C', 'B', 'Bdim', 'Cadd9', 'Csus4', 'G/B', 'IV', 'vi', 'h']) {
    assert.equal(nameHtml(name), name, name);
  }
});

test('nameHtml raises the alterations of a chord variation and the flat before a roman numeral', () => {
  assert.equal(nameHtml('7b9'), `7${raised('♭')}9`);
  assert.equal(nameHtml('7#11'), `7${raised('♯')}11`);
  assert.equal(nameHtml('bVII'), `${raised('♭')}VII`);
  assert.equal(nameHtml('C/Bb'), `C/B${raised('♭')}`);
});

test('nameHtml tells the tone b from its flat in lower case: b stays, bb is b flat, eb is e flat', () => {
  assert.equal(nameHtml('b'), 'b');
  assert.equal(nameHtml('bb'), `b${raised('♭')}`);
  assert.equal(nameHtml('eb'), `e${raised('♭')}`);
  assert.equal(nameHtml('f#'), `f${raised('♯')}`);
});

test('nameHtml keeps double accidentals together in one raised run', () => {
  assert.equal(nameHtml('Bbb'), `B${raised('♭♭')}`);
  assert.equal(nameHtml('F##'), `F${raised('♯♯')}`);
});

test('nameHtml escapes the rest of the name', () => {
  assert.equal(nameHtml('<C#>'), `&lt;C${raised('♯')}&gt;`);
});

test('nameParts splits a name into plain runs, sign runs and the minor sign, in order', () => {
  assert.deepEqual(nameParts('F#m7'), [
    { text: 'F', kind: 'text' },
    { text: '♯', kind: 'accidental' },
    { text: 'm', kind: 'minor' },
    { text: '7', kind: 'text' },
  ]);
  assert.deepEqual(nameParts('C'), [{ text: 'C', kind: 'text' }]);
});
