import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// These tests check the structure of the stylesheet (variables, classes, themes), not its concrete values,
// so that design changes do not need test changes.

const CHORDICE = new URL('../chordice/', import.meta.url);
const CSS = readFileSync(new URL('main.css', CHORDICE), 'utf8');

/** Returns the markup and script files whose class names the stylesheet has to cover. */
function sourceFiles() {
  const files = [new URL('main.html', CHORDICE)];
  // Every JS file in js/ and its group folders is a source file; folders themselves have no class names to check.
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
    return entry.isDirectory() ? walk(path) : [path];
  });
  files.push(...walk(new URL('js/', CHORDICE)));
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
  assert.ok(/\.circle\s*\{[^}]*max-width: 21rem/.test(CSS));
});

test('the options column is wider than before, and its text and circle are sized up to match', () => {
  assert.ok(/\.layout\s*\{[^}]*grid-template-columns: minmax\(320px, 400px\) 1fr/.test(CSS));
  assert.ok(/\.option h2\s*\{[^}]*font-size: 1\.2rem/.test(CSS));
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

test('nothing in the notes window can be selected, since its clicks step through the views', () => {
  const block = declarationsOf('.notes');
  assert.ok(block.includes('user-select: none'));
  assert.ok(block.includes('-webkit-user-select: none'));
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
  for (const selector of ['.row h2', '.chords', '.chord', '.chord .roman,\n.chord .tones']) {
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
  assert.match(group, /gap:\s*calc\(var\(--zoom\)\s*\*\s*0\.2rem\)/);
});


test('the tones column is stacked upwards, so the lowest tone, which comes first, is at the bottom', () => {
  assert.match(declarationsOf('.chord.has-tones > .tones'), /flex-direction:\s*column-reverse/);
});

test('the tones below a chord are circled in the variation and foreign colours', () => {
  // Each colour has its own rule; the circle is the rule that the two share.
  assert.match(CSS, /\.chord \.tone-variation \{[^}]*color: var\(--variation-tone\)/);
  assert.match(CSS, /\.chord \.tone-foreign \{[^}]*color: var\(--foreign-tone\)/);
  // The circle is drawn by the rule that both colours share.
  assert.ok(declarationsOf('.chord .tone-variation,\n.chord .tone-foreign,\n.chord .tone-top').includes('border-radius: 999px'));
});

test('the circled tones, the top tone among them, have a round border of the same width', () => {
  const circled = declarationsOf('.chord .tone-variation,\n.chord .tone-foreign,\n.chord .tone-top');
  assert.ok(circled.includes('border: 1px solid currentColor'));
  assert.ok(circled.includes('border-radius: 999px'));
});

// The window must keep its size when a click shows another guitar shape, so the diagram's box has a fixed height, and the
// diagram fills the box instead of taking its own height from its frets.
test('the guitar diagram sits in a box of fixed height, and fills it, so the window does not change size between shapes', () => {
  assert.match(declarationsOf('.notes-staff.is-guitar'), /height:\s*min\(\s*240px\s*,\s*40vh\s*\)/);
  assert.ok(declarationsOf('.notes-staff.is-guitar svg').includes('height: 100%'));
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

// The notes are drawn in the colours of the light theme, on white paper, in the dark theme too. The colours in draw.js
// must therefore match the light theme's tone colours here.
test('the tone colours of the notes are the light theme colours of the chord tones', () => {
  const SCORE = readFileSync(new URL('js/notes/notation/draw.js', CHORDICE), 'utf8');
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
    assert.ok(scoreColours.includes(`${kind}: '${colour}'`), `draw.js uses ${colour} for ${kind}`);
  }
});

test('an option the guitar does not use is greyed out, and so is its header switch while it is disabled', () => {
  // The greyed-out option is faded as a whole, as it was before the disabled buttons got their blue tint.
  assert.ok(declarationsOf('.option.is-unavailable').includes('opacity'));
  const block = declarationsOf('.toolbar .inversions-toggle:disabled,\n.toolbar .instrument-tab:disabled');
  assert.ok(block.includes('background: none'));
  assert.ok(block.includes('color: var(--disabled-text)'));
});

test('a disabled header switch is faded by the same opacity as a greyed-out option', () => {
  const faded = declarationsOf('.toolbar .inversions-toggle:disabled,\n.toolbar .instrument-tab:disabled');
  assert.ok(faded.includes('opacity: 0.45'));
  assert.ok(declarationsOf('.option.is-unavailable').includes('opacity: 0.45'));
});

test('the instrument tabs turn medium blue on hover, the chosen one too, but not when disabled', () => {
  const rule = /\.toolbar \.instrument-tab:not\(:disabled\):hover\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(rule, 'hover rule for the instrument tabs');
  assert.ok(rule[1].includes('var(--hover-fill)'));
});

test('a disabled header switch is not highlighted under the mouse', () => {
  assert.ok(!/\.toolbar \.inversions-toggle:disabled:hover/.test(CSS));
  assert.ok(/button\[type="button"\]:not\(:disabled,/.test(CSS));
});

test('a disabled button has no background and grey text, a button under the mouse a medium blue one', () => {
  assert.ok(/--hover-fill:\s*color-mix\(in srgb, var\(--icon-blue\) \d+%, var\(--surface\)\)/.test(CSS));
  const disabled = declarationsOf('.toolbar .inversions-toggle:disabled,\n.toolbar .instrument-tab:disabled');
  assert.ok(disabled.includes('background: none'));
  assert.ok(disabled.includes('color: var(--disabled-text)'));
});

test('the grey text of a disabled button is defined in both themes, and differs from the text colour of the dark theme', () => {
  const light = themeBlock(':root');
  const dark = themeBlock(':root\\[data-theme="dark"\\]');
  for (const block of [light, dark]) {
    assert.match(block, /--disabled-text:\s*#[0-9a-fA-F]{6}/);
  }
  const darkMuted = /--muted:\s*(#\w+)/.exec(dark)[1];
  const darkDisabled = /--disabled-text:\s*(#\w+)/.exec(dark)[1];
  assert.notEqual(darkDisabled, darkMuted);
});

test('a button under the mouse turns medium blue, but only for real pointers, active buttons included', () => {
  const hover = /@media \(hover: hover\)\s*\{[\s\S]*?button\[type="button"\]:not\(([^)]*)\):hover\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(hover, 'button hover rule inside a (hover: hover) media query');
  // Disabled buttons and the section headings are excluded here; active buttons are not, so they turn medium blue too.
  assert.ok(hover[1].includes(':disabled'));
  assert.ok(hover[1].includes('.section-toggle'));
  assert.ok(!hover[1].includes('.is-on'));
  assert.ok(hover[2].includes('var(--hover-fill)'));
});

test('the section headings (Keys, Progressions, ...) are not highlighted on hover, disabled or not', () => {
  assert.ok(!/\.option \.section-toggle:disabled:hover/.test(CSS));
  assert.ok(!/\.section-toggle:hover\s*\{/.test(CSS));
  // A disabled heading has no background and grey text.
  assert.ok(declarationsOf('.option .section-toggle:disabled').includes('background: none'));
  assert.ok(declarationsOf('.option .section-toggle:disabled').includes('color: var(--disabled-text)'));
});

test('a chord under the mouse is framed like the chord whose notes are open, only for real pointers', () => {
  const hover = /@media \(hover: hover\)\s*\{[\s\S]*?\.chord\[data-action="show-notes"\]:hover\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(hover, 'chord hover rule inside a (hover: hover) media query');
  assert.ok(hover[1].includes('outline: 2px solid var(--icon-blue)'));
  assert.ok(hover[1].includes('outline-offset: 3px'));
});

test('hovering a chord does not change the instrument tabs', () => {
  assert.ok(!/body:has\(/.test(CSS));
});

test('unselected keys of the circle of fifths hide the grey ring behind them and turn medium blue under the mouse', () => {
  // The key disc is the panel colour, so the ring does not show through the key.
  assert.ok(declarationsOf('.circle .key circle').includes('fill: var(--surface)'));
  const rule = /\.circle \.key:not\(\.is-on, \.is-subdominant, \.is-dominant\):hover circle \{([^}]*)\}/.exec(CSS);
  assert.ok(rule, 'hover rule for unselected keys');
  assert.ok(rule[1].includes('var(--hover-fill)'));
});
