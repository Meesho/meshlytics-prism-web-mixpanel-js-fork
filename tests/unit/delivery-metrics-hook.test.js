/**
 * Instrumentation Component 1 — delivery-metrics hook.
 *
 * Asserts RequestBatcher reports the correct {type, reason, count, status, queue}
 * to the injected deliveryMetricsReporter for each response branch of
 * batchSendCallback. This is the precise signal the web-meshlytics counters consume.
 */
import chai, { expect } from 'chai';
import localStorage from 'localStorage';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);

import { RequestBatcher } from '../../src/request-batcher';

const KEY = `dm-hook-rb-key`;
const START_TIME = 100000;
const FLUSH_INTERVAL = 5000;
const REQUEST_TIMEOUT_MS = 90000;

describe(`delivery-metrics hook — reports batch outcomes`, function() {
  let batcher;
  let reporter;
  let libConfig;
  let clock = null;
  let priorNavDesc;

  function makeBatcher() {
    return new RequestBatcher(KEY, {
      libConfig,
      sendRequestFunc: sinon.spy(),
      deliveryMetricsReporter: reporter,
      queueType: `events`,
      storage: localStorage,
    });
  }
  function sendResponse(status, {error, responseHeaders} = {}) {
    const i = batcher.sendRequest.args.length - 1;
    batcher.sendRequest.args[i][2]({'xhr_req': {status, responseHeaders}, error});
  }
  function setOnline(isOnline) {
    Object.defineProperty(globalThis, 'navigator', {value: {onLine: isOnline}, configurable: true, writable: true});
  }
  function lastOutcome() {
    return reporter.args[reporter.args.length - 1][0];
  }

  beforeEach(function() {
    if (clock) { clock.restore(); }
    clock = sinon.useFakeTimers(START_TIME);
    localStorage.clear();
    reporter = sinon.spy();
    priorNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    libConfig = {
      batch_flush_interval_ms: FLUSH_INTERVAL,
      batch_request_timeout_ms: REQUEST_TIMEOUT_MS,
      batch_size: 50,
      batch_autostart: true,
    };
    batcher = makeBatcher();
  });

  afterEach(function() {
    if (clock) { clock.restore(); }
    clock = null;
    if (priorNavDesc) { Object.defineProperty(globalThis, 'navigator', priorNavDesc); }
    else { try { delete globalThis.navigator; } catch (e) { /* ignore */ } }
  });

  it(`reports success (count = batch size) on 2xx`, function() {
    batcher.enqueue({ev: `a`});
    batcher.enqueue({ev: `b`});
    batcher.flush();
    sendResponse(200);
    expect(reporter).to.have.been.called;
    expect(lastOutcome()).to.include({type: `success`, count: 2, queue: `events`});
  });

  it(`reports OFFLINE drop on status 0 while offline`, function() {
    setOnline(false);
    batcher.enqueue({ev: `a`});
    batcher.flush();
    sendResponse(0);
    expect(lastOutcome()).to.include({type: `drop`, reason: `OFFLINE`, count: 1});
  });

  it(`reports BLOCKED_STATUS0 drop on status 0 while online`, function() {
    setOnline(true);
    batcher.enqueue({ev: `a`});
    batcher.flush();
    sendResponse(0);
    expect(lastOutcome()).to.include({type: `drop`, reason: `BLOCKED_STATUS0`, count: 1});
  });

  it(`reports HTTP_4XX drop on a 403`, function() {
    batcher.enqueue({ev: `a`});
    batcher.flush();
    sendResponse(403);
    expect(lastOutcome()).to.include({type: `drop`, reason: `HTTP_4XX`, count: 1, status: 403});
  });

  it(`reports retry (not drop) on 5xx`, function() {
    batcher.enqueue({ev: `a`});
    batcher.flush();
    sendResponse(503);
    expect(lastOutcome()).to.include({type: `retry`, reason: `HTTP_5XX`, count: 1});
  });

  it(`reports retry on 429`, function() {
    batcher.enqueue({ev: `a`});
    batcher.flush();
    sendResponse(429);
    expect(lastOutcome()).to.include({type: `retry`, reason: `HTTP_429`});
  });

  it(`reports PAYLOAD_TOO_LARGE drop on a single-event 413`, function() {
    batcher.enqueue({ev: `big`});
    batcher.flush();
    sendResponse(413);
    expect(lastOutcome()).to.include({type: `drop`, reason: `PAYLOAD_TOO_LARGE`, count: 1, status: 413});
  });

  it(`does not throw when no reporter is provided`, function() {
    reporter = undefined;
    batcher = makeBatcher();
    batcher.enqueue({ev: `a`});
    batcher.flush();
    expect(() => sendResponse(200)).to.not.throw();
  });
});
