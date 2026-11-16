/**
 * Draws one voicing as a grand staff with VexFlow: the bass note in the bass clef, the upper notes in the treble clef.
 */

import { Accidental, ChordSymbol, Formatter, Renderer, Stave, StaveConnector, StaveNote, Voice } from 'vexflow';
import { vexKey } from './notation.js';

// Drawing units. A staff is 40 units high and its lines start 40 units below its y, so the bass staff ends at BASS_Y + 80.
const WIDTH = 400;
const HEIGHT = 250;
// The staves are shorter than the drawing and centred in it, so they stay inside the notes window.
// CONTENT_SHIFT moves the whole drawing left, so that it looks centred in the window.
const STAVE_WIDTH = 280;
const CONTENT_SHIFT = 10;
const STAVE_X = (WIDTH - STAVE_WIDTH) / 2 - CONTENT_SHIFT;
// Room above the treble staff for the chord symbol, and below the bass staff for the brace and ledger lines.
const TREBLE_Y = 40;
const BASS_Y = 130;

const PAGE_FONT = 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

/**
 * VexFlow draws music symbols as text in the Bravura font, using characters from the Unicode private use area.
 * Only the words (the chord symbol) get the page font; the music symbols keep their own font.
 */
export function usePageFontForWords(container) {
  for (const element of container.querySelectorAll('text')) {
    if (!/[-]/.test(element.textContent)) {
      element.style.fontFamily = PAGE_FONT;
    }
  }
}

function accidentalModifiers(names) {
  return names.map((name, index) => ({ index, accidental: vexKey(name).accidental })).filter((entry) => entry.accidental);
}

/** Draws the voicing into the container, replacing whatever it showed before. The symbol is centred above the upper notes. */
export function renderScore(container, { symbol, bass, upper }) {
  container.replaceChildren();
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(WIDTH, HEIGHT);
  // The viewBox keeps the drawing in proportion when the window scales it.
  container.querySelector('svg').setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
  const context = renderer.getContext();

  const treble = new Stave(STAVE_X, TREBLE_Y, STAVE_WIDTH).addClef('treble');
  const bassStave = new Stave(STAVE_X, BASS_Y, STAVE_WIDTH).addClef('bass');
  treble.setContext(context).draw();
  bassStave.setContext(context).draw();
  new StaveConnector(treble, bassStave).setType('brace').setContext(context).draw();
  new StaveConnector(treble, bassStave).setType('singleLeft').setContext(context).draw();

  const upperNote = new StaveNote({ keys: upper.map((name) => vexKey(name).key), duration: 'w', clef: 'treble' });
  for (const { index, accidental } of accidentalModifiers(upper)) {
    upperNote.addModifier(new Accidental(accidental), index);
  }
  const chordSymbol = new ChordSymbol().setHorizontal('center').setVertical('top');
  chordSymbol.addGlyphOrText(symbol);
  upperNote.addModifier(chordSymbol, 0);
  const bassNote = new StaveNote({ keys: [vexKey(bass).key], duration: 'w', clef: 'bass' });
  for (const { index, accidental } of accidentalModifiers([bass])) {
    bassNote.addModifier(new Accidental(accidental), index);
  }

  const trebleVoice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false).addTickables([upperNote]);
  const bassVoice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false).addTickables([bassNote]);
  // Both voices share one formatter so that their notes line up in time.
  new Formatter().joinVoices([trebleVoice]).joinVoices([bassVoice]).format([trebleVoice, bassVoice], STAVE_WIDTH - 40);
  trebleVoice.draw(context, treble);
  bassVoice.draw(context, bassStave);
  usePageFontForWords(container);
}
