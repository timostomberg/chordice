import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// These tests check the structure of the stylesheet (variables, classes, themes), not its concrete values,
// so that design changes do not need test changes.

const CHORDICE = new URL('../../chordice/', import.meta.url);
const CSS = readFileSync(new URL('css/main.css', CHORDICE), 'utf8');

/** Returns the markup and script files whose class names the stylesheet has to cover. */
function sourceFiles() {
  const files = [new URL('html/main.html', CHORDICE)];
  for (const name of readdirSync(new URL('js/', CHORDICE))) {
    files.push(new URL(`js/${name}`, CHORDICE));
  }
  return files.map((file) => readFileSync(file, 'utf8'));
}

/**
 * Class names written literally in attributes, e.g. class="chip is-on", including the literal parts of
 * template values such as class="chip${pressed ? ' is-on' : ''}". Names that only exist at runtime are checked separately.
 */
function literalClassNames() {
  const names = new Set();
  for (const source of sourceFiles()) {
    for (const [, value] of source.matchAll(/class="([^"]*)"/g)) {
      // Quoted names inside an interpolation, e.g. ' is-on' in ${pressed ? ' is-on' : ''}.
      for (const [, expression] of value.matchAll(/\$\{([^}]*)\}/g)) {
        for (const [, quoted] of expression.matchAll(/'\s*([\w-]+)\s*'/g)) {
          names.add(quoted);
        }
      }
      // Plain text around the interpolations.
      for (const token of value.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
        if (token) {
          names.add(token);
        }
      }
    }
  }
  return [...names];
}

/** The rule block of a theme selector, e.g. ':root' or ':root[data-theme="dark"]'. */
function themeBlock(selector) {
  return new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ?? '';
}

/** The custom properties declared in a block. */
function declaredProperties(block) {
  return [...block.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]);
}

test('main.css has balanced braces', () => {
  const opening = CSS.split('{').length - 1;
  const closing = CSS.split('}').length - 1;
  assert.equal(opening, closing);
  assert.ok(opening > 0);
});

test('every var() used in main.css is defined in :root', () => {
  const defined = new Set(declaredProperties(themeBlock(':root')));
  const used = [...CSS.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]);
  assert.ok(used.length > 0);
  for (const name of used) {
    assert.ok(defined.has(name), name);
  }
});

test('every custom property defined in main.css is used by a var()', () => {
  const defined = new Set([...CSS.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
  const used = new Set([...CSS.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]));
  assert.ok(defined.size > 0);
  const unused = [...defined].filter((name) => !used.has(name));
  assert.deepEqual(unused, []);
});

test('the dark theme redefines every colour variable of the light theme', () => {
  const light = declaredProperties(themeBlock(':root')).filter((name) => name !== '--touch').sort();
  const dark = declaredProperties(themeBlock(':root\\[data-theme="dark"\\]')).sort();
  assert.ok(light.length > 0);
  assert.deepEqual(dark, light);
});

test('every class used in the markup and scripts has a style rule', () => {
  const classes = literalClassNames();
  assert.ok(classes.includes('chip'));
  // Plain wrappers that need no styling of their own.
  const UNSTYLED_WRAPPERS = ['rows'];
  const unstyled = classes.filter((name) => !CSS.includes(`.${name}`) && !UNSTYLED_WRAPPERS.includes(name));
  assert.deepEqual(unstyled, []);
});

test('every class in main.css is used by the markup or scripts', () => {
  const sources = sourceFiles().join('\n');
  // Classes built at runtime, e.g. fn-${function} or is-${role}, are found by their parts: fn-tonic by "tonic".
  const isUsed = (name) => sources.includes(name) || name.split('-').every((part) => new RegExp(`\\b${part}\\b`).test(sources));
  const selectorClasses = new Set([...CSS.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]));
  const unused = [...selectorClasses].filter((name) => !isUsed(name));
  assert.deepEqual(unused, []);
});

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

test('touch targets use the shared minimum size', () => {
  assert.ok(CSS.includes('min-height: var(--touch)'));
  assert.ok(CSS.includes('--touch:'));
});

test('the toolbar, the floating Generate button and the body keep clear of the iPhone safe areas', () => {
  assert.ok(/\.toolbar\s*\{[^}]*env\(safe-area-inset-top\)/.test(CSS));
  assert.ok(/body\s*\{[^}]*env\(safe-area-inset-bottom\)/.test(CSS));
  assert.ok(/body\s*\{[^}]*env\(safe-area-inset-left\)/.test(CSS));
  assert.ok(/\.generate\s*\{[^}]*env\(safe-area-inset-bottom\)/.test(CSS));
});

test('a pinch on the options and on the chords zooms that area, not the page', () => {
  assert.ok(/\.side-panel\s*\{[^}]*touch-action: pan-x pan-y/.test(CSS));
  assert.ok(/\.content\s*\{[^}]*touch-action: pan-x pan-y/.test(CSS));
});

test('phones in portrait stack the options above the chords', () => {
  const media = /@media \(max-width: 600px\) \{([\s\S]*)\}\s*$/.exec(CSS)?.[1] ?? '';
  assert.ok(media.includes('.layout'), 'media query styles the layout');
  assert.ok(/grid-template-columns: minmax\(0, 1fr\)/.test(media));
  assert.ok(/grid-template-rows: minmax\(0, 40%\) minmax\(0, 1fr\)/.test(media));
});

