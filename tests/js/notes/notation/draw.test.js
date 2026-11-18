import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const SCORE = readFileSync(new URL('../../../../chordice/js/notes/notation/draw.js', import.meta.url), 'utf8');

// The staves are centred and shorter than the drawing, so they never run out of the notes window.
test('the staves are shorter than the drawing and centred in it', () => {
  const width = Number(/const WIDTH = (\d+);/.exec(SCORE)[1]);
  const staveWidth = Number(/const STAVE_WIDTH = (\d+);/.exec(SCORE)[1]);
  const shift = Number(/const CONTENT_SHIFT = (\d+);/.exec(SCORE)[1]);
  const staveX = /const STAVE_X = \(WIDTH - STAVE_WIDTH\) \/ 2 - CONTENT_SHIFT;/.test(SCORE);
  assert.ok(staveWidth < width - 80, `STAVE_WIDTH ${staveWidth} is not shorter than the drawing`);
  assert.ok(staveX, 'STAVE_X centres the staves, shifted left by CONTENT_SHIFT');
  assert.ok(shift > 0 && shift < 20, `CONTENT_SHIFT ${shift} is a small shift to the left`);
});

// The drawing must be tall enough for the bass staff (its lines end at BASS_Y + 80) and the brace below it.
test('the drawing is tall enough for the bass staff, and scales in proportion through its viewBox', () => {
  const height = Number(/const HEIGHT = (\d+);/.exec(SCORE)[1]);
  const bassY = Number(/const BASS_Y = (\d+);/.exec(SCORE)[1]);
  assert.ok(height >= bassY + 80 + 20, `HEIGHT ${height} clips the bass staff at ${bassY + 80}`);
  assert.ok(SCORE.includes("setAttribute('viewBox'"));
});

// A text element of the drawing, as VexFlow writes it into the SVG.
function textElement(text) {
  return { textContent: text, style: {} };
}

test('words such as the chord symbol get the page font', async () => {
  const { usePageFontForWords } = await import('../../../../chordice/js/notes/notation/draw.js');
  const word = textElement('Cm7');
  usePageFontForWords({ querySelectorAll: () => [word] });
  assert.ok(word.style.fontFamily.includes('system-ui'));
});

test('music symbols in the private use area keep the font VexFlow gave them', async () => {
  const { usePageFontForWords } = await import('../../../../chordice/js/notes/notation/draw.js');
  const notehead = textElement('');
  const clef = textElement('');
  usePageFontForWords({ querySelectorAll: () => [notehead, clef] });
  assert.equal(notehead.style.fontFamily, undefined);
  assert.equal(clef.style.fontFamily, undefined);
});

// renderScore draws with VexFlow into a real (jsdom) document. jsdom has no canvas, which VexFlow only uses to measure
// text, so its "not implemented" messages are silenced; the drawing itself does not depend on them.
function installDocument() {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', () => {});
  const dom = new JSDOM('<!DOCTYPE html><body><div id="staff"></div></body>', { virtualConsole });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  return dom.window.document.getElementById('staff');
}

function uninstallDocument() {
  delete globalThis.window;
  delete globalThis.document;
}

// VexFlow draws the accidentals of a note as music symbols from the Bravura font: flat, natural and sharp.
const FLAT = '\uE260';
const SHARP = '\uE262';
const NATURAL = '\uE261';

test('renderScore draws both staves as one SVG in the drawing size, and no chord symbol', async () => {
  const container = installDocument();
  try {
    const { renderScore } = await import('../../../../chordice/js/notes/notation/draw.js');
    renderScore(container, { bass: 'C3', upper: ['Eb4', 'G4', 'Bb4', 'D5'] });
    const svgs = container.querySelectorAll('svg');
    assert.equal(svgs.length, 1);
    assert.equal(svgs[0].getAttribute('viewBox'), '0 0 400 220');
    // The chord box is drawn above the staff by the notes window, so the score draws no symbol.
    assert.ok(![...container.querySelectorAll('text')].some((text) => text.textContent === 'Cm7'), 'no chord symbol is drawn');
  } finally {
    uninstallDocument();
  }
});

test('renderScore replaces the previous drawing instead of adding a second one', async () => {
  const container = installDocument();
  try {
    const { renderScore } = await import('../../../../chordice/js/notes/notation/draw.js');
    renderScore(container, { bass: 'C3', upper: ['C4', 'E4', 'G4'] });
    renderScore(container, { bass: 'G2', upper: ['G4', 'B4', 'D5'] });
    assert.equal(container.querySelectorAll('svg').length, 1);
    const texts = [...container.querySelectorAll('text')].map((text) => text.textContent);
    assert.ok(!texts.includes('C'), 'nothing of the previous drawing is left');
  } finally {
    uninstallDocument();
  }
});

