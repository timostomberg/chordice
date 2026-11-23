import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allCss,
  declarationsOf as declarationsIn,
  readCss,
  themeBlock as themeBlockIn,
} from '../../helpers/stylesheets.js';

// These tests check the structure of chord.css (variables, classes, rules), not its concrete values, so that design changes
// do not need test changes. Tests that span several stylesheets read all of them, in the order the pages link them (ALL).

const CSS = readCss('chord.css');
const ALL = allCss();
const declarationsOf = (selector) => declarationsIn(CSS, selector);
const themeBlock = (selector) => themeBlockIn(CSS, selector);

test('harmonic function classes built at runtime have style rules', () => {
  for (const fn of ['tonic', 'dominant', 'subdominant']) {
    assert.ok(CSS.includes(`.fn-${fn}`), `.fn-${fn}`);
  }
});

test('every harmonic function has a major and a minor chord style', () => {
  for (const fn of ['tonic', 'subdominant', 'dominant']) {
    assert.ok(CSS.includes(`.chord.fn-${fn}.is-major`), `major ${fn}`);
    assert.ok(CSS.includes(`.chord.fn-${fn}.is-minor`), `minor ${fn}`);
  }
});

test('the sizes of the chord area are multiplied by --zoom, so that the text grows together with the boxes', () => {
  assert.ok(declarationsIn(readCss('song.css'), '.row h2').includes('var(--zoom'), '.row h2');
  for (const selector of ['.chords', '.chord', '.chord .roman,\n.chord .tones']) {
    assert.ok(declarationsOf(selector).includes('var(--zoom'), selector);
  }
});

test('with the tones switch on, the roman numeral and the chord symbol form one group, and the tones form a column beside it, on the right', () => {
  const grid = declarationsOf('.chord.has-tones');
  assert.match(grid, /display:\s*grid/);
  assert.match(grid, /grid-template-columns:\s*auto auto/);
  assert.match(declarationsOf('.chord.has-tones > .tones'), /justify-self:\s*start/);
});

test('the roman numeral and the chord symbol form one centred column, so the numeral moves with the chord', () => {
  const box = declarationsOf('.chord');
  assert.match(box, /display:\s*flex/);
  assert.match(box, /flex-direction:\s*column/);
  assert.match(box, /align-items:\s*center/);
});

test('with the tones shown, the tones have more room from the group, which is centred in the box', () => {
  const grid = declarationsOf('.chord.has-tones');
  assert.match(grid, /align-items:\s*center/);
  const gap = Number(/column-gap:\s*calc\(var\(--zoom\)\s*\*\s*([\d.]+)rem\)/.exec(grid)?.[1]);
  assert.ok(gap >= 0.5 && gap < 1.2, `gap of ${gap}rem`);
});

test('the numeral and the symbol keep a fixed distance in their own group, whatever the height of the tones', () => {
  const group = declarationsOf('.chord .chord-main');
  assert.match(group, /flex-direction:\s*column/);
  assert.match(group, /align-items:\s*center/);
  assert.match(group, /gap:\s*calc\(var\(--zoom\)\s*\*/);
});

test('the tones column is stacked upwards, so the lowest tone, which comes first, is at the bottom', () => {
  assert.match(declarationsOf('.chord.has-tones > .tones'), /flex-direction:\s*column-reverse/);
});

test('the tones below a chord are circled in the variation and foreign colours', () => {
  // Each colour has its own rule; the circle is the rule that the two share.
  assert.match(CSS, /\.chord \.tone-variation \{[^}]*color: var\(--variation-tone\)/);
  assert.match(CSS, /\.chord \.tone-foreign \{[^}]*color: var\(--foreign-tone\)/);
});

test('the circled tones have a round border of the same width', () => {
  const circled = declarationsOf('.chord .tone-variation,\n.chord .tone-foreign,\n.chord .tone-top');
  assert.ok(circled.includes('border: 1px solid currentColor'));
  assert.ok(circled.includes('border-radius: 999px'));
});

test('the top melody tone is circled in the colour of the chord symbol', () => {
  assert.match(CSS, /\.chord \.tone-top \{[^}]*color: var\(--chord-text\)/);
  assert.ok(!/\.chord \.tone-top::(before|after)/.test(CSS));
});

test('the chord whose notes are open has a frame', () => {
  assert.ok(declarationsOf('.chord.is-open').includes('outline'));
});

test('the bass below the tones is set without a box, in the colour of the tones, with space above it', () => {
  const block = declarationsOf('.chord .bass-line .tone');
  // The bass has no box and no brackets: it is set like the other tones.
  assert.ok(!block.includes('border'));
  assert.ok(!block.includes('color:'));
  assert.ok(!declarationsOf('.chord .bass-line').includes('border-top'));
  assert.ok(declarationsOf('.chord .bass-line').includes('margin-top'));
  assert.ok(!CSS.includes('--bass-tone'));
});

test('a chord under the mouse is framed like the chord whose notes are open, only for real pointers', () => {
  const hover = /@media \(hover: hover\)\s*\{[\s\S]*?\.chord\[data-action="show-notes"\]:hover\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(hover, 'chord hover rule inside a (hover: hover) media query');
  const outline = (block) => block.split(';').map((declaration) => declaration.trim()).filter((declaration) => declaration.startsWith('outline')).sort();
  assert.ok(outline(hover[1]).length > 0);
  assert.deepEqual(outline(hover[1]), outline(declarationsOf('.chord.is-open')));
});

test('hovering a chord does not change the instrument tabs', () => {
  assert.ok(!/body:has\(/.test(CSS));
});

test('the slash of the bass has a little space on both sides', () => {
  assert.match(declarationsOf('.chord .slash'), /margin: 0 [\d.]+em/);
});
