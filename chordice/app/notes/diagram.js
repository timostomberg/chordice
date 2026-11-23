/**
 * The guitar diagram of the notes window: turns one shape of a fingering (see music/instruments/guitar.js) into the terms of
 * svguitar, draws it, and words the caption under it.
 */

import { SVGuitarChord } from 'svguitar';
import { STANDARD_TUNING } from '../../music/instruments/guitar.js';
import { nameHtml } from '../names.js';
import { escapeHtml } from '../escape.js';

/**
 * Replaces the content of the container with the diagram. svguitar sets a viewBox, so the diagram scales in proportion.
 * `fixedDiagramPosition` keeps the grid at the same height whether or not the diagram has muted strings ('x') above it,
 * so that shapes without them are not drawn larger or shifted up.
 */
export function renderFingering(container, diagram) {
  container.replaceChildren();
  new SVGuitarChord(container)
    .chord({ fingers: diagram.fingers, barres: diagram.barres, position: diagram.position })
    .configure({ strings: diagram.strings, frets: diagram.frets, tuning: STANDARD_TUNING, fixedDiagramPosition: true })
    .draw();
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

/**
 * The line under the notes window: which shape is shown, and for a stand-in chord, which chord it stands in for.
 * `name` and `text` turn the chord names and the rest into the output: plain text by default.
 */
export function captionOf(fingering, index = 0, { name = (value) => value, text = (value) => value } = {}) {
  if (!fingering) {
    return text('No shape for this chord in the chord database.');
  }
  const count = fingering.shapes.length;
  const shape = text(`${(index % count) + 1} / ${count}`);
  if (fingering.exact) {
    return shape;
  }
  return `${name(fingering.requested)}${text(' is not in the chord database; showing ')}${name(fingering.name)}${text('. ')}${shape}`;
}

/** The caption as HTML, with the accidentals of the chord names raised (see names.js). */
export function captionHtml(fingering, index = 0) {
  return captionOf(fingering, index, { name: nameHtml, text: escapeHtml });
}
