/**
 * The bass of a chord and the bass patterns, whose degrees are written relative to the chord root.
 */

// Quality of the simple interval numbers 1 to 7 when they are major/minor or perfect; 9, 11 and 13 are compound.
const SIMPLE_QUALITY = { 1: 'P', 2: 'M', 3: 'M', 4: 'P', 5: 'P', 6: 'M', 7: 'M' };

/**
 * Converts a bass pattern token, relative to the chord root, into a tonal interval: "1" → "1P", "b3" → "3m",
 * "#5" → "5A", "b7" → "7m", "9" → "9M", "#11" → "11A". Throws for tokens that are not such a degree.
 */
export function intervalOf(token) {
  const match = /^(b|#)?(\d+)$/.exec(token);
  const number = match ? Number(match[2]) : NaN;
  const simple = ((number - 1) % 7) + 1;
  const known = number >= 1 && (number <= 7 || [9, 11, 13].includes(number));
  if (!match || !known) {
    throw new Error(`Invalid chord degree in bass pattern: ${token}`);
  }
  const perfect = SIMPLE_QUALITY[simple] === 'P';
  const accidental = match[1];
  let quality = SIMPLE_QUALITY[simple];
  if (accidental === '#') {
    quality = 'A';
  } else if (accidental === 'b') {
    quality = perfect ? 'd' : 'm';
  }
  return `${number}${quality}`;
}

/** The fixed bass of a chord: its slash bass if it has one, otherwise the root (the first tone). Inversions do not change it. */
export function bassOf(tones, slashBass = null) {
  return slashBass ?? tones[0];
}
