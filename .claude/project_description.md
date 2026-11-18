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
- Chord tones in lower case, stacked in a column beside the chord symbol, on its right. The lowest tone is at the bottom and the highest at the top, in the order of the chord's inversion (e.g. C in first inversion: e at the bottom, then g, then c at the top). With the melody switch on, the top tone is circled, as it takes the place of the melody note. The bass is not listed; the slash bass is part of the chord symbol. The roman numeral and the chord symbol form one group, so they move together; the chord and the column are centred as one.
- Background matching the harmonic function (tonic, dominant, subdominant).

When inversions are on, the top melody note of each chord is shown beside the chord, in the same column and style as the chord tones, lower case and circled in the colour of the chord symbol. Alone (melody switch on, tones switch off) the column holds only this note, which is not coloured red or blue even when it is foreign to the key or added by the variation. With the tones switch on as well, the melody note is not shown separately: its top tone is circled in the column instead. This applies to both the plain and the extended view. A chord in root position shows its highest chord tone there.

Clicking a chord opens its notes, starting with the inversion the chord has. The bass in the notes is the slash bass or the root, in every inversion; only the upper tones are inverted. The notes window shows the chord box above the staff, as the row shows it, and the staff has no chord symbol of its own. A click in the left half of the window shows the previous inversion, one in the right half the next, and the chord box follows it. The window shows the number of the inversion, as "1 / 3", where 1 is the root position. Nothing in the window can be selected.

### Instrument

An instrument tab in the header, right of the Options button, chooses what a click on a chord shows. It has a piano on the left and a guitar on the right; the piano is the default.

- Piano: the notes window described above.
- Guitar: the notes window shows a guitar diagram of the chord in standard tuning, from the chord database `@tombatossals/chords-db`, in place of the staff. A click in the left half of the window shows the previous shape of the chord, one in the right half the next, with the number of the shape as "1 / 4"; the shapes that sound the bass of the chord come first. A chord the database has no shape for is shown as the most similar chord it contains, and the caption under the diagram names both chords. Without any shape, the caption says so.
- While the guitar is chosen, the Amount of the bass variations and the inversions switch in the header are greyed out and take no effect: the chords have no bass variations and no melody note. The Bass variations section cannot be opened then, and its Amount shows 0. The stored values are kept and come back when the piano is chosen.

### Cookies

Cookies ensure that the website can be revisited in the same state as before. This includes the instrument.

## Dependencies

Dependencies can be imported via CDN.

- tonal (JavaScript)
- svguitar (JavaScript), draws the guitar diagrams
- The chord database `@tombatossals/chords-db` is installed with npm for its data. The page fetches its `lib/guitar.json` from the CDN, since the package has no module entry point.
- Additional dependencies may be used where needed.
