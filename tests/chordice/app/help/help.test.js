import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHelp, HELP_URL, renderHelp, renderHelpMessage } from '../../../../chordice/app/help/help.js';

const PAGE = readFileSync(new URL('../../../../chordice/app/help/help.html', import.meta.url), 'utf8');
const INDEX = readFileSync(new URL('../../../../index.html', import.meta.url), 'utf8');
const help = () => PAGE;
const index = () => INDEX;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A help whose page loads come from `pages`, one per load: a string is the page, an Error a failed load. */
function helpWith(...pages) {
  const requested = [];
  let settled = 0;
  const panel = createHelp(async (url) => {
    requested.push(String(url));
    const page = pages.shift();
    if (page instanceof Error) {
      throw page;
    }
    return page;
  }, () => {
    settled += 1;
  });
  return { panel, requested, settled: () => settled };
}

/** Runs `body` with console.error silenced, as a failed load reports itself there. */
async function quietly(body) {
  const error = console.error;
  console.error = () => {};
  try {
    await body();
  } finally {
    console.error = error;
  }
}

test('the help page sits next to help.js', () => {
  assert.ok(HELP_URL.href.endsWith('/chordice/app/help/help.html'));
});

test('renderHelp takes the main part of the help page without the link back to the app', () => {
  const html = renderHelp(help());
  assert.ok(html.startsWith('<div class="help">'));
  assert.ok(html.includes('<h2>What Chordice does</h2>'));
  assert.ok(html.includes('<h2 id="exercises">Exercises</h2>'));
  assert.ok(!html.includes('help-footer'));
  assert.ok(!html.includes('Back to Chordice'));
  assert.ok(!html.includes('<main'));
  assert.ok(!html.includes('index.html'), 'no link leaves the app');
});

test('renderHelp returns null for a page without a main part, and the help messages are escaped', () => {
  assert.equal(renderHelp('<html></html>'), null);
  assert.equal(renderHelp(undefined), null);
  assert.equal(renderHelpMessage('a < b'), '<div class="help"><p>a &lt; b</p></div>');
});

test('the ids of the help, which the side panel shows inside the app, are not used by the app itself', () => {
  const appIds = new Set([...index().matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const helpIds = [...renderHelp(help()).matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(helpIds.length > 0);
  assert.deepEqual(helpIds.filter((id) => appIds.has(id)), []);
});

test('createHelp loads the page on the first markup only, says so while it loads, and then gives the help', async () => {
  const { panel, requested, settled } = helpWith(PAGE);
  assert.deepEqual(requested, []);
  assert.equal(panel.markup(), renderHelpMessage('Loading the help …'));
  assert.equal(panel.markup(), renderHelpMessage('Loading the help …'));
  await settle();
  assert.equal(settled(), 1);
  assert.equal(panel.markup(), renderHelp(PAGE));
  // The loaded help is the same string every time, so the page can keep what it shows.
  assert.equal(panel.markup(), panel.markup());
  assert.equal(requested.length, 1);
  assert.equal(requested[0], HELP_URL.href);
});

test('after a failed load the help says so until retry lets the next markup load the page again', async () => {
  await quietly(async () => {
    const { panel, requested, settled } = helpWith(new Error('offline'), PAGE);
    panel.markup();
    await settle();
    assert.equal(settled(), 1);
    assert.equal(panel.markup(), renderHelpMessage('The help could not be loaded.'));
    assert.equal(requested.length, 1);
    panel.retry();
    assert.equal(panel.markup(), renderHelpMessage('Loading the help …'));
    await settle();
    assert.equal(panel.markup(), renderHelp(PAGE));
    assert.equal(requested.length, 2);
  });
});

test('a page without a main part counts as a failed load, and retry does nothing once the help is loaded', async () => {
  await quietly(async () => {
    const broken = helpWith('<html></html>');
    broken.panel.markup();
    await settle();
    assert.equal(broken.panel.markup(), renderHelpMessage('The help could not be loaded.'));
  });
  const { panel, requested } = helpWith(PAGE);
  panel.markup();
  await settle();
  panel.retry();
  assert.equal(panel.markup(), renderHelp(PAGE));
  assert.equal(requested.length, 1);
});
