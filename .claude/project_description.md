# Chordice: Project Summary

## Goal

A static HTML website, hosted on GitHub Pages, that generates practice material from the chord progressions in `chord_progressions.yaml` and the bass notes in `bass_patterns.yaml`. The YAML files are part of the repository and loaded by the site; the user never uploads them. The site is mainly intended for the iPad.

## Options

The user chooses options in a side panel, and the site produces concrete chord progressions. Changing one option changes only that option; everything else (including random choices) stays the same.

- **Key:** one major key, chosen on the circle of fifths left of the chords (not in the side panel), shown with its relative minor, e.g. C (Am). A circle of fifths button in the middle of the circle instead gives 12 rows, one per key, counterclockwise from C (F# or Gb at random); the number of progressions and key selection are then greyed out.
- **Chord progressions:** groups or single progressions from `chord_progressions.yaml` (all selected on start-up), the number of progressions (1, 2, 4, 8; default 2), and probabilities (0–5) for rotating and for permuting them.
- **Chord variations:** extensions such as 7, maj7, 6, add9, sus2, sus4, 9, … with a probability (0–5); their commonness per genre in the YAML weights the choice. An `off` button disables all variations; a `#b` button (on by default) allows variations with tones foreign to the key.
- **Bass notes** (e.g. C/E): a probability (0–5); the commonness in `bass_patterns.yaml` weights the choice.
- **Melody / inversions:** the Melody button switches inversions on. Each chord is then shown in an inversion chosen by its melody note (top tone). A Strength (0–5) controls how far consecutive melody notes may jump: 0 always picks the nearest, 5 picks any inversion equally.
- **Exercises:** at most one exercise is active; it fixes certain options (greyed out) while the stored values are kept. Example: *Circle around ii7-V7-Imaj7* (Jazz Cadence in all keys with 7/maj7 only).
- **View:** plain or extended view, background colours on/off, light or dark theme.

## Display

- **Extended view:** roman numeral, chord symbol, chord tones in a column beside it (melody note in square brackets), the bass below, and a background colour by harmonic function (tonic, subdominant, dominant; minor chords darker).
- **Notes window:** clicking a chord opens its notes. Clicking the left/right half (or swiping) steps through inversions.
- **Instrument:** a piano/guitar tab in the header. Piano shows a staff; guitar shows chord diagrams from `@tombatossals/chords-db` and disables bass variations, melody and the chord tones.
- **Layout:** the side panel is on the left (up to 480px, at most half the width; full width on narrow screens). The back button closes it (it has its own history entry); a swipe right from the left edge opens it, a swipe left on it closes it, and so does a click on the song area outside the chords. The circle of fifths stands beside the chords, also while the side panel is closed. The chords and the circle can be zoomed.
- **Background:** a randomly generated watercolour painting behind the app (seeded by the song), painted on a canvas in a web worker at a limited resolution, with the paper grain laid over it by CSS; can be switched off.

## Persistence and devices

- The state (including instrument, exercise, switches) is kept in cookies, with a copy in local storage because Safari expires script cookies after seven days.
- Installable as a home-screen web app (manifest, icons); a service worker (`sw.js`) enables offline use with network-first updates; the screen stays on via Screen Wake Lock.

## Dependencies

Imported via CDN where possible:

- tonal
- svguitar (guitar diagrams)
- `@tombatossals/chords-db` (installed with npm; the page fetches `lib/guitar.json` from the CDN)
- Additional dependencies may be used where needed.
