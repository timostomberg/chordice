/**
 * Shared fixtures of the tests. Not a test file itself: it reads the data files of the app and builds the small library
 * that the tests of the page state use.
 */

import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { buildBassPatterns, buildLibrary } from '../../chordice/music/data/validate.js';

const DATA = new URL('../../chordice/music/data/', import.meta.url);

/** The text of a data file in chordice/music/data/, e.g. 'chord_progressions.yaml'. */
export function readData(name) {
  return readFileSync(new URL(name, DATA), 'utf8');
}

/** The text of chord_progressions.yaml and of bass_patterns.yaml, as the app fetches them. */
export const PROGRESSIONS_TEXT = readData('chord_progressions.yaml');
export const BASS_TEXT = readData('bass_patterns.yaml');

/** The parsed data files, before validation. */
export const PROGRESSIONS_DATA = load(PROGRESSIONS_TEXT);
export const BASS_DATA = load(BASS_TEXT);

/** The progression library and the bass patterns of the app, validated as the app builds them. */
export const LIBRARY = buildLibrary(PROGRESSIONS_DATA);
export const BASS_PATTERNS = buildBassPatterns(BASS_DATA);

/** A small library of two genres and three progressions, for the tests of the page state. */
export const SMALL_LIBRARY = buildLibrary({
  Pop: { progressions: { A: ['I', 'V'], B: ['I', 'IV'] } },
  Rock: { progressions: { C: ['I', 'IV', 'V'] } },
});

/** A random source that always gives the same number, so that the seeds of a default state are fixed. */
export const FIXED = () => 0.25;
