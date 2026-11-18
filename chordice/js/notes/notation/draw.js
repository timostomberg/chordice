/**
 * Draws one voicing as a grand staff with VexFlow: the bass note in the bass clef, the upper notes in the treble clef.
 */

import { Accidental, Formatter, Renderer, Stave, StaveConnector, StaveNote, Voice } from 'vexflow';
import { accidentalBeforeNote, vexKey } from './notation.js';
import { keySignatureOf } from '../../theory/keys.js';

// Drawing units. A staff is 40 units high and its lines start 40 units below its y, so the bass staff ends at BASS_Y + 80.
const WIDTH = 400;
const HEIGHT = 220;
// The staves are shorter than the drawing and centred in it, so they stay inside the notes window.
// CONTENT_SHIFT moves the whole drawing left, so that it looks centred in the window.
const STAVE_WIDTH = 280;
const CONTENT_SHIFT = 10;
const STAVE_X = (WIDTH - STAVE_WIDTH) / 2 - CONTENT_SHIFT;
// Room above the treble staff for the ledger lines of its highest notes, and below the bass staff for the brace and ledger lines.
const TREBLE_Y = 20;
const BASS_Y = 110;

const PAGE_FONT = 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

/**
 * VexFlow draws music symbols as text in the Bravura font, using characters from the Unicode private use area.
 * Only the words (the chord symbol) get the page font; the music symbols keep their own font.
 */
export function usePageFontForWords(container) {
  for (const element of container.querySelectorAll('text')) {
    if (!/[\uE000-\uF8FF]/.test(element.textContent)) {
      element.style.fontFamily = PAGE_FONT;
    }
  }
}

// The colours of the chord tones with the light theme, as main.css defines them: red for a tone foreign to the key,
// blue for a tone the variation adds. The notes always sit on white paper, so they keep these colours in the dark theme
// too. A test checks that these values match the light theme in main.css.
const TONE_COLOURS = { foreign: '#c0392b', variation: '#2f5fb3' };

/** The colour of a tone kind ('foreign' or 'variation'). Empty for a plain chord tone, which stays black. */
function toneColour(kind) {
  return TONE_COLOURS[kind] ?? '';
}

/** The accidentals to draw before the names: only those the key signature does not already show (see accidentalBeforeNote). */
function accidentalModifiers(names, signature) {
  return names
    .map((name, index) => ({ index, accidental: accidentalBeforeNote(name, signature) }))
    .filter((entry) => entry.accidental);
}

/** Colours the note heads that have a colour; colours[i] belongs to the i-th key of the note. */
function colourKeys(note, colours) {
  colours.forEach((colour, index) => {
    if (colour) {
      note.setKeyStyle(index, { fillStyle: colour, strokeStyle: colour });
    }
  });
}

/** Adds the accidentals of the names, coloured like their note heads so that a coloured note keeps its sign coloured too. */
function addAccidentals(note, names, colours, signature) {
  for (const { index, accidental } of accidentalModifiers(names, signature)) {
    const modifier = new Accidental(accidental);
    if (colours[index]) {
      modifier.setStyle({ fillStyle: colours[index], strokeStyle: colours[index] });
    }
    note.addModifier(modifier, index);
  }
}

/**
 * Draws the voicing into the container, replacing whatever it showed before. The chord symbol is not drawn here: the notes
 * window shows the chord box above the staff.
 * `key` is the major key of the row (e.g. 'G'): its key signature is drawn at the start of both staves, and only the
 * tones it does not show get an accidental. Without a key there is no signature, so every altered tone gets one.
 * `kinds` says how each tone is judged in the key (see toneKind in theory/tones.js): `upper[i]` and `bass` take 'foreign',
 * 'variation' or '' and are coloured to match the chord tones in the rows.
 */
export function renderScore(container, { bass, upper, key = null }, kinds = {}) {
  const upperColours = (kinds.upper ?? []).map(toneColour);
  const bassColour = toneColour(kinds.bass);
  const signature = key ? keySignatureOf(key) : [];
  container.replaceChildren();
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(WIDTH, HEIGHT);
  // The viewBox keeps the drawing in proportion when the window scales it.
  container.querySelector('svg').setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
  const context = renderer.getContext();

  const treble = new Stave(STAVE_X, TREBLE_Y, STAVE_WIDTH).addClef('treble');
  const bassStave = new Stave(STAVE_X, BASS_Y, STAVE_WIDTH).addClef('bass');
  if (key) {
    treble.addKeySignature(key);
    bassStave.addKeySignature(key);
  }
  treble.setContext(context).draw();
  bassStave.setContext(context).draw();
  new StaveConnector(treble, bassStave).setType('brace').setContext(context).draw();
  new StaveConnector(treble, bassStave).setType('singleLeft').setContext(context).draw();

  const upperNote = new StaveNote({ keys: upper.map((name) => vexKey(name).key), duration: 'w', clef: 'treble' });
  colourKeys(upperNote, upperColours);
  addAccidentals(upperNote, upper, upperColours, signature);
  const bassNote = new StaveNote({ keys: [vexKey(bass).key], duration: 'w', clef: 'bass' });
  colourKeys(bassNote, [bassColour]);
  addAccidentals(bassNote, [bass], [bassColour], signature);

  const trebleVoice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false).addTickables([upperNote]);
  const bassVoice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false).addTickables([bassNote]);
  // Both voices share one formatter so that their notes line up in time.
  // The notes start after the clef and the key signature, so the width for the notes is taken from the staves.
  const notesWidth = Math.min(
    treble.getNoteEndX() - treble.getNoteStartX(),
    bassStave.getNoteEndX() - bassStave.getNoteStartX(),
  ) - 10;
  new Formatter().joinVoices([trebleVoice]).joinVoices([bassVoice]).format([trebleVoice, bassVoice], notesWidth);
  trebleVoice.draw(context, treble);
  bassVoice.draw(context, bassStave);
  usePageFontForWords(container);
}
