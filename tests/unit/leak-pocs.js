/**
 * PoC tests for suspected data-loss ("leak") modes in the request batching layer.
 *
 * These tests intentionally document CURRENT behavior — every assertion that an
 * event is lost passing means the leak is REAL in this fork. They complement
 * existing proof in tests/unit/request-batcher.js:
 *   - "does not retry 400s / successful API rejections"  (4xx => permanent drop)
 *   - "does not retry ERR_BLOCKED_BY_CLIENT"             (status 0 => permanent drop)
 *   - "does not retry single item which produces 413"    (oversize => permanent drop)
 *   - "handles failures to remove items from queue and eventually stops batchers"
 *
 * Related fork code:
 *   - src/mixpanel-core.js:76-91, 267-291  (sendBeacon + flush-on-pagehide commented out)
 *   - src/request-batcher.js:155-188       (retry only on 5xx/429/timeout; everything else dequeues)
 *   - src/mixpanel-core.js:659-665         (stop_batch_senders clears the persisted queue)
 */
import chai, { expect } from 'chai';
import localStorage from 'localStorage';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);

import { RequestBatcher } from '../../src/request-batcher';

const LOCALSTORAGE_KEY = `leak-poc-rb-key`;
const START_TIME = 100000;
const DEFAULT_FLUSH_INTERVAL = 5000;
const REQUEST_TIMEOUT_MS = 90000;

