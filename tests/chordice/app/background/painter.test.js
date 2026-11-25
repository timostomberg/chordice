import { test } from 'node:test';
import assert from 'node:assert/strict';

/** A canvas off the page in a test: its 2D context takes every call, and its bitmap names its size. */
class FakeOffscreenCanvas {
  constructor(width, height) {
    Object.assign(this, { width, height, painted: 0 });
  }

  getContext() {
    const canvas = this;
    const gradient = { addColorStop() {} };
    return new Proxy({}, {
      get: (_, name) => (name.startsWith('create') ? () => gradient : () => {
        canvas.painted += 1;
      }),
      set: () => true,
    });
  }

  transferToImageBitmap() {
    return { width: this.width, height: this.height, painted: this.painted };
  }
}

test('the painter paints the painting asked for and sends its bitmap back, or the error when it cannot', async () => {
  const posted = [];
  globalThis.self = { postMessage: (message, transfer) => posted.push({ message, transfer }) };
  globalThis.OffscreenCanvas = FakeOffscreenCanvas;
  try {
    await import('../../../../chordice/app/background/painter.js');
    self.onmessage({ data: { id: 7, seed: 37, theme: 'dark', width: 300, height: 200 } });
    const [{ message, transfer }] = posted;
    assert.equal(message.id, 7);
    assert.equal(message.bitmap.width, 300);
    assert.equal(message.bitmap.height, 200);
    assert.ok(message.bitmap.painted > 100, 'the painting is painted on it');
    assert.deepEqual(transfer, [message.bitmap], 'the bitmap is handed over, not copied');
    globalThis.OffscreenCanvas = class {
      getContext() {
        throw new Error('no 2D context');
      }
    };
    self.onmessage({ data: { id: 8, seed: 1, theme: 'light', width: 10, height: 10 } });
    assert.deepEqual(posted[1].message, { id: 8, error: 'no 2D context' });
  } finally {
    delete globalThis.self;
    delete globalThis.OffscreenCanvas;
  }
});