test('renderScore draws the accidentals of the notes, and none for natural notes', async () => {
  const container = installDocument();
  try {
    const { renderScore } = await import('../../../../chordice/js/notes/notation/draw.js');
    const glyphs = () => [...container.querySelectorAll('text')].map((text) => text.textContent).join('');
    renderScore(container, { bass: 'Bb2', upper: ['D4', 'F4', 'Bb4'] });
    assert.ok(glyphs().includes(FLAT), 'a flat in the voicing is drawn');
    renderScore(container, { bass: 'C3', upper: ['C4', 'E4', 'G4'] });
    assert.ok(!glyphs().includes(FLAT) && !glyphs().includes(SHARP), 'a voicing without accidentals draws none');
  } finally {
    uninstallDocument();
  }
});

test('renderScore colours a note head and its accidental like the chord tone it is, and leaves plain tones black', async () => {
  const container = installDocument();
  try {
    // The dark theme's tone colours are set on the page. The notes keep the light colours, as they sit on white paper.
    container.style.setProperty('--foreign-tone', '#ff7a6b');
    container.style.setProperty('--variation-tone', '#8fb8ff');
    const { renderScore } = await import('../../../../chordice/js/notes/notation/draw.js');
    const coloured = (colour) => container.querySelectorAll(`[fill="${colour}"]`).length;
    renderScore(container, { bass: 'C3', upper: ['C4', 'Eb4', 'G4'] }, { bass: '', upper: ['', 'foreign', ''] });
    assert.ok(coloured('#c0392b') > 0, 'the foreign note head and its flat are red');
    assert.equal(coloured('#2f5fb3'), 0, 'no tone is blue here');
    renderScore(container, { bass: 'C3', upper: ['C4', 'E4', 'G4'] });
    assert.equal(coloured('#c0392b'), 0, 'without kinds nothing is red');
  } finally {
    uninstallDocument();
  }
});

// The key signature is drawn at the start of both staves, so in G (one sharp) a sharp is drawn once per staff.
function countOf(container, glyph) {
  return [...container.querySelectorAll('text')].filter((text) => text.textContent === glyph).length;
}

test('renderScore draws the key signature of the row at the start of both staves, and no sign for the tones it shows', async () => {
  const container = installDocument();
  try {
    const { renderScore } = await import('../../../../chordice/js/notes/notation/draw.js');
    renderScore(container, { key: 'G', bass: 'G2', upper: ['G4', 'B4', 'D5', 'F#5'] });
    assert.equal(countOf(container, SHARP), 2, 'one sharp of the key signature per staff, and no sharp before the F#');
    assert.equal(countOf(container, NATURAL), 0);
  } finally {
    uninstallDocument();
  }
});

test('renderScore writes a natural before a tone foreign to the key, and leaves the key signature as it is', async () => {
  const container = installDocument();
  try {
    const { renderScore } = await import('../../../../chordice/js/notes/notation/draw.js');
    renderScore(container, { key: 'G', bass: 'G2', upper: ['G4', 'B4', 'D5', 'F4'] });
    assert.equal(countOf(container, NATURAL), 1, 'the F natural is foreign to G and gets its sign');
    assert.equal(countOf(container, SHARP), 2, 'the key signature keeps its sharps');
  } finally {
    uninstallDocument();
  }
});

test('renderScore without a key draws no key signature, and a sign before every altered tone', async () => {
  const container = installDocument();
  try {
    const { renderScore } = await import('../../../../chordice/js/notes/notation/draw.js');
    renderScore(container, { bass: 'G2', upper: ['G4', 'B4', 'D5', 'F#5'] });
    assert.equal(countOf(container, SHARP), 1, 'only the sharp of the F# itself');
  } finally {
    uninstallDocument();
  }
});

test('renderScore draws the key signature of a flat key', async () => {
  const container = installDocument();
  try {
    const { renderScore } = await import('../../../../chordice/js/notes/notation/draw.js');
    renderScore(container, { key: 'Bb', bass: 'Bb2', upper: ['D4', 'F4', 'Bb4'] });
    assert.equal(countOf(container, FLAT), 4, 'the Bb and the Eb of the key signature, once per staff, and no flat before the notes');
  } finally {
    uninstallDocument();
  }
});