describe(`Leak PoCs (current behavior = data loss)`, function() {
  let batcher;
  let libConfig;
  let clock = null;

  function makeBatcher(overrides) {
    return new RequestBatcher(LOCALSTORAGE_KEY, Object.assign({
      libConfig,
      sendRequestFunc: sinon.spy(),
      storage: localStorage,
    }, overrides || {}));
  }

  function getLocalStorageItems() {
    return JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY));
  }

  function sendResponse(status, {error, responseHeaders} = {}) {
    const requestIndex = batcher.sendRequest.args.length - 1;
    batcher.sendRequest.args[requestIndex][2]({
      'xhr_req': {status, responseHeaders},
      error,
    });
  }

  beforeEach(function() {
    if (clock) {
      clock.restore();
    }
    clock = sinon.useFakeTimers(START_TIME);
    localStorage.clear();
    libConfig = {
      batch_flush_interval_ms: DEFAULT_FLUSH_INTERVAL,
      batch_request_timeout_ms: REQUEST_TIMEOUT_MS,
      batch_size: 50,
      batch_autostart: true,
    };
    batcher = makeBatcher();
  });

  afterEach(function() {
    if (clock) {
      clock.restore();
    }
    clock = null;
  });

  describe(`LEAK-1: page unload before flush interval (tail loss)`, function() {
    it(`events enqueued after the last flush are never sent during the page's lifetime`, function() {
      batcher.start();
      // user triggers events; page is closed before the 5s flush timer fires.
      batcher.enqueue({ev: `add_to_cart`});
      batcher.enqueue({ev: `order_placed`});

      // page unloads here: fork has NO pagehide/visibilitychange flush
      // (mixpanel-core.js:267-291 commented out), so nothing more happens.
      expect(batcher.sendRequest).not.to.have.been.called;

      // events survive ONLY as localStorage entries awaiting a future pageview
      expect(getLocalStorageItems()).to.have.lengthOf(2);
    });

    it(`recovery requires a RETURN VISIT: a new pageload only sends items after flushAfter passes`, function() {
      // page 1: events enqueued, page closes before any flush (its timers die with it)
      batcher.enqueue({ev: `add_to_cart`});

      // --- simulate next pageload in same browser: a fresh batcher over the same storage key
      const secondPage = makeBatcher();
      secondPage.start(); // immediate flush on start

      // item is NOT yet orphaned (flushAfter = enqueue time + ~2x flushInterval),
      // so the immediate flush on the new page sends nothing
      expect(secondPage.sendRequest).not.to.have.been.called;

      // only once flushAfter passes does the orphan get picked up by a scheduled flush
      clock.tick(DEFAULT_FLUSH_INTERVAL * 4);
      expect(secondPage.sendRequest).to.have.been.called;
      const sentPayloads = secondPage.sendRequest.args[0][0];
      expect(sentPayloads).to.deep.equal([{ev: `add_to_cart`}]);
      // CONCLUSION: if the user never returns in the same browser/profile
      // (last session, incognito, storage eviction), these events are lost forever.
    });
  });

  describe(`LEAK-2: transient network failure treated as success`, function() {
    it(`drops the whole batch on XHR status 0 even though a retry could succeed (offline/flaky network)`, function() {
      // status 0 = offline, DNS failure, connection reset, captive portal, CORS, OR ad blocker.
      // The fork cannot distinguish these; upstream mixpanel-js later added
      // (status <= 0 && !isOnline()) => retry. This fork removes the batch unconditionally.
      batcher.enqueue({ev: `payment_initiated`});
      batcher.flush();
      expect(getLocalStorageItems()).to.have.lengthOf(1);

      sendResponse(0); // e.g. user in a network dead zone for 2 seconds

      clock.tick(10 * DEFAULT_FLUSH_INTERVAL);
      expect(batcher.sendRequest).to.have.been.calledOnce; // never retried
      expect(batcher.queue.memQueue).to.be.empty;          // gone from memory
      expect(getLocalStorageItems()).to.be.empty;          // gone from storage => permanent loss
    });

    it(`drops the whole batch on any 4xx other than 413/429 (e.g. WAF 403, proxy 401)`, function() {
      batcher.enqueue({ev: `order_placed`});
      batcher.flush();
      sendResponse(403);

      clock.tick(10 * DEFAULT_FLUSH_INTERVAL);
      expect(batcher.sendRequest).to.have.been.calledOnce; // never retried
      expect(getLocalStorageItems()).to.be.empty;          // permanent loss
    });
  });

  describe(`LEAK-11: shared storage key across instances — orphan theft under slow network`, function() {
    // web-meshlytics initializes TWO MixpanelLib instances (Mixpanel SaaS + in-house)
    // with the SAME token (web-meshlytics src/index.ts:55,63). init_batchers derives the
    // storage key as '__mpq_' + token + '_ev' (mixpanel-core.js:620) — no instance name.
    // => both instances' RequestBatchers share ONE localStorage queue, separated only by
    // their in-memory queues. Once an item's flushAfter passes (enqueue + 2x flushInterval),
    // fillBatch in ANY batcher on the key treats it as orphaned and may send it.
    //
    // Hazard: a slow response (>2x flushInterval in flight) makes the in-flight items
    // orphan-eligible; the OTHER sink's batcher picks them up, sends them to the WRONG
    // endpoint, and removes them from shared storage. If the rightful request then fails
    // (or the page dies), the event never reaches its intended sink => loss + duplicates.

    it(`batcher B sends and deletes batcher A's in-flight items once flushAfter passes`, function() {
      // batcher A = in-house sink; batcher B = Mixpanel SaaS sink. Same storage key.
      const batcherA = makeBatcher(); // sendRequestFunc: sinon.spy() — we control responses
      const batcherB = makeBatcher();

      // A's instance tracks an event => enqueued into A.memQueue + SHARED localStorage
      batcherA.enqueue({ev: `order_placed (intended for in-house)`});
      batcherA.flush();
      expect(batcherA.sendRequest).to.have.been.calledOnce;
      // network is SLOW: no response yet; A.requestInProgress stays true; item stays in storage
      expect(getLocalStorageItems()).to.have.lengthOf(1);

      // time passes beyond the orphan threshold (flushAfter = enqueue + 2x5000ms)
      clock.tick(DEFAULT_FLUSH_INTERVAL * 3); // 15s in flight — exactly Akshay's scenario

      // B's own 5s timer fires (here: manual flush; B has nothing of its own queued)
      batcherB.flush();

      // THEFT: B sent A's payload to B's endpoint
      expect(batcherB.sendRequest).to.have.been.calledOnce;
      const stolen = batcherB.sendRequest.args[0][0];
      expect(stolen).to.deep.equal([{ev: `order_placed (intended for in-house)`}]);

      // B's request succeeds => B removes the item from SHARED storage
      batcherB.sendRequest.args[0][2]({xhr_req: {status: 200}});
      expect(getLocalStorageItems()).to.be.empty;

      // If the page dies now (or A's slow request ultimately fails), the event has
      // reached ONLY the wrong sink. In-house never gets it: nothing remains in storage
      // to recover. (A's memQueue copy dies with the page.)
    });

    it(`...and if A's slow request then times out, A re-sends from memQueue => duplicate at A's sink too`, function() {
      const batcherA = makeBatcher();
      const batcherB = makeBatcher();

      batcherA.enqueue({ev: `add_to_cart`});
      batcherA.flush();
      clock.tick(DEFAULT_FLUSH_INTERVAL * 3);

      // B steals + acks
      batcherB.flush();
      batcherB.sendRequest.args[0][2]({xhr_req: {status: 200}});
      expect(getLocalStorageItems()).to.be.empty;

      // A's response finally arrives: server 500 => A schedules retry; its memQueue copy survives
      batcherA.sendRequest.args[0][2]({xhr_req: {status: 500}});
      clock.tick(DEFAULT_FLUSH_INTERVAL * 2); // backoff elapses
      expect(batcherA.sendRequest).to.have.been.calledTwice; // resent by A
      const resent = batcherA.sendRequest.args[1][0];
      expect(resent).to.deep.equal([{ev: `add_to_cart`}]);
      // Net effect of one tracked event under slow network + shared key:
      // sink B: 1 delivery it should never have seen; sink A: delivered on retry.
      // Under tab-death before retry: sink A gets ZERO. No dedup exists server-side.
    });
  });

  describe(`LEAK-3: storage kill-switch wipes pending events`, function() {
    it(`after >5 consecutive removal failures the batcher calls stopAllBatching (which in mixpanel-core also CLEARS the queue)`, function() {
      const stopAllBatching = sinon.spy();
      batcher = makeBatcher({stopAllBatchingFunc: stopAllBatching});

      // make removals fail: storage.setItem throws => saveToStorage returns false
      batcher.enqueue({ev: `e1`});
      const failingSetItem = sinon.stub(localStorage, `setItem`).throws(new Error(`QuotaExceededError`));
      try {
        for (let i = 0; i < 6; i++) {
          batcher.flush();
          sendResponse(200);
          clock.tick(DEFAULT_FLUSH_INTERVAL);
        }
      } finally {
        failingSetItem.restore();
      }

      expect(stopAllBatching).to.have.been.called;
      // In production, stopAllBatchingFunc = MixpanelLib.stop_batch_senders
      // (mixpanel-core.js:635), which calls batcher.clear() on events/people/groups,
      // deleting every pending event (mixpanel-core.js:659-665).
    });
  });
});
