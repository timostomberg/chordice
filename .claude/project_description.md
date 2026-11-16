# Chordice: Project Summary

## Goal

An HTML website that generates practice material based on the chord progressions in `chord_progressions.yaml`. It is hosted on GitHub Pages.

### Data

The YAML files live in the Git repository and are loaded by the site as part of the repository. The end user never loads or uploads them.

### Options

The user selects from several options, and the site produces concrete chord progressions. The options are:

- **Key:**
  - A single key from the circle of fifths, which contains the keys C, G, D, A, E, B, F#, F, Bb, Eb, Ab, Db, Gb. Each key is shown with its relative minor in brackets, e.g. C (Am). Only the major keys can be selected. All progressions are written in major.
- **Chord progressions:**
  - One or more chord progression groups or chord progressions from the predefined ones listed in `chord_progressions.yaml`.
  - The number of chord progressions in the sequence (1, 2, 4, 8, 12, 16).
  - The probability of rotating the predefined chord progressions (scale from 0% to 100% in steps of 10%; non-rotation is included as one of the possible outcomes with equal probability).
  - The probability of permuting the predefined chord progressions (scale from 0% to 100% in steps of 10%; non-permutation is included as one of the possible outcomes with equal probability).
- **Chord extensions:**
  - One or more chord extensions that are listed in `chord_progressions.yaml`. All chord extensions available in that file are listed all the time in the following order: 7, maj7, 6, add9, sus2, sus4, 9, maj9, 11, maj11, 13, maj13, 7sus4, 7b9, 7#9, 7b13, 7#5.
  - The probability of chord extensions (scale from 0% to 100% in steps of 10%; non-extension is included as one of the possible outcomes with equal probability). The chord extension must fit the current chord extensions as listed in `chord_progressions.yaml`.
- **Bass notes** (written e.g. as C/E):
  - The probability of non-standard bass notes (scale from 0% to 100% in steps of 10%; the standard bass note is included as one of the possible outcomes with equal probability). The bass notes must fit the current chord progression as listed in `chord_progressions.yaml`.
- **View:**
  - Plain view of chords (e.g. C, F, G, C) or extended view.
  - Background colors on/off.

Changing one option changes only that option. All other settings remain as they are. Example: If the user changes the bass note probability, the exact same chord progression and extensions remain.

### View

The website is mainly intended to work well on an iPad.

The extended view includes:

- Roman numeral.
- Chord
- Chord tones and bass note if the bass is not the standard (root) note (e.g. c e g / e).
- Background matching the harmonic function (tonic, dominant, subdominant).

### Cookies

Cookies ensure that the website can be revisited in the same state as before.

## Dependencies

Dependencies can be imported via CDN.

- tonal (JavaScript)
- Additional dependencies may be used where needed.
