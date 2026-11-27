import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import {
  APP_STYLESHEETS,
  HELP_STYLESHEETS,
  allCss,
  declarationsOf as declarationsIn,
  declaredProperties,
  literalClassNames,
  readCss,
  sourceFiles,
  themeBlock as themeBlockIn,
} from '../../helpers/stylesheets.js';

// These tests check the structure of main.css (variables, classes, rules), not its concrete values, so that design changes
// do not need test changes. Tests that span several stylesheets read all of them, in the order the pages link them (ALL).

const CSS = readCss('main.css');
const ALL = allCss();
const declarationsOf = (selector) => declarationsIn(CSS, selector);
const themeBlock = (selector) => themeBlockIn(CSS, selector);
// The tone colours sit in a rule of their own, shared by :root and the staff of the notes window.
const TONE_BLOCK = ':root,\\s*\\.notes-staff';
/** The variables of the light theme: those of :root and the tone colours. */
const lightProperties = () => [...declaredProperties(themeBlock(':root')), ...declaredProperties(themeBlock(TONE_BLOCK))];

test('every stylesheet has balanced braces', () => {
  for (const url of [...APP_STYLESHEETS, ...HELP_STYLESHEETS]) {
    const css = readFileSync(url, 'utf8');
    const opening = css.split('{').length - 1;
    assert.equal(opening, css.split('}').length - 1, url.pathname);
    assert.ok(opening > 0, url.pathname);
  }
});

test('every var() used in the stylesheets is defined in :root of main.css', () => {
  const defined = new Set(lightProperties());
  const used = [...ALL.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]);
  assert.ok(used.length > 0);
  for (const name of used) {
    assert.ok(defined.has(name), name);
  }
});

test('every custom property is defined in main.css and used by a var() in one of the stylesheets', () => {
  const elsewhere = [...ALL.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]).filter((name) => !CSS.includes(`${name}:`));
  assert.deepEqual(elsewhere, []);
  const defined = new Set([...CSS.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
  const used = new Set([...ALL.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]));
  assert.ok(defined.size > 0);
  const unused = [...defined].filter((name) => !used.has(name));
  assert.deepEqual(unused, []);
});

test('the dark theme redefines every colour variable of the light theme', () => {
  const light = lightProperties().filter((name) => !['--touch', '--faded'].includes(name)).sort();
  const dark = declaredProperties(themeBlock(':root\\[data-theme="dark"\\]')).sort();
  assert.ok(light.length > 0);
  assert.deepEqual(dark, light);
});

test('every class used in the markup and scripts has a style rule', () => {
  const classes = literalClassNames();
  assert.ok(classes.includes('chip'));
  // Plain wrappers that need no styling of their own.
  const UNSTYLED_WRAPPERS = ['song-rows'];
  const unstyled = classes.filter((name) => !ALL.includes(`.${name}`) && !UNSTYLED_WRAPPERS.includes(name));
  assert.deepEqual(unstyled, []);
});

test('every class in the stylesheets is used by the markup or scripts', () => {
  const sources = sourceFiles().join('\n');
  // Classes built at runtime, e.g. fn-${function} or is-${role}, are found by their parts: fn-tonic by "tonic".
  const isUsed = (name) => sources.includes(name) || name.split('-').every((part) => new RegExp(`\\b${part}\\b`).test(sources));
  const selectorClasses = new Set([...ALL.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]));
  const unused = [...selectorClasses].filter((name) => !isUsed(name));
  assert.deepEqual(unused, []);
});

test('touch targets use the shared minimum size', () => {
  assert.ok(CSS.includes('min-height: var(--touch)'));
  assert.ok(CSS.includes('--touch:'));
});

test('the toolbar, the floating New Song button and the body keep clear of the iPhone safe areas', () => {
  assert.ok(/\.toolbar\s*\{[^}]*env\(safe-area-inset-top\)/.test(ALL));
  assert.ok(/body\s*\{[^}]*env\(safe-area-inset-left\)/.test(CSS));
  assert.ok(/\.generate\s*\{[^}]*env\(safe-area-inset-bottom\)/.test(CSS));
});

