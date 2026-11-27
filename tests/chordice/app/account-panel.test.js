import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { PRIVACY_PATH, renderAccount } from '../../../chordice/app/account-panel.js';

function dom(html) {
  return new JSDOM(`<!DOCTYPE html><body>${html}</body>`).window.document;
}

const ADA = { name: 'Ada <L>', email: 'ada@example.org' };

/** The headings of the panel, in order. */
const headings = (document) => [...document.querySelectorAll('h2')].map((heading) => heading.textContent);

test('without an account, the account panel offers only Reset Settings', () => {
  for (const account of [undefined, null]) {
    const document = dom(renderAccount(account));
    assert.deepEqual(headings(document), ['Reset Settings']);
    assert.equal(document.querySelector('[data-action="sign-in"]'), null);
    assert.ok(document.querySelector('[data-action="reset-settings"]'));
  }
});

test('with an account, the panel invites to sign in with Google, the only way to sign in, at the top under Account', () => {
  const html = renderAccount({ person: null });
  const document = dom(html);
  assert.deepEqual(headings(document), ['Account', 'Reset Settings']);
  const section = document.querySelector('section[aria-label="Account"]');
  assert.equal(section.previousElementSibling.textContent, 'Account');
  // Before signing in, the privacy policy is a click away.
  assert.equal(section.querySelector('a').getAttribute('href'), PRIVACY_PATH);
  assert.equal(section.querySelector('a').dataset.action, 'show-help-page');
  assert.equal(section.querySelector('a').dataset.page, 'privacy');
  assert.ok(existsSync(new URL(`../../../${PRIVACY_PATH}`, import.meta.url)));
  assert.match(section.textContent, /keep your songs and settings in your account/);
  const button = section.querySelector('[data-action="sign-in"]');
  assert.equal(button.textContent, 'Sign in with Google');
  assert.ok(button.querySelector('svg'));
  assert.equal(section.querySelector('[data-action="sign-out"]'), null);
  assert.equal(section.querySelector('form'), null, 'no email and password');
  assert.equal(section.querySelector('input'), null);
  // The button comes first, above the note of what signing in is for.
  assert.equal(section.firstElementChild, button);
  assert.ok(button.nextElementSibling.classList.contains('account-hint'));
});

test('signed in, the panel names the person, escaped, with Sign out and Delete account', () => {
  const document = dom(renderAccount({ person: ADA }));
  const section = document.querySelector('section[aria-label="Account"]');
  assert.equal(section.querySelector('.account-text').textContent, 'Signed in as Ada <L> (ada@example.org).');
  assert.doesNotMatch(section.textContent, /kept in your account/);
  assert.equal(section.querySelector('strong').textContent, 'Ada <L>');
  assert.ok(section.querySelector('[data-action="sign-out"]'));
  assert.ok(section.querySelector('[data-action="delete-account"]'));
  assert.equal(section.querySelector('[data-action="sign-in"]'), null);
  // Under the buttons, a short note in the small, pale type of the note under Sign in with Google.
  const hint = section.querySelector('.account-hint');
  assert.equal(hint.previousElementSibling.className, 'account-buttons');
  assert.equal(hint.textContent, 'Signing out keeps your songs and settings in your account.');
});

test('a person without a name or an email address is named by what there is', () => {
  const text = (person) => dom(renderAccount({ person })).querySelector('.account-text').textContent;
  assert.match(text({ name: '', email: 'ada@example.org' }), /Signed in as ada@example\.org\./);
  assert.match(text({ name: 'Ada', email: '' }), /Signed in as Ada\./);
  assert.match(text({ name: '', email: '' }), /Signed in as your Google account\./);
});

test('deleting the account asks first, in the account section, with Delete account and Keep it', () => {
  const document = dom(renderAccount({ person: ADA }, { deletingAccount: true }));
  const section = document.querySelector('section.account.is-deleting');
  assert.match(section.textContent, /Delete your account with every song and setting saved in it\? This cannot be undone\./);
  // The question stands under the buttons, in the type of every other note of the panel.
  assert.equal(section.firstElementChild.className, 'account-buttons');
  assert.equal(section.lastElementChild.className, 'account-text account-hint');
  assert.match(section.lastElementChild.textContent, /^Delete your account/);
  assert.ok(section.querySelector('[data-action="confirm-delete-account"]'));
  assert.ok(section.querySelector('[data-action="cancel-delete-account"]'));
  assert.equal(section.querySelector('[data-action="sign-out"]'), null);
  // Signed out, there is no account to delete.
  const signedOut = dom(renderAccount({ person: null }, { deletingAccount: true }));
  assert.equal(signedOut.querySelector('.is-deleting'), null);
});

test('a message of the account shows in its section, escaped, signed in or out', () => {
  const out = dom(renderAccount({ person: null, notice: 'No <connection>' }));
  assert.equal(out.querySelector('.account-notice').textContent, 'No <connection>');
  assert.equal(out.querySelector('.account-notice').getAttribute('role'), 'status');
  const signedIn = dom(renderAccount({ person: ADA, notice: 'No connection' }));
  assert.equal(signedIn.querySelector('.account-notice').textContent, 'No connection');
});

test('Reset Settings is the last section of the panel, with a button that asks first', () => {
  for (const account of [null, { person: null }, { person: ADA }]) {
    const document = dom(renderAccount(account));
    const section = document.querySelector('section[aria-label="Reset Settings"]');
    assert.equal(document.body.lastElementChild, section);
    assert.equal(section.previousElementSibling.textContent, 'Reset Settings');
    assert.equal(section.querySelector('[data-action="reset-settings"]').textContent, 'Reset settings');
    // The button comes first; under it a short note, in the type of the note under Sign in with Google.
    assert.equal(section.firstElementChild.className, 'account-buttons');
    assert.equal(section.lastElementChild.className, 'account-text account-hint');
    assert.equal(section.lastElementChild.textContent, 'Back to the defaults of the first visit. Saved songs stay.');
    assert.equal(section.querySelector('[data-action="confirm-reset-settings"]'), null, 'the button alone resets nothing');
  }
});

test('while it asks whether to reset the settings, the section has Reset and Keep them, and the account stays', () => {
  const document = dom(renderAccount({ person: ADA }, { resettingSettings: true }));
  const section = document.querySelector('section.account.is-resetting');
  assert.equal(section.getAttribute('aria-label'), 'Reset Settings');
  assert.match(section.textContent, /Set every setting back to its default, as on your first visit\? Your saved songs stay\./);
  // The question stands under the buttons, in the type of the note under Reset settings.
  assert.equal(section.firstElementChild.className, 'account-buttons');
  assert.equal(section.lastElementChild.className, 'account-text account-hint');
  assert.match(section.lastElementChild.textContent, /^Set every setting back/);
  assert.equal(section.querySelector('[data-action="confirm-reset-settings"]').textContent, 'Reset');
  assert.equal(section.querySelector('[data-action="cancel-reset-settings"]').textContent, 'Keep them');
  assert.equal(section.querySelector('[data-action="reset-settings"]'), null);
  assert.ok(document.querySelector('[data-action="sign-out"]'));
});
