# Chordice: Project Summary

## Goal

An HTML website that generates practice material based on the chord progressions in `chord_progressions.yaml` and the bass notes in `bass_patterns.yaml`. It is hosted on GitHub Pages.

### Data

The YAML files live in the Git repository and are loaded by the site as part of the repository. The end user never loads or uploads them.

### Options

The user selects from several options, and the site produces concrete chord progressions. The options are:

- **Key:**
  - A single key from the circle of fifths, which contains the keys C, G, D, A, E, B, F#, F, Bb, Eb, Ab, Db, Gb. Each key is shown with its relative minor in brackets, e.g. C (Am). Only the major keys can be selected. All progressions are written in major.
- **Chord progressions:**
  - One or more chord progression groups or chord progressions from the predefined ones listed in `chord_progressions.yaml`.
  - The number of chord progressions in the sequence (1, 2, 4, 8, 12).
  - The probability of rotating the predefined chord progressions (scale from 0 to 5; 5 means 100%; non-rotation is included as one of the possible outcomes with equal probability).
  - The probability of permuting the predefined chord progressions (scale from 0 to 5; 5 means 100%; non-permutation is included as one of the possible outcomes with equal probability).
- **Chord variations:**
  - One or more chord variations that are listed in `chord_progressions.yaml`. All chord extensions available in that file are listed all the time in the following order: 7, maj7, 6, add9, sus2, sus4, 9, maj9, 11, maj11, 13, maj13, 6/9, 5, ... (`base` variation is not shown here). 
  - The probability of choosing a chord variation (scale from 0 to 5; 5 means 100%). `chord_progressions.yaml` lists the chord variations for each genre with their commonness on a scale from 1 to 5. The commonness defines the probability with which a variation is chosen (including `base` variation).
  - A `#b` button beside the Chord variations heading, on by default. On: all chord variations are used. Off: only chord variations whose chord (base triad and added tones) has no tone foreign to the key of the row are used, e.g. I7 is left out in C because Bb is foreign, while I add9 stays. The state is kept in cookies.
- **Bass notes** (written e.g. as C/E):
  - The probability of choosing a bass note (scale from 0 to 5; 5 means 100%). `bass_patterns.yaml` lists the bass notes for each chord degree and chord varation whith their commonness on a scale from 1 to 5. The commonness defines the probability with which a bass note is chosen (including `1` bass note).
- **View:**
  - Plain view of chords (e.g. C, F, G, C) or extended view.
  - Background colors on/off.
  - Inversions on/off. When on, every chord is shown in one of its inversions, chosen at random. Each position of the chord is equally likely, and the root position is one of them. An extended chord has as many positions as it has tones. An inversion puts another chord tone at the bottom, e.g. C/E for the first inversion of C. Inversions are not a probability. Because the positions depend on the tones of the chord, adding or removing a chord extension can change the inversion of that chord.

Changing one option changes only that option. All other settings remain as they are. Example: If the user changes the bass note probability, the exact same chord progression and extensions remain.

### View

The website is mainly intended to work well on an iPad.

The extended view includes:

- Roman numeral.
- Chord
- Bass and chord tones, written as `bass | tones` (e.g. `e | c · e · g` for C/E). The bass is the slash bass or the root and does not change with the inversion. The chord tones are listed in the order of the chord's inversion, starting with the lowest one (e.g. `e | e · g · c` for C in first inversion).
- Background matching the harmonic function (tonic, dominant, subdominant).

When inversions are on, the top melody note of each chord is shown inside the chord box, to the right of the chord symbol, in lower case in a small oval with the colour and the border of the chord symbol, and in the size of the tones below the chord. This applies to both the plain and the extended view. A chord in root position shows its highest chord tone there.

Clicking a chord opens its notes, starting with the inversion the chord has. The bass in the notes is the slash bass or the root, in every inversion; only the upper tones are inverted. The notes window shows the chord box above the staff, as the row shows it, and the staff has no chord symbol of its own. Each click on the staff shows the next inversion, and the chord box follows it.

### Cookies

Cookies ensure that the website can be revisited in the same state as before.

## Dependencies

Dependencies can be imported via CDN.

- tonal (JavaScript)
- Additional dependencies may be used where needed.
