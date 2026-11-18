/**
 * Guitar shapes for the notes window, from the chord database @tombatossals/chords-db (its lib/guitar.json, standard tuning).
 *
 * A chord is looked up by its root and its variation, as chordice names them (see CHORD_TYPES). When the database has no
 * shape for the chord, the most similar chord type it contains stands in for it: first the types whose tones are all tones
 * of the chord (the one with the most tones wins), otherwise the type that shares the most tones with it.
 * Everything here is free of rendering; draw.js draws a diagram with svguitar.
 */

import { Note } from 'tonal';
import { bassOf } from '../../theory/bass.js';
import { buildChord } from '../../theory/chords.js';

/** The database's key for each pitch class, indexed by chroma (0 is C). Sharps are spelled out, e.g. "Csharp". */
const ROOT_KEYS = ['C', 'Csharp', 'D', 'Eb', 'E', 'F', 'Fsharp', 'G', 'Ab', 'A', 'Bb', 'B'];

/** The open strings of the standard tuning, left to right: low E to high E. */
export const STANDARD_TUNING = ['E', 'A', 'D', 'G', 'B', 'E'];

/**
 * The chord types the database has shapes for, which chordice can also spell (see buildChord). `suffix` is the database's
 * name for the type, `quality` and `variation` are the chordice names. Types such as a minor chord with a major seventh
 * (mmaj7) are left out: tonal cannot spell them, so chordice never builds them. The order breaks ties between similar types.
 */
export const CHORD_TYPES = [
  { suffix: 'major', quality: 'major', variation: null },
  { suffix: 'minor', quality: 'minor', variation: null },
  { suffix: '7', quality: 'major', variation: '7' },
  { suffix: 'm7', quality: 'minor', variation: '7' },
  { suffix: 'maj7', quality: 'major', variation: 'maj7' },
  { suffix: '6', quality: 'major', variation: '6' },
  { suffix: 'm6', quality: 'minor', variation: '6' },
  { suffix: 'add9', quality: 'major', variation: 'add9' },
  { suffix: 'madd9', quality: 'minor', variation: 'add9' },
  { suffix: 'sus2', quality: 'major', variation: 'sus2' },
  { suffix: 'sus4', quality: 'major', variation: 'sus4' },
  { suffix: '7sus4', quality: 'major', variation: '7sus4' },
  { suffix: '69', quality: 'major', variation: '6/9' },
  { suffix: '9', quality: 'major', variation: '9' },
  { suffix: 'm9', quality: 'minor', variation: '9' },
  { suffix: 'maj9', quality: 'major', variation: 'maj9' },
  { suffix: '11', quality: 'major', variation: '11' },
  { suffix: 'm11', quality: 'minor', variation: '11' },
  { suffix: 'maj11', quality: 'major', variation: 'maj11' },
  { suffix: '13', quality: 'major', variation: '13' },
  { suffix: 'maj13', quality: 'major', variation: 'maj13' },
  { suffix: '7b5', quality: 'major', variation: '7b5' },
  { suffix: 'm7b5', quality: 'minor', variation: '7b5' },
  { suffix: 'aug7', quality: 'major', variation: '7#5' },
  { suffix: '7b9', quality: 'major', variation: '7b9' },
  { suffix: '7#9', quality: 'major', variation: '7#9' },
];

function pitchClassesOf(tones) {
  return new Set(tones.map((tone) => Note.chroma(tone)));
}

/** The shapes the database has for one chord type of a root. Empty if it has none. */
function positionsOf(db, root, suffix) {
  const entry = db.chords[ROOT_KEYS[Note.chroma(root)]]?.find((chord) => chord.suffix === suffix);
  return entry?.positions ?? [];
}

/** Contained types first, then the ones sharing the most tones, then the fewest extra tones, then the order of CHORD_TYPES. */
function bySimilarity(a, b) {
  return Number(a.extra > 0) - Number(b.extra > 0) || b.shared - a.shared || a.extra - b.extra || a.order - b.order;
}

/**
 * The chord type that shows a chord: the database's own type for it if it has one, otherwise the most similar type it
 * contains. Returns { suffix, name, positions, exact }, where name is the type's chord symbol (e.g. "Cm9") and exact says
 * whether it has exactly the tones of the chord. Returns null if the database has no shape that shares a tone with the chord.
 */
export function chordTypeOf(chord, db) {
  const wanted = pitchClassesOf(chord.tones);
  const candidates = [];
  CHORD_TYPES.forEach((type, order) => {
    const positions = positionsOf(db, chord.root, type.suffix);
    if (positions.length === 0) {
      return;
    }
    const built = buildChord(chord.root, type.quality, type.variation);
    const pitches = pitchClassesOf(built.tones);
    const shared = [...pitches].filter((pitch) => wanted.has(pitch)).length;
    candidates.push({ suffix: type.suffix, name: built.symbol, positions, shared, extra: pitches.size - shared, order });
  });
  candidates.sort(bySimilarity);
  const best = candidates[0];
  if (!best || best.shared === 0) {
    return null;
  }
  return {
    suffix: best.suffix,
    name: best.name,
    positions: best.positions,
    exact: best.extra === 0 && best.shared === wanted.size,
  };
}

