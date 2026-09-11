/**
 * L1 tail-loss recovery — acked exit-flush.
 *
 * Asserts flush({useKeepalive:true}) sends via the 'keepalive' transport and
 * that items are removed from the queue ONLY on a 2xx (acked), so the unload
 * flush recovers the tail without the fire-and-forget duplicate problem.
 */
import chai, { expect } from 'chai';
import localStorage from 'localStorage';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);

import { RequestBatcher } from '../../src/request-batcher';

const KEY = `exit-flush-rb-key`;
const START_TIME = 100000;

describe(`exit-flush (acked keepalive tail-loss recovery)`, function() {
    let batcher;
    let clock = null;

    function makeBatcher() {
        return new RequestBatcher(KEY, {
            libConfig: {
                batch_flush_interval_ms: 5000,
                batch_request_timeout_ms: 90000,
                batch_size: 50,
                batch_autostart: true,
            },
            sendRequestFunc: sinon.spy(),
            storage: localStorage,
        });
    }
    function lastCall() {
        return batcher.sendRequest.args[batcher.sendRequest.args.length - 1];
    }
    function respondTo(callIndex, res) {
        batcher.sendRequest.args[callIndex][2](res);
    }

    beforeEach(function() {
        if (clock) { clock.restore(); }
        clock = sinon.useFakeTimers(START_TIME);
        localStorage.clear();
        batcher = makeBatcher();
    });

    afterEach(function() {
        if (clock) { clock.restore(); }
        clock = null;
    });

    it(`sends via the 'keepalive' transport when useKeepalive is set`, function() {
        batcher.enqueue({ev: `a`});
        batcher.flush({useKeepalive: true});
        expect(batcher.sendRequest).to.have.been.called;
        const requestOptions = lastCall()[1];
        expect(requestOptions.transport).to.equal(`keepalive`);
    });

    it(`removes items from the queue on a 2xx (acked)`, function() {
        batcher.enqueue({ev: `a`});
        batcher.enqueue({ev: `b`});
        batcher.flush({useKeepalive: true});
        expect(batcher.queue.memQueue).to.have.lengthOf(2);
        // 2xx success shape (no xhr_req) → normal success path removes items
        respondTo(batcher.sendRequest.args.length - 1, {status: 1});
        expect(batcher.queue.memQueue).to.have.lengthOf(0);
    });

    it(`keeps items in the queue on a 5xx (not acked → recoverable later)`, function() {
        batcher.enqueue({ev: `a`});
        batcher.flush({useKeepalive: true});
        respondTo(batcher.sendRequest.args.length - 1, {xhr_req: {status: 503}});
        expect(batcher.queue.memQueue).to.have.lengthOf(1);
    });

    it(`does not use keepalive transport for a normal flush`, function() {
        batcher.enqueue({ev: `a`});
        batcher.flush();
        const requestOptions = lastCall()[1];
        expect(requestOptions.transport).to.be.undefined;
    });
});
