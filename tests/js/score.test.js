import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SCORE = readFileSync(new URL('../../chordice/js/score.js', import.meta.url), 'utf8');

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
  const { usePageFontForWords } = await import('../../chordice/js/score.js');
  const word = textElement('Cm7');
  usePageFontForWords({ querySelectorAll: () => [word] });
  assert.ok(word.style.fontFamily.includes('system-ui'));
});

test('music symbols in the private use area keep the font VexFlow gave them', async () => {
  const { usePageFontForWords } = await import('../../chordice/js/score.js');
  const notehead = textElement('');
  const clef = textElement('');
  usePageFontForWords({ querySelectorAll: () => [notehead, clef] });
  assert.equal(notehead.style.fontFamily, undefined);
  assert.equal(clef.style.fontFamily, undefined);
});