test('the circle of fifths has a maximum size, so it stays moderate when the options are above the chords', () => {
  assert.ok(/\.circle\s*\{[^}]*max-width: 18rem/.test(CSS));
});

test('hiding the options hides the whole side panel', () => {
  assert.ok(/\.side-panel\[hidden\]\s*\{[^}]*display: none/.test(CSS));
});

test('the options panel and the chords scroll on their own', () => {
  assert.ok(/\.side-panel\s*\{[^}]*overflow-y: auto/.test(CSS));
  assert.ok(/\.content\s*\{[^}]*overflow-y: auto/.test(CSS));
});

test('the notes window does not override the font of the music symbols in its SVG text', () => {
  assert.ok(!/\.notes-staff svg text/.test(CSS));
});

test('the chord block is centred vertically and horizontally in the content area', () => {
  assert.ok(/\.content\s*\{[^}]*display: flex/.test(CSS));
  assert.ok(/\.content\s*\{[^}]*flex-direction: column/.test(CSS));
  assert.ok(/\.rows\s*\{[^}]*margin: auto/.test(CSS));
});

test('the progression heading centres its title and the tags on one line', () => {
  assert.ok(/\.row h2\s*\{[^}]*display: flex/.test(CSS));
  assert.ok(/\.row h2\s*\{[^}]*align-items: center/.test(CSS));
});

/**
 * The declarations of all rules for one selector, e.g. '.chord .melody'. A selector can sit in a shared rule (a selector
 * list) and in a rule of its own, so both are collected.
 */
function declarationsOf(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...CSS.matchAll(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'g'))].map((match) => match[1]).join('');
}

test('the sizes of the chord area are multiplied by --zoom, so that the text grows together with the boxes', () => {
  for (const selector of ['.row h2', '.chords', '.chord', '.chord .roman,\n.chord .tones', '.chord .melody']) {
    assert.ok(declarationsOf(selector).includes('var(--zoom'), selector);
  }
});

test('the top melody note is larger than the tones below the chord', () => {
  const size = (selector) => Number(/font-size:\s*calc\(var\(--zoom[^)]*\)\s*\*\s*([\d.]+)rem\)/.exec(declarationsOf(selector))?.[1]);
  assert.ok(size('.chord .melody') > size('.chord .roman,\n.chord .tones'));
});

test('the tones below a chord are circled in the variation and foreign colours', () => {
  // Each colour has its own rule; the circle is the rule that the two share.
  assert.match(CSS, /\.chord \.tone-variation \{[^}]*color: var\(--variation-tone\)/);
  assert.match(CSS, /\.chord \.tone-foreign \{[^}]*color: var\(--foreign-tone\)/);
  // The circle is drawn by the rule that both colours share.
  assert.ok(declarationsOf('.chord .tone-variation,\n.chord .tone-foreign,\n.chord .melody').includes('border-radius: 999px'));
});

test('the top melody note is circled like the tones below the chord, and smaller than the chord symbol', () => {
  assert.ok(declarationsOf('.chord .tone-variation,\n.chord .tone-foreign,\n.chord .melody').includes('border: 1px solid currentColor'));
  const size = (selector) => Number(/font-size:\s*calc\(var\(--zoom[^)]*\)\s*\*\s*([\d.]+)rem\)/.exec(declarationsOf(selector))?.[1]);
  assert.ok(size('.chord .melody') < size('.chord'));
});

test('the chord whose notes are open has a frame', () => {
  assert.ok(declarationsOf('.chord.is-open').includes('outline'));
});

test('the count button is always filled in the accent blue, like an active chip', () => {
  const block = declarationsOf('.chip.count-toggle');
  assert.ok(block.includes('background: var(--icon-blue)'));
  assert.ok(block.includes('border-color: var(--icon-blue)'));
  assert.ok(block.includes('color: var(--surface)'));
});

// The notes staff must not force a fill or stroke on its drawing: VexFlow sets the colour of each note as an attribute,
// and a stylesheet rule would override it, so coloured tones would stay black.
test('the notes staff does not override the colours VexFlow gives its notes', () => {
  const rules = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const forcing = rules.filter(([, selector, body]) => /notes-staff/.test(selector) && /\b(fill|stroke)\s*:/.test(body));
  assert.deepEqual(forcing.map(([, selector]) => selector.trim()), []);
});

// The notes are drawn in the colours of the light theme, on white paper, in the dark theme too. The colours in score.js
// must therefore match the light theme's tone colours here.
test('the tone colours of the notes are the light theme colours of the chord tones', () => {
  const SCORE = readFileSync(new URL('js/score.js', CHORDICE), 'utf8');
  const light = /:root\s*\{([^}]*)\}/.exec(CSS)[1];
  const colours = Object.fromEntries(
    [['foreign', '--foreign-tone'], ['variation', '--variation-tone']].map(([kind, variable]) => {
      const match = new RegExp(`${variable}:\\s*(#[0-9a-fA-F]{6})`).exec(light);
      assert.ok(match, `${variable} is defined in the light theme`);
      return [kind, match[1].toLowerCase()];
    }),
  );
  const scoreColours = /const TONE_COLOURS = (\{[^}]*\});/.exec(SCORE)[1];
  for (const [kind, colour] of Object.entries(colours)) {
    assert.ok(scoreColours.includes(`${kind}: '${colour}'`), `score.js uses ${colour} for ${kind}`);
  }
});
