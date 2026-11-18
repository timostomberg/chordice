/**
 * Draws one guitar diagram with svguitar, from the options that guitar.js builds (see diagramOf).
 */

import { SVGuitarChord } from 'svguitar';
import { STANDARD_TUNING } from './guitar.js';

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
