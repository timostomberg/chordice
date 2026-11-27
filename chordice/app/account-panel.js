/**
 * The account panel of the side panel (the person button in the header). Where the page has an account, it offers at the
 * top to sign in with Google, so that the songs and the settings are kept in the account, and to sign out or delete the
 * account. At the bottom, under Reset Settings, a button sets every setting back to its default, as on the first visit;
 * the saved songs stay. Deleting the account and resetting the settings each ask first, in their card, without a dialog of
 * the browser, which some browsers block. Every function returns a string of HTML.
 */

import { escapeHtml } from './escape.js';

// The G of the Sign in with Google button, in the colours of Google's own button.
const GOOGLE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4"/>' +
  '<path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853"/>' +
  '<path d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9z" fill="#FBBC05"/>' +
  '<path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z" fill="#EA4335"/></svg>';

/**
 * The privacy policy, from the page (index.html), which the account section links to. A click shows it in the side panel
 * (see help/help.js); the address is there for opening it on its own, e.g. in a new tab.
 */
export const PRIVACY_PATH = 'chordice/app/help/privacy.html';

/** Who is signed in, as the account section names them: their name and email address, or what there is of them. */
function personLabel(person) {
  const name = escapeHtml(person.name);
  const email = escapeHtml(person.email);
  if (name && email) {
    return `<strong>${name}</strong> (${email})`;
  }
  return name || email ? `<strong>${name || email}</strong>` : 'your Google account';
}

/** A message of the account section (e.g. why the account could not be deleted), or nothing. */
function accountNotice(account) {
  return account.notice ? `<p class="account-notice" role="status">${escapeHtml(account.notice)}</p>` : '';
}

/** The invitation to sign in with Google: the button, and under it a quiet note of what it is for. */
function signInSection(account) {
  return '<section class="account" aria-label="Account">' +
    '<button type="button" class="chip account-sign-in" data-action="sign-in">' +
    `${GOOGLE_ICON}<span>Sign in with Google</span></button>` +
    '<p class="account-text account-hint">Sign in to keep your songs and settings in your account and find them on every ' +
    `device. See the <a href="${PRIVACY_PATH}" data-action="show-help-page" data-page="privacy">privacy policy</a> for ` +
    'what this means for your data.</p>' +
    accountNotice(account) + '</section>';
}

/**
 * The card of the account section: an invitation to sign in, or who is signed in, or the question before deleting. Like
 * every note of the panel, the question stands under the buttons, in the small, pale type of the notes.
 */
function accountCard(account, deletingAccount) {
  if (!account.person) {
    return signInSection(account);
  }
  if (deletingAccount) {
    return '<section class="account is-deleting" aria-label="Account">' +
      '<div class="account-buttons">' +
      '<button type="button" class="chip is-on" data-action="confirm-delete-account">Delete account</button>' +
      '<button type="button" class="chip" data-action="cancel-delete-account">Keep it</button></div>' +
      '<p class="account-text account-hint">Delete your account with every song and setting saved in it? This cannot be ' +
      'undone.</p></section>';
  }
  return '<section class="account" aria-label="Account">' +
    `<p class="account-text">Signed in as ${personLabel(account.person)}.</p>` +
    '<div class="account-buttons">' +
    '<button type="button" class="chip" data-action="sign-out">Sign out</button>' +
    '<button type="button" class="chip" data-action="delete-account">Delete account</button></div>' +
    '<p class="account-text account-hint">Signing out keeps your songs and settings in your account.</p>' +
    accountNotice(account) + '</section>';
}

/**
 * The account section at the top of the panel, under the heading Account (see accountCard). Empty where the page has no
 * account.
 */
function accountSection(account, deletingAccount) {
  if (!account) {
    return '';
  }
  return '<h2 class="options-heading">Account</h2>' + accountCard(account, deletingAccount);
}

/**
 * The section at the bottom of the panel, under the heading Reset Settings: a button that asks whether to reset the
 * settings, with a short note under it, and while it asks, Reset, which resets them, and Keep them, with the question
 * under them in the same type as that note.
 */
function resetSection(resetting) {
  const heading = '<h2 class="options-heading">Reset Settings</h2>';
  if (resetting) {
    return heading + '<section class="account is-resetting" aria-label="Reset Settings">' +
      '<div class="account-buttons">' +
      '<button type="button" class="chip is-on" data-action="confirm-reset-settings">Reset</button>' +
      '<button type="button" class="chip" data-action="cancel-reset-settings">Keep them</button></div>' +
      '<p class="account-text account-hint">Set every setting back to its default, as on your first visit? Your saved ' +
      'songs stay.</p></section>';
  }
  return heading + '<section class="account" aria-label="Reset Settings">' +
    '<div class="account-buttons">' +
    '<button type="button" class="chip" data-action="reset-settings">Reset settings</button></div>' +
    '<p class="account-text account-hint">Back to the defaults of the first visit. Saved songs stay.</p></section>';
}

/**
 * Renders the account panel. `account` is null where the page has no account, else the person who is signed in (null if
 * no one) and a `notice` of the account section (e.g. why the account could not be deleted). `editing` tells whether the
 * panel asks whether to delete the account (`deletingAccount`) or whether to reset the settings (`resettingSettings`).
 */
export function renderAccount(account = null, editing = {}) {
  return accountSection(account, editing.deletingAccount === true) + resetSection(editing.resettingSettings === true);
}
