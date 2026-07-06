/**
 * Regression tests for the L2 fix (port of mixpanel-js 2.55.1).
 *
 * Before the fix: any XHR status 0 fell through to the dequeue branch and the
 * batch was deleted with no retry (see tests/unit/leak-pocs.js LEAK-2).
 *
 * After the fix (src/request-batcher.js):
 *   - status 0 while OFFLINE  → retried (kept in queue), delivered when back online.
 *   - status 0 while ONLINE   → still dropped (ad blocker / lost response; a safe
 *                               retry there would need server-side dedupe — L10).
 *
 * navigator.onLine is simulated via global.navigator in the node test env.
 */
import chai, { expect } from 'chai';
import localStorage from 'localStorage';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);

import { RequestBatcher } from '../../src/request-batcher';

const LOCALSTORAGE_KEY = `l2-fix-rb-key`;
const START_TIME = 100000;
const DEFAULT_FLUSH_INTERVAL = 5000;
const REQUEST_TIMEOUT_MS = 90000;

describe(`L2 fix — offline status-0 retries instead of dropping`, function() {
  let batcher;
  let libConfig;
  let clock = null;
  let priorNavDesc;

  function makeBatcher() {
    return new RequestBatcher(LOCALSTORAGE_KEY, {
      libConfig,
      sendRequestFunc: sinon.spy(),
      storage: localStorage,
    });
  }
  function getLocalStorageItems() {
    return JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY));
  }
  function sendResponse(status, {error, responseHeaders} = {}) {
    const i = batcher.sendRequest.args.length - 1;
    batcher.sendRequest.args[i][2]({'xhr_req': {status, responseHeaders}, error});
  }
  function setOnline(isOnline) {
    Object.defineProperty(globalThis, 'navigator', {value: {onLine: isOnline}, configurable: true, writable: true});
  }

  beforeEach(function() {
    if (clock) { clock.restore(); }
    clock = sinon.useFakeTimers(START_TIME);
    localStorage.clear();
    priorNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    libConfig = {
      batch_flush_interval_ms: DEFAULT_FLUSH_INTERVAL,
      batch_request_timeout_ms: REQUEST_TIMEOUT_MS,
      batch_size: 50,
      batch_autostart: true,
    };
    batcher = makeBatcher();
  });

  afterEach(function() {
    if (clock) { clock.restore(); }
    clock = null;
    if (priorNavDesc) { Object.defineProperty(globalThis, 'navigator', priorNavDesc); } // restore
    else { try { delete globalThis.navigator; } catch (e) { /* ignore */ } }
  });

  it(`OFFLINE: keeps the batch on status 0, retries, and delivers when back online`, function() {
    setOnline(false);
    batcher.enqueue({ev: `payment_initiated`});
    batcher.enqueue({ev: `order_placed`});
    batcher.flush();
    expect(batcher.sendRequest).to.have.been.calledOnce;

    sendResponse(0); // network unreachable while offline

    // FIX: items are NOT removed — they wait for retry
    expect(batcher.queue.memQueue).to.have.lengthOf(2);
    expect(getLocalStorageItems()).to.have.lengthOf(2);

    // a retry is scheduled (flushInterval * 2); fire it
    clock.tick(DEFAULT_FLUSH_INTERVAL * 2);
    expect(batcher.sendRequest).to.have.been.calledTwice;
    expect(batcher.sendRequest.args[1][0]).to.deep.equal(batcher.sendRequest.args[0][0]);

    // back online — the retry succeeds, items finally leave the queue
    sendResponse(200);
    expect(batcher.queue.memQueue).to.be.empty;
    expect(getLocalStorageItems()).to.be.empty;
  });

  it(`ONLINE: still drops on status 0 (ad blocker / lost response — unchanged, no new duplicates)`, function() {
    setOnline(true);
    batcher.enqueue({ev: `queued event 1`});
    batcher.enqueue({ev: `queued event 2`});
    batcher.flush();
    expect(getLocalStorageItems()).to.have.lengthOf(2);

    sendResponse(0); // status 0 but browser reports online → ambiguous → drop (as before)

    clock.tick(10 * DEFAULT_FLUSH_INTERVAL);
    expect(batcher.sendRequest).to.have.been.calledOnce; // never retried
    expect(batcher.queue.memQueue).to.be.empty;
    expect(getLocalStorageItems()).to.be.empty;
  });
});