/** The lowest sounding pitch class of a shape, from its MIDI notes. */
function lowestPitchClassOf(shape) {
  return Math.min(...shape.midi) % 12;
}

/** The database's spelling of a bass note, by pitch class: sharps, and flats only for Bb (as the database has them). */
const BASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

/**
 * The database's own shapes for a major or minor triad over a bass note other than its root, e.g. C/E: the database
 * lists them under the suffix "/E", or "m/B" for a minor triad. Empty for any other chord, or if the database has none.
 */
function slashPositionsOf(chord, db) {
  if (chord.bass === null || chord.variation !== null || Note.chroma(chord.bass) === Note.chroma(chord.root)) {
    return [];
  }
  if (chord.quality !== 'major' && chord.quality !== 'minor') {
    return [];
  }
  const prefix = chord.quality === 'major' ? '/' : 'm/';
  return positionsOf(db, chord.root, `${prefix}${BASS_NAMES[Note.chroma(chord.bass)]}`);
}

/**
 * The fingering of a chord for the notes window, with `shapes` as raw database positions. A slash chord uses the database's
 * shapes for its bass (see slashPositionsOf) if it has them. The shapes whose lowest sounding string is the chord's bass come
 * first, since the bass is the slash bass or the root, as in the notes window; the others follow in the database's order.
 * Returns null if the database has no shape for the chord. `requested` is the chord's own symbol, shown when `exact` is false
 * and the chord is shown as `name`.
 */
export function fingeringOf(chord, db) {
  const type = chordTypeOf(chord, db);
  if (!type) {
    return null;
  }
  const slash = slashPositionsOf(chord, db);
  const positions = slash.length > 0 ? slash : type.positions;
  const bass = Note.chroma(bassOf(chord.tones, chord.bass));
  const matching = positions.filter((shape) => lowestPitchClassOf(shape) === bass);
  const others = positions.filter((shape) => lowestPitchClassOf(shape) !== bass);
  return {
    name: slash.length > 0 ? `${type.name}/${chord.bass}` : type.name,
    requested: buildChord(chord.root, chord.quality, chord.variation).symbol,
    exact: type.exact,
    shapes: [...matching, ...others],
  };
}

/**
 * The diagram of one shape of a fingering, in the terms svguitar draws: strings numbered from the high E (1) to the low E
 * (6), each pressed string as [string, fret], a muted string as 'x', an open string as 0 (svguitar's OPEN), and a barre for
 * every fret that holds two or more strings. The diagram shows no finger numbers. The database counts the frets from the
 * shape's first fret (`baseFret`, the diagram's position), so they are drawn as they are. Returns null without a fingering.
 * `index` picks the shape and wraps around, so that a click can step through all of them.
 */
export function diagramOf(fingering, index = 0) {
  if (!fingering || fingering.shapes.length === 0) {
    return null;
  }
  const shape = fingering.shapes[index % fingering.shapes.length];
  const count = shape.frets.length;
  const stringOf = (position) => count - position;

  const barres = [];
  const barred = new Set();
  for (const fret of shape.barres) {
    const positions = shape.frets.flatMap((value, position) => (value === fret ? [position] : []));
    if (positions.length < 2) {
      continue;
    }
    const low = Math.min(...positions);
    const high = Math.max(...positions);
    barres.push({ fromString: stringOf(low), toString: stringOf(high), fret });
    barred.add(fret);
  }

  const fingers = [];
  shape.frets.forEach((fret, position) => {
    const string = stringOf(position);
    if (fret < 0) {
      fingers.push([string, 'x']);
    } else if (fret === 0) {
      fingers.push([string, 0]);
    } else if (!barred.has(fret)) {
      fingers.push([string, fret]);
    }
  });

  // Four frets are the usual diagram; a shape that reaches further down the neck gets the frets it needs.
  const deepest = Math.max(0, ...shape.frets, ...shape.barres);
  return {
    strings: count,
    frets: Math.max(4, deepest),
    position: shape.baseFret,
    fingers,
    barres,
  };
}

/** The line under the notes window: which shape is shown, and for a stand-in chord, which chord it stands in for. */
export function captionOf(fingering, index = 0) {
  if (!fingering) {
    return 'No shape for this chord in the chord database.';
  }
  const count = fingering.shapes.length;
  const shape = `${(index % count) + 1} / ${count}`;
  if (fingering.exact) {
    return shape;
  }
  return `${fingering.requested} is not in the chord database; showing ${fingering.name}. ${shape}`;
}
