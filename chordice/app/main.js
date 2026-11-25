/**
 * Entry point of the page: starts the app, keeps the screen on and keeps the page for use without a network (device.js).
 * Kept apart from app.js, which exports startApp, so that the app module has no side effects on import and its tests can
 * start it on a fake page.
 */

import { startApp } from './app.js';
import { keepScreenAwake, registerServiceWorker } from './device.js';

startApp();
keepScreenAwake();
registerServiceWorker();