test('the side panel and the song reach down to the bottom edge; only their content keeps clear of the home indicator', () => {
  assert.ok(!/(^|\n)body\s*\{[^}]*safe-area-inset-bottom/.test(CSS), 'the body leaves no gap at the bottom');
  assert.match(declarationsOf('.side-panel'), /padding: [^;]*calc\(1rem \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(declarationsOf('.song'), /padding: [^;]*calc\(5rem \+ env\(safe-area-inset-bottom\)\)/);
});

test('a pinch on the options and on the chords zooms that area, not the page', () => {
  assert.ok(/\.side-panel\s*\{[^}]*touch-action: pan-x pan-y/.test(CSS));
  assert.ok(/\.song\s*\{[^}]*touch-action: pan-x pan-y/.test(CSS));
});

test('narrow windows keep the side panel on the left, at full width, and hide the song while it is open', () => {
  const media = /@media \(max-width: \d+px\) \{([\s\S]*)\}\s*$/.exec(CSS)?.[1] ?? '';
  assert.ok(media.includes('.layout'), 'media query styles the layout');
  assert.ok(/grid-template-columns: minmax\(0, 1fr\)/.test(media));
  assert.ok(!media.includes('grid-template-rows'), 'the options are not stacked above the chords');
  assert.ok(/\.layout:has\(> \.side-panel:not\(\[hidden\]\)\) > \.song\s*\{[^}]*display: none/.test(media));
});

test('in the narrow layout the song shows again once the side panel is closed', () => {
  const width = Number(/@media \(max-width: (\d+)px\)/.exec(CSS)[1]);
  const dom = new JSDOM(`<!DOCTYPE html><html><head><style>${CSS}</style></head><body><main class="layout">` +
    '<aside class="side-panel" id="panel"></aside><section class="song" id="song"></section></main></body></html>');
  assert.ok(width > 0);
  const { document } = dom.window;
  // jsdom does not evaluate media queries, so the rule inside is checked by its selector, in the order the page has it.
  const rule = [...document.styleSheets[0].cssRules].find((r) => r.media?.mediaText.includes('max-width'));
  const hide = [...rule.cssRules].find((r) => r.selectorText?.includes('.song'));
  const song = document.getElementById('song');
  assert.equal(song.matches(hide.selectorText), true);
  document.getElementById('panel').hidden = true;
  assert.equal(song.matches(hide.selectorText), false);
});

test('the side panel has a maximum width and never takes more than half of the layout', () => {
  const columns = /grid-template-columns:\s*([^;]+);/.exec(declarationsOf('.layout'))?.[1] ?? '';
  assert.match(columns, /^min\(\d+px, 50%\) minmax\(0, 1fr\)$/);
});

test('hiding the options hides the whole side panel', () => {
  assert.ok(/\.side-panel\[hidden\]\s*\{[^}]*display: none/.test(CSS));
});

test('the options panel and the chords scroll on their own', () => {
  assert.ok(/\.side-panel\s*\{[^}]*overflow-y: auto/.test(CSS));
  assert.ok(/\.song\s*\{[^}]*overflow-y: auto/.test(CSS));
});

test('the chord block is centred vertically in the song area and horizontally in its room beside the circle', () => {
  assert.ok(/\.song\s*\{[^}]*display: flex/.test(CSS));
  assert.ok(/\.song\s*\{[^}]*flex-direction: column/.test(CSS));
  assert.ok(/\.song-body\s*\{[^}]*margin: auto 0/.test(CSS));
  assert.ok(/\.song-rows\s*\{[^}]*margin: 0 auto/.test(CSS));
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

// The staff of the notes window is white paper in both themes, so its notes keep the light tone colours; staff.js reads
// them from the stylesheet. They are written once, in the rule that :root and the staff share.
test('the tone colours are defined once, for :root and the staff, which keeps them in the dark theme', () => {
  assert.deepEqual(declaredProperties(themeBlock(TONE_BLOCK)).sort(), ['--foreign-tone', '--variation-tone']);
  const dom = new JSDOM(`<!DOCTYPE html><html data-theme="dark"><head><style>${CSS}</style></head>` +
    '<body><div class="notes-staff" id="staff"></div><span id="page"></span></body></html>');
  const { document, getComputedStyle } = dom.window;
  const colour = (id, property) => getComputedStyle(document.getElementById(id)).getPropertyValue(property).trim();
  const light = Object.fromEntries(['--foreign-tone', '--variation-tone']
    .map((property) => [property, new RegExp(`${property}:\\s*(#[0-9a-fA-F]{6})`).exec(themeBlock(TONE_BLOCK))[1]]));
  for (const [property, value] of Object.entries(light)) {
    assert.equal(colour('staff', property), value, `the staff keeps the light ${property}`);
    assert.notEqual(colour('page', property), value, `the page takes the dark ${property}`);
  }
});

test('the cards and the floating elements cast the soft shadows of the theme', () => {
  for (const block of [themeBlock(':root'), themeBlock(':root\\[data-theme="dark"\\]')]) {
    assert.match(block, /--shadow:/);
    assert.match(block, /--shadow-raised:/);
  }
  assert.ok(declarationsOf('.generate').includes('box-shadow: var(--shadow-raised)'));
  assert.ok(declarationsIn(ALL, '.option').includes('box-shadow: var(--shadow)'));
  assert.ok(declarationsIn(ALL, '.notes').includes('box-shadow: var(--shadow-raised)'));
});

test('the New Song button is a pill', () => {
  assert.ok(declarationsOf('.generate').includes('border-radius: 999px'));
});

test('buttons show a focus ring for the keyboard and give way when pressed', () => {
  assert.ok(declarationsOf('button:focus-visible').includes('outline:'));
  assert.ok(declarationsOf('button:not(:disabled):active').includes('transform:'));
});

test('the side panel and the header are translucent paper over the landscape', () => {
  for (const block of [declarationsOf('.side-panel'), declarationsIn(ALL, '.toolbar')]) {
    assert.ok(block.includes('background: var(--panel)'));
    assert.ok(block.includes('backdrop-filter:'));
  }
});

/** The relative luminance of a colour written as #rrggbb. */
function luminanceOf(hex) {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test('in both themes a minor chord is darker than the major chord of its harmonic function', () => {
  for (const block of [themeBlock(':root'), themeBlock(':root\\[data-theme="dark"\\]')]) {
    for (const fn of ['tonic', 'subdominant', 'dominant']) {
      const colour = (mode) => new RegExp(`--${fn}-${mode}:\\s*(#[0-9a-fA-F]{6})`).exec(block)[1];
      assert.ok(luminanceOf(colour('minor')) < luminanceOf(colour('major')), `${fn}: ${colour('minor')} vs ${colour('major')}`);
    }
  }
});

test('the chords and every button share one watercolour wash, defined once: a bloom and a rim of pigment', () => {
  // :where() gives the shared rules no weight, so a rule of one element (e.g. New Song's position: fixed) wins over them.
  const host = declarationsOf(':where(.chord, button:not(.section-toggle))');
  assert.ok(host.includes('position: relative'));
  assert.ok(host.includes('isolation: isolate'), 'the wash stays behind the label');
  const wash = declarationsOf(':where(.chord, button:not(.section-toggle))::before');
  assert.ok(wash.includes('var(--bloom)'));
  assert.match(wash, /box-shadow: inset [^;]*var\(--pigment-edge\)/);
  assert.ok(wash.includes('z-index: -1'));
  assert.ok(wash.includes('border-radius: inherit'), 'the wash follows the shape of its element');
  assert.ok(wash.includes('pointer-events: none'));
  // No stylesheet paints a bloom or a rim of its own: the look is defined in this one place.
  const elsewhere = ALL.replace(wash, '').match(/radial-gradient\([^)]*var\(--bloom\)|inset[^;]*var\(--pigment-edge\)/g) ?? [];
  assert.deepEqual(elsewhere, []);
  // A greyed-out button is not painted.
  assert.ok(declarationsOf('button:disabled::before').includes('content: none'));
});

test('the pigment of every wash settles in soft clouds: a tile of noise in both themes, laid over the chords and all buttons', () => {
  for (const block of [themeBlock(':root'), themeBlock(':root\\[data-theme="dark"\\]')]) {
    for (const name of ['--mottle', '--mottle-ink']) {
      const tile = new RegExp(`${name}:\\s*url\\("data:image\\/svg\\+xml,([^"]*)"\\)`).exec(block);
      assert.ok(tile, `${name} in each theme`);
      const svg = decodeURIComponent(tile[1]);
      assert.ok(svg.includes('feTurbulence'), 'drawn as noise by the browser');
      assert.ok(svg.includes("stitchTiles='stitch'"), 'repeated without seams');
      assert.equal(svg.split('<feTurbulence').length - 1, 1, 'only soft clouds, no fine grain');
      assert.match(svg, /baseFrequency='0(\.|%2E)0\d+'/, 'a low frequency: clouds, not specks');
      // Filters work in linear RGB by default, which would lighten the colour of the clouds until they vanish on blue.
      assert.equal(svg.split('<filter').length - 1, svg.split("color-interpolation-filters='sRGB'").length - 1, 'colours as written');
    }
  }
  const wash = declarationsOf(':where(.chord, button:not(.section-toggle))::before');
  assert.ok(wash.includes('var(--clouds)'));
  for (const block of [themeBlock(':root'), themeBlock(':root\\[data-theme="dark"\\]')]) {
    assert.match(block, /--clouds: var\(--mottle\);/, 'the buttons carry the clouds of the theme');
  }
  const filled = declarationsOf('.generate::before,\n.chip.is-on::before,\n.chip.count-toggle::before,\n' +
    '.toolbar button[aria-pressed="true"]::before,\n.toolbar button[aria-expanded="true"]::before,\n' +
    '.toolbar button[data-exercise-active="true"]::before');
  assert.ok(filled.includes('var(--mottle-ink)'), 'the filled buttons have darker clouds, which show on the blue');
});

test('the chords are clear washes: bloom and rim, but no clouds', () => {
  assert.ok(declarationsOf('.chord').includes('--clouds: none'));
});

test('the watercolour is soft: a faint rim, a faint bloom and faint clouds in both themes', () => {
  const alpha = (block, name) => Number(new RegExp(`${name}:\\s*rgba\\([^)]*,\\s*([\\d.]+)\\)`).exec(block)[1]);
  const clouds = (block, name) => Number(/0%2E(\d+) 0 0 0 -0%2E\d+'/.exec(new RegExp(`${name}:[^;]*`).exec(block)[0])[1].padEnd(3, '0')) / 1000;
  const light = themeBlock(':root');
  const dark = themeBlock(':root\\[data-theme="dark"\\]');
  assert.ok(alpha(light, '--pigment-edge') <= 0.12 && alpha(dark, '--pigment-edge') <= 0.2);
  assert.ok(alpha(light, '--bloom') <= 0.3 && alpha(dark, '--bloom') <= 0.06);
  for (const block of [light, dark]) {
    assert.ok(clouds(block, '--mottle') <= 0.15, 'the clouds of the buttons');
    assert.ok(clouds(block, '--mottle-ink') <= 0.3, 'the clouds of the filled buttons');
    assert.ok(alpha(block, '--mottle-tint') <= 0.15, 'the clouds of the circle');
  }
});

test('the rim of a wash is uneven: the pigment gathers more at the bottom, where the water ran to', () => {
  const wash = declarationsOf(':where(.chord, button:not(.section-toggle))::before');
  const shadow = /box-shadow:([^;]*)/.exec(wash)[1];
  const rims = shadow.split(/,(?![^(]*\))/).map((part) => part.trim());
  assert.ok(rims.length >= 2 && rims.every((rim) => rim.startsWith('inset') && rim.includes('var(--pigment-edge)')));
  assert.ok(rims.some((rim) => /^inset -?[\d.]+em -[\d.]+em/.test(rim)), 'one rim is moved up, so it lies thicker at the bottom');
});

test('the bloom on the deep blue of the filled buttons is fainter than on the others', () => {
  const filled = declarationsOf('.generate::before,\n.chip.is-on::before,\n.chip.count-toggle::before,\n' +
    '.toolbar button[aria-pressed="true"]::before,\n.toolbar button[aria-expanded="true"]::before,\n' +
    '.toolbar button[data-exercise-active="true"]::before');
  assert.ok(filled.includes('var(--bloom-ink)'));
  for (const block of [themeBlock(':root'), themeBlock(':root\\[data-theme="dark"\\]')]) {
    const alpha = (name) => Number(new RegExp(`${name}:\\s*rgba\\([^)]*,\\s*([\\d.]+)\\)`).exec(block)[1]);
    assert.ok(alpha('--bloom-ink') < alpha('--bloom'));
  }
});

test('the labels of the buttons are set in the book face, with uneven corners like the chords', () => {
  const button = declarationsOf('button');
  assert.ok(button.includes('font-family: var(--serif)'));
  assert.match(button, /border-radius:[^;]*\//, 'uneven corners');
  assert.ok(declarationsIn(ALL, '.option .section-toggle').includes('box-shadow: none'), 'the headings are not painted');
});

test('the panels are translucent enough to show the painting behind them', () => {
  for (const block of [themeBlock(':root'), themeBlock(':root\\[data-theme="dark"\\]')]) {
    const alpha = Number(/--panel:\s*rgba\([^)]*,\s*([\d.]+)\)/.exec(block)[1]);
    assert.ok(alpha > 0.3 && alpha <= 0.6, `panel opacity ${alpha}`);
  }
});

test('New Song floats fixed in its corner, as a pill, whatever the shared wash gives every button', () => {
  assert.ok(declarationsOf('.generate').includes('position: fixed'));
  // The only rule that sets the position of every button carries no weight.
  const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const positioned = [...rules.matchAll(/(^|\n)([^{}\n][^{}]*)\{[^}]*position: relative/g)].map((match) => match[2].trim());
  for (const selector of positioned.filter((rule) => rule.includes('button'))) {
    assert.ok(selector.startsWith(':where('), selector);
  }
});

test('the body is as high as the visible window, also while the bars of Safari slide in and out', () => {
  assert.ok(declarationsOf('body').includes('height: 100dvh'));
  // A browser without dvh keeps the height of the window from the shared rule of html and body.
  assert.ok(/html,\s*body\s*\{[^}]*height: 100%/.test(CSS));
});

test('the size of the circle of fifths has a default in both themes, the same as the zoom of the chords', () => {
  for (const block of [themeBlock(':root'), themeBlock(':root\\[data-theme="dark"\\]')]) {
    assert.match(block, /--circle-zoom: 1\.2;/);
    assert.match(block, /--zoom: 1\.2;/);
  }
});

test('the song area is the container of the circle beside the chords, and the chords take the room beside it', () => {
  assert.ok(declarationsOf('.song').includes('container-type: inline-size'));
  const body = declarationsOf('.song-body');
  assert.ok(body.includes('display: flex'));
  assert.ok(body.includes('margin: auto 0'), 'centred vertically, scrolling without cutting off the top');
  assert.ok(body.includes('gap: calc(var(--circle-zoom) * '), 'the gap to the circle takes the size of the circle');
  // The parts stretch to the height of the rows, so the sticky circle can stay in view while they scroll.
  assert.ok(!/align-items/.test(body));
  assert.ok(declarationsOf('.song-chords').includes('min-width: 0'));
});

test('the circle and the chords share the free room one to two, each in the middle of its part, the rows on one left edge', () => {
  // As wide as their content, plus their share of the free room: a third for the circle, two thirds for the chords.
  const circlePart = declarationsOf('.song-circle-part');
  const chords = declarationsOf('.song-chords');
  assert.ok(circlePart.includes('flex: 1 0 auto'), 'the circle part never gets narrower than the circle');
  assert.ok(chords.includes('flex: 2 1 auto'), 'the chords give way where there is no room');
  assert.ok(circlePart.includes('display: flex'));
  assert.ok(circlePart.includes('justify-content: center'));
  // The rows are not centred one by one: the block is centred, its rows start at its left edge.
  const rows = declarationsOf('.song-rows');
  assert.ok(rows.includes('margin: 0 auto'));
  assert.ok(!rows.includes('text-align: center'));
  assert.ok(!declarationsOf('.row').includes('margin: 0 auto'));
  assert.ok(!/justify-content: center/.test(declarationsOf('.row h2')));
});
