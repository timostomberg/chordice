/**
 * Entry point of the page: starts the app. Kept apart from app.js, which exports startApp, so that the app module has no
 * side effects on import and its tests can start it on a fake page.
 */

import { startApp } from './core/app.js';

startApp();
